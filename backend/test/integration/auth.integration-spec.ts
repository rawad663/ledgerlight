/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import {
  AuditAction,
  AuditEntityType,
  MembershipStatus,
  PrismaClient,
  Role,
} from '@prisma/generated/client';
import request from 'supertest';
import { expectErrorResponse } from './utils/assertions';
import { buildAuthHeaders, createAuthenticatedMember } from './utils/auth';
import {
  createMembership,
  createOrganization,
  createUser,
} from './utils/factories';
import {
  createTestContext,
  destroyTestContext,
  resetTestDatabase,
} from './utils/test-context';

describe('Auth integration', () => {
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

  it('logs in successfully, returns tokens, updates lastLoginAt, and writes login audit logs', async () => {
    const organization = await createOrganization(prisma, {
      name: 'Moonwear',
    });
    const user = await createUser(prisma, {
      email: 'owner@example.com',
      password: 'Password123!',
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: user.id,
      role: Role.OWNER,
      status: MembershipStatus.ACTIVE,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user.email,
        password: 'Password123!',
      })
      .expect(201);

    expect(typeof response.body.accessToken).toBe('string');
    expect(typeof response.body.refreshTokenRaw).toBe('string');
    expect(response.body.user.id).toBe(user.id);
    expect(response.body.memberships).toHaveLength(1);
    expect(response.body.memberships[0]).toMatchObject({
      organizationId: organization.id,
      role: Role.OWNER,
    });
    expect(response.body.memberships[0].locations).toEqual([]);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(updatedUser.lastLoginAt).not.toBeNull();

    const refreshTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },
    });
    expect(refreshTokens).toHaveLength(1);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: organization.id,
        actorUserId: user.id,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        action: AuditAction.LOGIN,
      },
    });
    expect(auditLogs).toHaveLength(1);
  });

  it('rejects invalid credentials with the production error envelope', async () => {
    const organization = await createOrganization(prisma);
    const user = await createUser(prisma, {
      email: 'manager@example.com',
      password: 'Password123!',
    });
    await createMembership(prisma, {
      organizationId: organization.id,
      userId: user.id,
      role: Role.MANAGER,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user.email,
        password: 'WrongPassword123!',
      })
      .expect(401);

    expectErrorResponse(response.body, {
      statusCode: 401,
      path: '/auth/login',
      message: 'Invalid credentials, incorrect password',
    });
  });

  it('refreshes tokens, logs out, revokes refresh tokens, and blocks refresh after logout', async () => {
    const auth = await createAuthenticatedMember({
      prisma,
      app,
      role: Role.MANAGER,
      password: 'Password123!',
    });

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        userId: auth.user.id,
        refreshTokenRaw: auth.refreshTokenRaw,
      })
      .expect(201);

    expect(typeof refreshResponse.body.accessToken).toBe('string');
    expect(refreshResponse.body.user.id).toBe(auth.user.id);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(buildAuthHeaders(auth.accessToken, auth.organization.id))
      .expect(204);

    const revokedTokens = await prisma.refreshToken.findMany({
      where: { userId: auth.user.id },
    });
    expect(revokedTokens).toHaveLength(1);
    expect(revokedTokens[0].revokedAt).not.toBeNull();

    const logoutAuditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        entityType: AuditEntityType.USER,
        entityId: auth.user.id,
        action: AuditAction.LOGOUT,
      },
    });
    expect(logoutAuditLogs).toHaveLength(1);

    const secondRefreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        userId: auth.user.id,
        refreshTokenRaw: auth.refreshTokenRaw,
      })
      .expect(401);

    expectErrorResponse(secondRefreshResponse.body, {
      statusCode: 401,
      path: '/auth/refresh',
      message: 'Invalid refresh token',
    });
  });
});
