/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import { MembershipStatus, PrismaClient, Role } from '@prisma/generated/client';
import request from 'supertest';
import { createMembership, createOrganization, createUser } from './factories';

type AuthenticatedMemberInput = {
  prisma: PrismaClient;
  app: INestApplication;
  role?: Role;
  password?: string;
  organizationId?: string;
  locationIds?: string[];
  status?: MembershipStatus;
  email?: string;
  isActive?: boolean;
};

export async function login(
  app: INestApplication,
  credentials: { email: string; password: string },
) {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send(credentials);

  return response;
}

export function buildAuthHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Organization-Id': organizationId,
  };
}

export function extractInviteToken(inviteUrl: string) {
  return inviteUrl.split('/').pop() ?? '';
}

export async function createAuthenticatedMember({
  prisma,
  app,
  role = Role.OWNER,
  password = 'Password123!',
  organizationId,
  locationIds,
  status = MembershipStatus.ACTIVE,
  email,
  isActive = true,
}: AuthenticatedMemberInput) {
  const organization = organizationId
    ? await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
      })
    : await createOrganization(prisma);
  const user = await createUser(prisma, {
    email,
    password,
    isActive,
  });
  const membership = await createMembership(prisma, {
    organizationId: organization.id,
    userId: user.id,
    role,
    status,
    locationIds,
  });

  const response = await login(app, {
    email: user.email,
    password,
  });

  return {
    organization,
    user,
    membership,
    response,
    accessToken: response.body.accessToken as string,
    refreshTokenRaw: response.body.refreshTokenRaw as string,
    headers: buildAuthHeaders(
      response.body.accessToken as string,
      organization.id,
    ),
  };
}
