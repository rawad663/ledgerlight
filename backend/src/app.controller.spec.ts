import { Test, TestingModule } from '@nestjs/testing';
import {
  OrganizationContextGuard,
  JwtAuthGuard,
  RolesGuard,
} from '@src/common/guards';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: OrganizationContextGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: RolesGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      const req: any = {
        user: { id: 'u1' },
        organization: { organizationId: 'org', role: 'MANAGER' },
      };
      expect(appController.getHello(req)).toBe('Hello World!');
    });
  });
});
