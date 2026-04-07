import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditEntityType,
  MembershipStatus,
  Role,
} from '@prisma/generated/enums';
import { Prisma } from '@prisma/generated/client';
import * as bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { type CurrentOrg } from '@src/common/decorators/current-org.decorator';
import { canAssignRole, canManageMember } from '@src/common/permissions';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  AcceptInviteDto,
  AcceptInviteResponseDto,
  GetTeamMembersQueryDto,
  InvitationResolutionDto,
  InviteMemberDto,
  InviteResolutionStatus,
  ResolveInviteDto,
  TeamMemberDetailDto,
  TeamMembersResponseDto,
  TeamMutationResponseDto,
  TeamRolesResponseDto,
  UpdateTeamMemberDto,
  UpdateTeamMemberLocationsDto,
  UpdateTeamMemberRoleDto,
} from './team.dto';
import {
  ROLE_DESCRIPTIONS,
  getRoleCatalog,
  getRolePermissions,
} from './team.constants';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  async getMembers(
    organization: CurrentOrg,
    query: GetTeamMembersQueryDto,
  ): Promise<TeamMembersResponseDto> {
    const { search, role, status, ...paginationQuery } = query;

    const where: Prisma.MembershipWhereInput = {
      organizationId: organization.organizationId,
      status: status ?? {
        in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED],
      },
      ...(role ? { role } : {}),
    };

    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const { data, total, nextCursor } = await this.prisma.paginateMany(
      this.prisma.membership,
      {
        where,
        include: {
          user: true,
          locations: {
            include: {
              location: {
                select: { id: true, name: true },
              },
            },
          },
          inviteTokens: {
            where: {
              acceptedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
      {
        ...paginationQuery,
        orderBy: this.buildMemberOrderBy(
          paginationQuery.sortBy,
          paginationQuery.sortOrder,
        ),
      },
    );

    const stats = await this.getMemberStats(organization.organizationId);

    return {
      data: data.map((member) => this.mapMemberListItem(member)),
      totalCount: total,
      nextCursor,
      stats,
    };
  }

  async getRoles(organizationId: string): Promise<TeamRolesResponseDto> {
    const counts = await this.prisma.membership.groupBy({
      by: ['role'],
      where: {
        organizationId,
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED] },
      },
      _count: true,
    });

    const countMap = new Map(counts.map((item) => [item.role, item._count]));

    return {
      data: getRoleCatalog().map((role) => ({
        ...role,
        permissions: role.permissions,
        memberCount: countMap.get(role.role) ?? 0,
      })),
    };
  }

  async getMemberDetail(
    organization: CurrentOrg,
    membershipId: string,
  ): Promise<TeamMemberDetailDto> {
    const member = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );

    const activity = await this.prisma.auditLog.findMany({
      where: {
        organizationId: organization.organizationId,
        OR: [
          {
            entityType: AuditEntityType.MEMBERSHIP,
            entityId: membershipId,
          },
          {
            entityType: AuditEntityType.USER,
            entityId: member.userId,
            action: {
              in: [AuditAction.LOGIN, AuditAction.LOGOUT],
            },
          },
        ],
      },
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      ...this.mapMemberListItem(member),
      permissions: getRolePermissions(member.role),
      activity,
    };
  }

  async inviteMember(
    organization: CurrentOrg,
    actorUserId: string,
    input: InviteMemberDto,
  ): Promise<TeamMutationResponseDto> {
    this.assertRoleAssignable(organization.role, input.role);
    const locationIds = await this.resolveScopedLocationIds(
      organization,
      input.locationIds,
    );

    const normalizedEmail = input.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const existingMembership = existingUser
      ? await this.prisma.membership.findFirst({
          where: {
            organizationId: organization.organizationId,
            userId: existingUser.id,
          },
          include: {
            user: true,
            locations: {
              include: { location: { select: { id: true, name: true } } },
            },
            inviteTokens: {
              where: { acceptedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        })
      : null;

    if (existingMembership?.status === MembershipStatus.ACTIVE) {
      throw new ConflictException(
        'This person is already a member of this organization',
      );
    }

    if (existingMembership?.status === MembershipStatus.INVITED) {
      throw new ConflictException(
        'An invitation already exists for this member',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let user = existingUser;
      if (!user) {
        user = await tx.user.create({
          data: {
            email: normalizedEmail,
            firstName: input.firstName,
            lastName: input.lastName,
            isActive: true,
          },
        });
      }

      if (existingMembership?.status === MembershipStatus.DEACTIVATED) {
        const before = this.snapshotMembership(existingMembership);
        const updatedMembership = await tx.membership.update({
          where: { id: existingMembership.id },
          data: {
            role: input.role,
            status: user.passwordHash
              ? MembershipStatus.ACTIVE
              : MembershipStatus.INVITED,
            deactivatedAt: null,
            activatedAt: user.passwordHash ? new Date() : null,
            invitedAt: user.passwordHash
              ? existingMembership.invitedAt
              : new Date(),
          },
          include: {
            user: true,
            locations: {
              include: { location: { select: { id: true, name: true } } },
            },
            inviteTokens: {
              where: { acceptedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            firstName: input.firstName ?? user.firstName,
            lastName: input.lastName ?? user.lastName,
          },
        });

        await this.replaceMembershipLocations(
          tx,
          updatedMembership.id,
          locationIds,
        );

        let inviteUrl: string | undefined;
        let action = 'member_reactivated';

        if (!user.passwordHash) {
          inviteUrl = await this.createInviteForMembership(
            tx,
            updatedMembership.id,
          );
          action = 'member_reinvited';
        } else {
          await tx.refreshToken.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        const refreshed = await this.loadMembershipWithRelations(
          tx,
          updatedMembership.id,
        );

        await this.createAuditLog(tx, {
          organizationId: organization.organizationId,
          actorUserId,
          action: user.passwordHash
            ? AuditAction.MEMBER_REACTIVATED
            : AuditAction.INVITE_SENT,
          entityId: refreshed.id,
          beforeJson: before,
          afterJson: this.snapshotMembership(refreshed),
        });

        return { membership: refreshed, inviteUrl, action };
      }

      const membership = await tx.membership.create({
        data: {
          organizationId: organization.organizationId,
          userId: user.id,
          role: input.role,
          status: MembershipStatus.INVITED,
          invitedAt: new Date(),
        },
      });

      await this.replaceMembershipLocations(tx, membership.id, locationIds);
      const inviteUrl = await this.createInviteForMembership(tx, membership.id);
      const refreshed = await this.loadMembershipWithRelations(
        tx,
        membership.id,
      );

      await this.createAuditLog(tx, {
        organizationId: organization.organizationId,
        actorUserId,
        action: AuditAction.INVITE_SENT,
        entityId: refreshed.id,
        beforeJson: null,
        afterJson: this.snapshotMembership(refreshed),
      });

      return { membership: refreshed, inviteUrl, action: 'invite_sent' };
    });

    this.deliverInvite(result.inviteUrl);

    return {
      member: {
        ...(await this.getMemberDetail(organization, result.membership.id)),
      },
      action: result.action,
      inviteUrl: result.inviteUrl,
    };
  }

  async updateMember(
    organization: CurrentOrg,
    actorUserId: string,
    membershipId: string,
    input: UpdateTeamMemberDto,
  ): Promise<TeamMutationResponseDto> {
    const membership = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );
    this.assertMemberManageable(
      organization.role,
      membership.role,
      {
        isMe: membership.id === organization.membershipId,
      },
    );

    const before = this.snapshotMembership(membership);
    const normalizedEmail = input.email?.trim().toLowerCase();

    if (normalizedEmail && normalizedEmail !== membership.user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing && existing.id !== membership.userId) {
        throw new ConflictException(
          'Email is already in use by another account',
        );
      }
    }

    await this.prisma.user.update({
      where: { id: membership.userId },
      data: {
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(input.firstName !== undefined
          ? { firstName: input.firstName }
          : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      },
    });

    const updated = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );

    await this.createAuditLog(this.prisma, {
      organizationId: organization.organizationId,
      actorUserId,
      action: AuditAction.UPDATE,
      entityId: membershipId,
      beforeJson: before,
      afterJson: this.snapshotMembership(updated),
    });

    return {
      member: await this.getMemberDetail(organization, membershipId),
      action: 'member_updated',
    };
  }

  async updateMemberRole(
    organization: CurrentOrg,
    actorUserId: string,
    membershipId: string,
    input: UpdateTeamMemberRoleDto,
  ): Promise<TeamMutationResponseDto> {
    const membership = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );

    if (membership.userId === actorUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    this.assertMemberManageable(
      organization.role,
      membership.role,
      {
        allowSameTierOwner:
          membership.role === Role.OWNER && input.role !== Role.OWNER,
      },
    );
    this.assertRoleAssignable(organization.role, input.role);

    if (membership.role === Role.OWNER && input.role !== Role.OWNER) {
      await this.ensureActiveOwnerCount(
        organization.organizationId,
        membershipId,
      );
    }

    const before = this.snapshotMembership(membership);

    await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: input.role },
    });

    const updated = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );

    await this.createAuditLog(this.prisma, {
      organizationId: organization.organizationId,
      actorUserId,
      action: AuditAction.ROLE_CHANGED,
      entityId: membershipId,
      beforeJson: before,
      afterJson: this.snapshotMembership(updated),
    });

    return {
      member: await this.getMemberDetail(organization, membershipId),
      action: 'role_changed',
    };
  }

  async updateMemberLocations(
    organization: CurrentOrg,
    actorUserId: string,
    membershipId: string,
    input: UpdateTeamMemberLocationsDto,
  ): Promise<TeamMutationResponseDto> {
    const membership = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );

    this.assertMemberManageable(organization.role, membership.role);
    const before = this.snapshotMembership(membership);
    const locationIds = await this.resolveScopedLocationIds(
      organization,
      input.locationIds,
    );

    await this.prisma.$transaction(async (tx) => {
      await this.replaceMembershipLocations(tx, membershipId, locationIds);
      const updated = await this.loadMembershipWithRelations(tx, membershipId);

      await this.createAuditLog(tx, {
        organizationId: organization.organizationId,
        actorUserId,
        action: AuditAction.LOCATION_SCOPE_CHANGED,
        entityId: membershipId,
        beforeJson: before,
        afterJson: this.snapshotMembership(updated),
      });
    });

    return {
      member: await this.getMemberDetail(organization, membershipId),
      action: 'locations_updated',
    };
  }

  async deactivateMember(
    organization: CurrentOrg,
    actorUserId: string,
    membershipId: string,
  ): Promise<TeamMutationResponseDto> {
    const membership = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );

    if (membership.userId === actorUserId) {
      throw new ForbiddenException('You cannot deactivate your own membership');
    }

    if (membership.role !== Role.OWNER) {
      this.assertMemberManageable(organization.role, membership.role);
    } else if (organization.role !== Role.OWNER) {
      throw new ForbiddenException(
        'Only an owner can deactivate another owner',
      );
    }

    if (membership.role === Role.OWNER) {
      await this.ensureActiveOwnerCount(
        organization.organizationId,
        membershipId,
      );
    }

    const before = this.snapshotMembership(membership);

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: membershipId },
        data: {
          status: MembershipStatus.DEACTIVATED,
          deactivatedAt: new Date(),
        },
      });

      await tx.refreshToken.updateMany({
        where: { userId: membership.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const updated = await this.loadMembershipWithRelations(tx, membershipId);
      await this.createAuditLog(tx, {
        organizationId: organization.organizationId,
        actorUserId,
        action: AuditAction.MEMBER_DEACTIVATED,
        entityId: membershipId,
        beforeJson: before,
        afterJson: this.snapshotMembership(updated),
      });
    });

    return {
      member: await this.getMemberDetail(organization, membershipId),
      action: 'member_deactivated',
    };
  }

  async reactivateMember(
    organization: CurrentOrg,
    actorUserId: string,
    membershipId: string,
  ): Promise<TeamMutationResponseDto> {
    const membership = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );

    if (membership.role !== Role.OWNER) {
      this.assertMemberManageable(organization.role, membership.role);
    } else if (organization.role !== Role.OWNER) {
      throw new ForbiddenException(
        'Only an owner can reactivate another owner',
      );
    }

    const before = this.snapshotMembership(membership);
    let inviteUrl: string | undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: membershipId },
        data: {
          status: membership.user.passwordHash
            ? MembershipStatus.ACTIVE
            : MembershipStatus.INVITED,
          deactivatedAt: null,
          activatedAt: membership.user.passwordHash ? new Date() : null,
          invitedAt: membership.user.passwordHash
            ? membership.invitedAt
            : new Date(),
        },
      });

      if (membership.user.passwordHash) {
        await tx.refreshToken.updateMany({
          where: { userId: membership.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } else {
        inviteUrl = await this.createInviteForMembership(tx, membershipId);
      }

      const updated = await this.loadMembershipWithRelations(tx, membershipId);
      await this.createAuditLog(tx, {
        organizationId: organization.organizationId,
        actorUserId,
        action: membership.user.passwordHash
          ? AuditAction.MEMBER_REACTIVATED
          : AuditAction.INVITE_SENT,
        entityId: membershipId,
        beforeJson: before,
        afterJson: this.snapshotMembership(updated),
      });
    });

    this.deliverInvite(inviteUrl);

    return {
      member: await this.getMemberDetail(organization, membershipId),
      action: membership.user.passwordHash
        ? 'member_reactivated'
        : 'member_reinvited',
      inviteUrl,
    };
  }

  async resendInvite(
    organization: CurrentOrg,
    actorUserId: string,
    membershipId: string,
  ): Promise<TeamMutationResponseDto> {
    const membership = await this.findMembershipOrThrow(
      organization.organizationId,
      membershipId,
    );

    if (membership.status !== MembershipStatus.INVITED) {
      throw new BadRequestException(
        'Only invited members can receive a resent invite',
      );
    }

    if (organization.role !== Role.OWNER) {
      this.assertMemberManageable(organization.role, membership.role);
    }

    const before = this.snapshotMembership(membership);
    const inviteUrl = await this.prisma.$transaction(async (tx) => {
      const url = await this.createInviteForMembership(tx, membershipId);
      const updated = await this.loadMembershipWithRelations(tx, membershipId);
      await this.createAuditLog(tx, {
        organizationId: organization.organizationId,
        actorUserId,
        action: AuditAction.INVITE_RESENT,
        entityId: membershipId,
        beforeJson: before,
        afterJson: this.snapshotMembership(updated),
      });

      return url;
    });

    this.deliverInvite(inviteUrl);

    return {
      member: await this.getMemberDetail(organization, membershipId),
      action: 'invite_resent',
      inviteUrl,
    };
  }

  async resolveInvitation(
    input: ResolveInviteDto,
  ): Promise<InvitationResolutionDto> {
    const invitation = await this.findInvitationByToken(input.token);
    if (!invitation) {
      return { status: InviteResolutionStatus.INVALID };
    }

    if (
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.membership.status !== MembershipStatus.INVITED
    ) {
      return { status: InviteResolutionStatus.EXPIRED };
    }

    return {
      status: InviteResolutionStatus.VALID,
      member: await this.getInvitationMemberDetail(invitation.membershipId),
      organizationName: invitation.membership.organization.name,
      roleDescription: ROLE_DESCRIPTIONS[invitation.membership.role],
      requiresPassword: !invitation.membership.user.passwordHash,
    };
  }

  async acceptInvitation(
    input: AcceptInviteDto,
    authenticatedUserId?: string,
  ): Promise<AcceptInviteResponseDto> {
    const invitation = await this.findInvitationByToken(input.token);
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.membership.status !== MembershipStatus.INVITED
    ) {
      throw new BadRequestException('This invite link is invalid or expired');
    }

    if (invitation.membership.user.passwordHash) {
      if (!authenticatedUserId) {
        throw new UnauthorizedException(
          'Please log in with the invited account before accepting this invitation',
        );
      }

      if (authenticatedUserId !== invitation.membership.userId) {
        throw new ForbiddenException(
          'This invitation belongs to a different user account',
        );
      }
    }

    if (
      !invitation.membership.user.passwordHash &&
      (!input.password || input.password.length < 8)
    ) {
      throw new BadRequestException(
        'A password is required to accept this invitation',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (!invitation.membership.user.passwordHash) {
        await tx.user.update({
          where: { id: invitation.membership.userId },
          data: {
            passwordHash: await bcrypt.hash(input.password!, 10),
            ...(input.firstName !== undefined
              ? { firstName: input.firstName }
              : {}),
            ...(input.lastName !== undefined
              ? { lastName: input.lastName }
              : {}),
            isActive: true,
          },
        });
      }

      await tx.membership.update({
        where: { id: invitation.membershipId },
        data: {
          status: MembershipStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      await tx.inviteToken.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      const updated = await this.loadMembershipWithRelations(
        tx,
        invitation.membershipId,
      );
      await this.createAuditLog(tx, {
        organizationId: invitation.membership.organizationId,
        actorUserId: invitation.membership.userId,
        action: AuditAction.INVITE_ACCEPTED,
        entityId: invitation.membershipId,
        beforeJson: this.snapshotMembership(invitation.membership as any),
        afterJson: this.snapshotMembership(updated),
      });
    });

    const member = await this.getInvitationMemberDetail(
      invitation.membershipId,
    );

    return {
      member,
      message: 'Invitation accepted successfully',
    };
  }

  private async getMemberStats(organizationId: string) {
    const [activeMembers, deactivatedMembers, pendingInvites] =
      await Promise.all([
        this.prisma.membership.count({
          where: { organizationId, status: MembershipStatus.ACTIVE },
        }),
        this.prisma.membership.count({
          where: { organizationId, status: MembershipStatus.DEACTIVATED },
        }),
        this.prisma.membership.count({
          where: {
            organizationId,
            status: MembershipStatus.INVITED,
            inviteTokens: {
              some: {
                acceptedAt: null,
                expiresAt: { gt: new Date() },
              },
            },
          },
        }),
      ]);

    return {
      activeMembers,
      pendingInvites,
      deactivatedMembers,
    };
  }

  private buildMemberOrderBy(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const direction = sortOrder;
    switch (sortBy) {
      case 'role':
        return [{ role: direction }, { createdAt: 'desc' }] as Record<
          string,
          any
        >[];
      case 'status':
        return [{ status: direction }, { createdAt: 'desc' }] as Record<
          string,
          any
        >[];
      case 'lastActiveAt':
        return [
          { user: { lastLoginAt: direction } },
          { createdAt: 'desc' },
        ] as Record<string, any>[];
      case 'member':
        return [
          { user: { firstName: direction } },
          { user: { email: direction } },
        ] as Record<string, any>[];
      default:
        return [{ createdAt: 'desc' }] as Record<string, any>[];
    }
  }

  private async findMembershipOrThrow(
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: {
        user: true,
        organization: true,
        locations: {
          include: {
            location: {
              select: { id: true, name: true },
            },
          },
        },
        inviteTokens: {
          where: { acceptedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    return membership;
  }

  private mapMemberListItem(member: any) {
    const activeInvite = member.inviteTokens?.[0] ?? null;
    const displayName = [member.user.firstName, member.user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      membershipId: member.id,
      userId: member.userId,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      displayName: displayName || member.user.email,
      email: member.user.email,
      role: member.role,
      status: member.status,
      lastActiveAt: member.user.lastLoginAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      hasAllLocations: member.locations.length === 0,
      locations: member.locations.map((entry: any) => entry.location),
      inviteExpired: Boolean(
        activeInvite &&
        activeInvite.acceptedAt === null &&
        activeInvite.expiresAt <= new Date(),
      ),
      inviteExpiresAt: activeInvite?.expiresAt ?? null,
    };
  }

  private assertRoleAssignable(actorRole: Role, targetRole: Role) {
    if (!canAssignRole(actorRole, targetRole)) {
      throw new ForbiddenException('You cannot assign that role');
    }
  }

  private assertMemberManageable(
    actorRole: Role,
    targetRole: Role,
    options?: {
      isMe?: boolean;
      allowSameTierOwner?: boolean;
    },
  ) {
    if (options?.isMe) {
      return;
    }

    if (
      !canManageMember(actorRole, targetRole, {
        allowSameTierOwner: options?.allowSameTierOwner,
      })
    ) {
      throw new ForbiddenException('You cannot manage this member');
    }
  }

  private async ensureActiveOwnerCount(
    organizationId: string,
    excludingMembershipId: string,
  ) {
    const ownerCount = await this.prisma.membership.count({
      where: {
        organizationId,
        role: Role.OWNER,
        status: MembershipStatus.ACTIVE,
        id: { not: excludingMembershipId },
      },
    });

    if (ownerCount === 0) {
      throw new ConflictException(
        'The last remaining owner cannot be changed or deactivated',
      );
    }
  }

  private async resolveScopedLocationIds(
    organization: CurrentOrg,
    requestedLocationIds?: string[],
  ): Promise<string[]> {
    const scopedIds = requestedLocationIds?.length
      ? [...new Set(requestedLocationIds)]
      : organization.hasAllLocations
        ? []
        : [...organization.allowedLocationIds];

    const activeLocations = await this.prisma.location.findMany({
      where: {
        organizationId: organization.organizationId,
        status: 'ACTIVE',
        ...(organization.hasAllLocations
          ? {}
          : { id: { in: organization.allowedLocationIds } }),
      },
      select: { id: true },
    });

    const allowedLocationIds = new Set(
      activeLocations.map((location) => location.id),
    );
    const invalidLocationId = scopedIds.find(
      (locationId) => !allowedLocationIds.has(locationId),
    );

    if (invalidLocationId) {
      throw new ForbiddenException(
        'You can only assign active locations you have access to',
      );
    }

    return scopedIds;
  }

  private async replaceMembershipLocations(
    tx: Prisma.TransactionClient,
    membershipId: string,
    locationIds: string[],
  ) {
    await tx.membershipLocation.deleteMany({
      where: { membershipId },
    });

    if (locationIds.length === 0) {
      return;
    }

    await tx.membershipLocation.createMany({
      data: locationIds.map((locationId) => ({
        membershipId,
        locationId,
      })),
    });
  }

  private createInviteTokenHash(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private buildInviteUrl(token: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}/invite/${token}`;
  }

  private async createInviteForMembership(
    tx: Prisma.TransactionClient,
    membershipId: string,
  ) {
    await tx.inviteToken.updateMany({
      where: {
        membershipId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        expiresAt: new Date(),
      },
    });

    const rawToken = crypto.randomBytes(32).toString('base64url');
    await tx.inviteToken.create({
      data: {
        membershipId,
        tokenHash: this.createInviteTokenHash(rawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return this.buildInviteUrl(rawToken);
  }

  private async findInvitationByToken(token: string) {
    return this.prisma.inviteToken.findUnique({
      where: { tokenHash: this.createInviteTokenHash(token) },
      include: {
        membership: {
          include: {
            user: true,
            organization: true,
            locations: {
              include: {
                location: {
                  select: { id: true, name: true },
                },
              },
            },
            inviteTokens: {
              where: { acceptedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }

  private async getInvitationMemberDetail(membershipId: string) {
    const membership = await this.findMembershipOrThrow(
      (await this.prisma.membership.findUnique({
        where: { id: membershipId },
        select: { organizationId: true },
      }))!.organizationId,
      membershipId,
    );

    return {
      ...this.mapMemberListItem(membership),
      permissions: getRolePermissions(membership.role),
      activity: [],
    };
  }

  private async loadMembershipWithRelations(
    tx: Prisma.TransactionClient | PrismaService,
    membershipId: string,
  ) {
    const membership = await tx.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: true,
        organization: true,
        locations: {
          include: {
            location: {
              select: { id: true, name: true },
            },
          },
        },
        inviteTokens: {
          where: { acceptedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    return membership;
  }

  private snapshotMembership(member: any) {
    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      status: member.status,
      email: member.user?.email,
      firstName: member.user?.firstName,
      lastName: member.user?.lastName,
      locationIds:
        member.locations?.map(
          (entry: any) => entry.locationId ?? entry.location?.id,
        ) ?? [],
    };
  }

  private async createAuditLog(
    tx: Prisma.TransactionClient | PrismaService,
    args: {
      organizationId: string;
      actorUserId?: string;
      action: AuditAction;
      entityId: string;
      beforeJson: unknown;
      afterJson: unknown;
    },
  ) {
    await tx.auditLog.create({
      data: {
        organizationId: args.organizationId,
        actorUserId: args.actorUserId,
        action: args.action,
        entityType: AuditEntityType.MEMBERSHIP,
        entityId: args.entityId,
        beforeJson: args.beforeJson as
          | Prisma.InputJsonValue
          | Prisma.NullableJsonNullValueInput
          | undefined,
        afterJson: args.afterJson as
          | Prisma.InputJsonValue
          | Prisma.NullableJsonNullValueInput
          | undefined,
      },
    });
  }

  private deliverInvite(inviteUrl?: string) {
    if (!inviteUrl) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info(`[team-invite] ${inviteUrl}`);
    }
  }
}
