import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { UserWithMemberships } from './strategies/jwt.strategy';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should call AuthService.login with DTO and return result', async () => {
    const dto = { email: 'a@b.com', password: 'password123' };
    const result = { accessToken: 'token' } as any;
    authService.login.mockResolvedValue(result);

    await expect(controller.login(dto as any)).resolves.toBe(result);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('should call AuthService.refresh with DTO and return result', async () => {
    const dto = { refreshTokenRaw: 'raw', userId: 'uuid' };
    const result = { accessToken: 'new' } as any;
    authService.refresh.mockResolvedValue(result);

    await expect(controller.refresh(dto as any)).resolves.toBe(result);
    expect(authService.refresh).toHaveBeenCalledWith(dto);
  });

  it('should call AuthService.logout with current user id', async () => {
    const user = { id: 'user-1' } as UserWithMemberships;
    authService.logout.mockResolvedValue(undefined);

    await controller.logout(user);
    expect(authService.logout).toHaveBeenCalledWith('user-1');
  });
});
