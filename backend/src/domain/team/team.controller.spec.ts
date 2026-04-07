import { Test } from '@nestjs/testing';
import {
  OrganizationContextGuard,
  JwtAuthGuard,
  PermissionsGuard,
} from '@src/common/guards';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

describe('TeamController', () => {
  let controller: TeamController;
  let service: jest.Mocked<TeamService>;

  const organization = {
    membershipId: 'mem-1',
    organizationId: 'org-1',
    role: 'OWNER',
    hasAllLocations: true,
    allowedLocationIds: [],
  } as any;
  const user = { id: 'user-1' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        {
          provide: TeamService,
          useValue: {
            getMembers: jest.fn(),
            getRoles: jest.fn(),
            getMemberDetail: jest.fn(),
            inviteMember: jest.fn(),
            updateMember: jest.fn(),
            updateMemberRole: jest.fn(),
            updateMemberLocations: jest.fn(),
            deactivateMember: jest.fn(),
            reactivateMember: jest.fn(),
            resendInvite: jest.fn(),
          },
        },
        {
          provide: OrganizationContextGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: PermissionsGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get(TeamController);
    service = module.get(TeamService);
  });

  it('delegates member list queries to the service', async () => {
    const query = { limit: 25, status: 'ACTIVE' } as any;
    const result = { data: [], totalCount: 0, stats: {} } as any;
    service.getMembers.mockResolvedValue(result);

    await expect(controller.getMembers(organization, query)).resolves.toBe(
      result,
    );
    expect(service.getMembers).toHaveBeenCalledWith(organization, query);
  });

  it('delegates invite flows with the current actor id', async () => {
    const input = { email: 'new@user.test', role: 'MANAGER' } as any;
    const result = { action: 'invite_sent', member: { membershipId: 'mem-2' } } as any;
    service.inviteMember.mockResolvedValue(result);

    await expect(
      controller.inviteMember(organization, user, input),
    ).resolves.toBe(result);
    expect(service.inviteMember).toHaveBeenCalledWith(
      organization,
      'user-1',
      input,
    );
  });

  it('delegates role and location mutations to the service', async () => {
    const roleResult = { action: 'role_updated', member: { membershipId: 'mem-2' } } as any;
    const locationResult = {
      action: 'locations_updated',
      member: { membershipId: 'mem-2' },
    } as any;
    service.updateMemberRole.mockResolvedValue(roleResult);
    service.updateMemberLocations.mockResolvedValue(locationResult);

    await controller.updateMemberRole(organization, user, 'mem-2', {
      role: 'SUPPORT',
    } as any);
    await controller.updateMemberLocations(organization, user, 'mem-2', {
      locationIds: ['loc-1'],
    } as any);

    expect(service.updateMemberRole).toHaveBeenCalledWith(
      organization,
      'user-1',
      'mem-2',
      { role: 'SUPPORT' },
    );
    expect(service.updateMemberLocations).toHaveBeenCalledWith(
      organization,
      'user-1',
      'mem-2',
      { locationIds: ['loc-1'] },
    );
  });
});
