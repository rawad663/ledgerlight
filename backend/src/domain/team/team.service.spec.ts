import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MembershipStatus, Role } from '@prisma/generated/enums';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { createPrismaMock } from '@src/test-utils/prisma.mock';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module = await Test.createTestingModule({
      providers: [TeamService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(TeamService);
  });

  describe('updateMemberRole', () => {
    it('allows demoting a non-last owner', async () => {
      const organization = {
        organizationId: 'org-1',
        role: Role.OWNER,
        membershipId: 'actor-membership',
        hasAllLocations: true,
        allowedLocationIds: [],
      } as const;

      (prisma.membership.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          id: 'membership-2',
          organizationId: 'org-1',
          userId: 'user-2',
          role: Role.OWNER,
          status: MembershipStatus.ACTIVE,
          user: { email: 'owner2@example.com' },
          locations: [],
          inviteTokens: [],
        })
        .mockResolvedValueOnce({
          id: 'membership-2',
          organizationId: 'org-1',
          userId: 'user-2',
          role: Role.MANAGER,
          status: MembershipStatus.ACTIVE,
          user: { email: 'owner2@example.com' },
          locations: [],
          inviteTokens: [],
        })
        .mockResolvedValueOnce({
          id: 'membership-2',
          organizationId: 'org-1',
          userId: 'user-2',
          role: Role.MANAGER,
          status: MembershipStatus.ACTIVE,
          user: { email: 'owner2@example.com' },
          locations: [],
          inviteTokens: [],
        });
      (prisma.membership.count as jest.Mock).mockResolvedValue(1);
      (prisma.membership.update as jest.Mock).mockResolvedValue({
        id: 'membership-2',
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        id: 'audit-1',
      });

      await expect(
        service.updateMemberRole(
          organization as any,
          'actor-user',
          'membership-2',
          {
            role: Role.MANAGER,
          },
        ),
      ).resolves.toMatchObject({
        action: 'role_changed',
        member: { membershipId: 'membership-2', role: Role.MANAGER },
      });

      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: { id: 'membership-2' },
        data: { role: Role.MANAGER },
      });
    });
  });

  describe('acceptInvitation', () => {
    it('rejects accepting a deactivated invitation', async () => {
      (prisma.inviteToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        membershipId: 'membership-1',
        membership: {
          id: 'membership-1',
          organizationId: 'org-1',
          status: MembershipStatus.DEACTIVATED,
          role: Role.MANAGER,
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'member@example.com',
            passwordHash: null,
          },
          organization: { name: 'Ledger Light' },
          locations: [],
          inviteTokens: [],
        },
      });

      await expect(
        service.acceptInvitation({
          token: 'invite-token',
          password: 'supersecret',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires the invited existing user to be authenticated', async () => {
      (prisma.inviteToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'invite-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        membershipId: 'membership-1',
        membership: {
          id: 'membership-1',
          organizationId: 'org-1',
          status: MembershipStatus.INVITED,
          role: Role.MANAGER,
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'member@example.com',
            passwordHash: 'stored-password',
          },
          organization: { name: 'Ledger Light' },
          locations: [],
          inviteTokens: [],
        },
      });

      await expect(
        service.acceptInvitation({ token: 'invite-token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      await expect(
        service.acceptInvitation({ token: 'invite-token' }, 'user-2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
