import { Test } from '@nestjs/testing';
import { TeamInvitationController } from './team-invitation.controller';
import { TeamService } from './team.service';

describe('TeamInvitationController', () => {
  let controller: TeamInvitationController;
  let service: jest.Mocked<TeamService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TeamInvitationController],
      providers: [
        {
          provide: TeamService,
          useValue: {
            resolveInvitation: jest.fn(),
            acceptInvitation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TeamInvitationController);
    service = module.get(TeamService);
  });

  it('resolves invitation tokens through the service', async () => {
    const input = { token: 'invite-token' };
    const result = { status: 'VALID' } as any;
    service.resolveInvitation.mockResolvedValue(result);

    await expect(controller.resolve(input)).resolves.toBe(result);
    expect(service.resolveInvitation).toHaveBeenCalledWith(input);
  });

  it('accepts invitation tokens through the service', async () => {
    const input = { token: 'invite-token', password: 'supersecret' };
    const result = {
      message: 'Invite accepted',
      member: { membershipId: 'mem-1' },
    } as any;
    service.acceptInvitation.mockResolvedValue(result);

    await expect(controller.accept(input)).resolves.toBe(result);
    expect(service.acceptInvitation).toHaveBeenCalledWith(input, undefined);
  });
});
