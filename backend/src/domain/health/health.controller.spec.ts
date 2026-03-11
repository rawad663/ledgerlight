import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '@src/infra/prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = { $queryRaw: jest.fn() } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('health checks database and returns ok', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([{ '?column?': 1 }]);
    await expect(controller.health()).resolves.toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('base check returns ok without db call', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
