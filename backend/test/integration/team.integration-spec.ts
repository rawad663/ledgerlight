/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import {
  AuditAction,
  MembershipStatus,
  PrismaClient,
  Role,
} from '@prisma/generated/client';
import request from 'supertest';
import { expectErrorResponse } from './utils/assertions';
import {
  buildAuthHeaders,
  createAuthenticatedMember,
  extractInviteToken,
  login,
} from './utils/auth';
import {
  createLocation,
  createMembership,
  createOrganization,
  createUser,
} from './utils/factories';
import {
  createTestContext,
  destroyTestContext,
  resetTestDatabase,
} from './utils/test-context';

describe('Team integration', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    ({ app, prisma } = await createTestContext());
  });

  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await destroyTestContext(app);
  });

  it('lists members, returns role catalog, and shows member detail', async () => {
    const owner = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    const teammate = await createUser(prisma, {
      email: 'manager-team@example.com',
      password: 'Password123!',
    });
    const teammateMembership = await createMembership(prisma, {
      organizationId: owner.organization.id,
      userId: teammate.id,
      role: Role.MANAGER,
    });

    const listResponse = await request(app.getHttpServer())
      .get('/team')
      .set(owner.headers)
      .expect(200);

    expect(listResponse.body.totalCount).toBe(2);
    expect(listResponse.body.stats).toMatchObject({
      activeMembers: 2,
      pendingInvites: 0,
      deactivatedMembers: 0,
    });

    const rolesResponse = await request(app.getHttpServer())
      .get('/team/roles')
      .set(owner.headers)
      .expect(200);

    const ownerRole = rolesResponse.body.data.find(
      (role: { role: Role }) => role.role === Role.OWNER,
    );
    const managerRole = rolesResponse.body.data.find(
      (role: { role: Role }) => role.role === Role.MANAGER,
    );

    expect(ownerRole.memberCount).toBe(1);
    expect(managerRole.memberCount).toBe(1);

    const detailResponse = await request(app.getHttpServer())
      .get(`/team/${teammateMembership.id}`)
      .set(owner.headers)
      .expect(200);

    expect(detailResponse.body).toMatchObject({
      membershipId: teammateMembership.id,
      email: teammate.email,
      role: Role.MANAGER,
      status: MembershipStatus.ACTIVE,
    });
    expect(detailResponse.body.permissions.length).toBeGreaterThan(0);
  });

  it('invites a new member, resolves the invite, accepts it, and writes audit logs', async () => {
    const owner = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    const location = await createLocation(prisma, {
      organizationId: owner.organization.id,
      name: 'Invite Store',
      code: 'INV',
    });

    const inviteResponse = await request(app.getHttpServer())
      .post('/team/invite')
      .set(owner.headers)
      .send({
        email: 'invite-new@example.com',
        role: Role.CASHIER,
        firstName: 'Invited',
        lastName: 'User',
        locationIds: [location.id],
      })
      .expect(201);

    expect(inviteResponse.body.action).toBe('invite_sent');
    expect(typeof inviteResponse.body.inviteUrl).toBe('string');
    const token = extractInviteToken(inviteResponse.body.inviteUrl as string);

    const invitationMembership = await prisma.membership.findFirstOrThrow({
      where: {
        organizationId: owner.organization.id,
        user: {
          email: 'invite-new@example.com',
        },
      },
    });

    const inviteAuditLog = await prisma.auditLog.findFirst({
      where: {
        organizationId: owner.organization.id,
        entityId: invitationMembership.id,
        action: AuditAction.INVITE_SENT,
      },
    });
    expect(inviteAuditLog).not.toBeNull();

    const resolveResponse = await request(app.getHttpServer())
      .post('/team/invitations/resolve')
      .send({ token })
      .expect(201);

    expect(resolveResponse.body).toMatchObject({
      status: 'VALID',
      requiresPassword: true,
      organizationName: owner.organization.name,
    });

    const acceptResponse = await request(app.getHttpServer())
      .post('/team/invitations/accept')
      .send({
        token,
        password: 'Password123!',
        firstName: 'Accepted',
        lastName: 'Invitee',
      })
      .expect(201);

    expect(acceptResponse.body).toMatchObject({
      message: 'Invitation accepted successfully',
    });
    expect(acceptResponse.body.member).toMatchObject({
      membershipId: invitationMembership.id,
      status: MembershipStatus.ACTIVE,
      firstName: 'Accepted',
      lastName: 'Invitee',
      hasAllLocations: false,
    });

    const acceptedInvite = await prisma.inviteToken.findFirstOrThrow({
      where: { membershipId: invitationMembership.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(acceptedInvite.acceptedAt).not.toBeNull();

    const acceptedMembership = await prisma.membership.findUniqueOrThrow({
      where: { id: invitationMembership.id },
    });
    expect(acceptedMembership.status).toBe(MembershipStatus.ACTIVE);

    const acceptAuditLog = await prisma.auditLog.findFirst({
      where: {
        organizationId: owner.organization.id,
        entityId: invitationMembership.id,
        action: AuditAction.INVITE_ACCEPTED,
      },
    });
    expect(acceptAuditLog).not.toBeNull();
  });

  it('requires the invited existing user to authenticate before accepting an invite', async () => {
    const targetOwner = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    const otherOrg = await createOrganization(prisma);
    const existingUser = await createUser(prisma, {
      email: 'existing-user@example.com',
      password: 'Password123!',
    });
    await createMembership(prisma, {
      organizationId: otherOrg.id,
      userId: existingUser.id,
      role: Role.MANAGER,
    });

    const existingUserLogin = await login(app, {
      email: existingUser.email,
      password: 'Password123!',
    });
    expect(existingUserLogin.status).toBe(201);

    const inviteResponse = await request(app.getHttpServer())
      .post('/team/invite')
      .set(targetOwner.headers)
      .send({
        email: existingUser.email,
        role: Role.SUPPORT,
      })
      .expect(201);

    const token = extractInviteToken(inviteResponse.body.inviteUrl as string);

    const unauthenticatedResponse = await request(app.getHttpServer())
      .post('/team/invitations/accept')
      .send({ token })
      .expect(401);

    expectErrorResponse(unauthenticatedResponse.body, {
      statusCode: 401,
      path: '/team/invitations/accept',
      message:
        'Please log in with the invited account before accepting this invitation',
    });

    const authenticatedResponse = await request(app.getHttpServer())
      .post('/team/invitations/accept')
      .set(
        buildAuthHeaders(
          existingUserLogin.body.accessToken as string,
          otherOrg.id,
        ),
      )
      .send({ token })
      .expect(201);

    expect(authenticatedResponse.body.member).toMatchObject({
      email: existingUser.email,
      role: Role.SUPPORT,
      status: MembershipStatus.ACTIVE,
    });
  });

  it('updates members, changes roles and locations, deactivates/reactivates, and resends invites', async () => {
    const owner = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.OWNER,
    });
    const locationOne = await createLocation(prisma, {
      organizationId: owner.organization.id,
      name: 'Location One',
      code: 'L1',
    });
    const locationTwo = await createLocation(prisma, {
      organizationId: owner.organization.id,
      name: 'Location Two',
      code: 'L2',
    });
    const activeMember = await createUser(prisma, {
      email: 'active-member@example.com',
      password: 'Password123!',
    });
    const activeMembership = await createMembership(prisma, {
      organizationId: owner.organization.id,
      userId: activeMember.id,
      role: Role.MANAGER,
    });

    await request(app.getHttpServer())
      .patch(`/team/${activeMembership.id}`)
      .set(owner.headers)
      .send({
        firstName: 'Updated',
        lastName: 'Manager',
        email: 'updated-manager@example.com',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.action).toBe('member_updated');
        expect(body.member.email).toBe('updated-manager@example.com');
      });

    await request(app.getHttpServer())
      .patch(`/team/${activeMembership.id}/role`)
      .set(owner.headers)
      .send({
        role: Role.SUPPORT,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.action).toBe('role_changed');
        expect(body.member.role).toBe(Role.SUPPORT);
      });

    await request(app.getHttpServer())
      .patch(`/team/${activeMembership.id}/locations`)
      .set(owner.headers)
      .send({
        locationIds: [locationOne.id, locationTwo.id],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.action).toBe('locations_updated');
        expect(body.member.hasAllLocations).toBe(false);
        expect(body.member.locations).toHaveLength(2);
      });

    await request(app.getHttpServer())
      .post(`/team/${activeMembership.id}/deactivate`)
      .set(owner.headers)
      .expect(201)
      .expect(({ body }) => {
        expect(body.action).toBe('member_deactivated');
        expect(body.member.status).toBe(MembershipStatus.DEACTIVATED);
      });

    await request(app.getHttpServer())
      .post(`/team/${activeMembership.id}/reactivate`)
      .set(owner.headers)
      .expect(201)
      .expect(({ body }) => {
        expect(body.action).toBe('member_reactivated');
        expect(body.member.status).toBe(MembershipStatus.ACTIVE);
      });

    await request(app.getHttpServer())
      .post('/team/invite')
      .set(owner.headers)
      .send({
        email: 'resent-member@example.com',
        role: Role.CASHIER,
      })
      .expect(201);

    const invitedMembership = await prisma.membership.findFirstOrThrow({
      where: {
        organizationId: owner.organization.id,
        user: { email: 'resent-member@example.com' },
      },
    });

    const resendResponse = await request(app.getHttpServer())
      .post(`/team/${invitedMembership.id}/resend-invite`)
      .set(owner.headers)
      .expect(201);

    expect(resendResponse.body.action).toBe('invite_resent');
    expect(typeof resendResponse.body.inviteUrl).toBe('string');

    const actions = await prisma.auditLog.findMany({
      where: {
        organizationId: owner.organization.id,
        entityId: activeMembership.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(actions.map((entry) => entry.action)).toEqual(
      expect.arrayContaining([
        AuditAction.UPDATE,
        AuditAction.ROLE_CHANGED,
        AuditAction.LOCATION_SCOPE_CHANGED,
        AuditAction.MEMBER_DEACTIVATED,
        AuditAction.MEMBER_REACTIVATED,
      ]),
    );
  });
});
