import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  JwtAuthGuard,
  OrganizationContextGuard,
  PermissionsGuard,
} from '@src/common/guards';
import { Role } from '@prisma/generated/enums';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: jest.Mocked<PaymentService>;

  const org = { organizationId: 'org-1', role: 'MANAGER' as Role };
  const user = { id: 'user-1' } as any;
  const req = {
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1',
    requestId: 'req-1',
  } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            getPaymentByOrderId: jest.fn(),
            initiateCardPayment: jest.fn(),
            confirmCardPayment: jest.fn(),
            markCashPaid: jest.fn(),
            refundPayment: jest.fn(),
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

    controller = module.get(PaymentController);
    service = module.get(PaymentService);
  });

  it('delegates payment reads to the service', async () => {
    const payment = { id: 'pay-1' } as any;
    service.getPaymentByOrderId.mockResolvedValue(payment);

    const result = await controller.getPayment(org, 'order-1');

    expect(service.getPaymentByOrderId).toHaveBeenCalledWith(
      'org-1',
      'order-1',
    );
    expect(result).toBe(payment);
  });

  it('passes audit context when starting a card payment', async () => {
    const response = { paymentId: 'pay-1', attemptId: 'att-1' } as any;
    service.initiateCardPayment.mockResolvedValue(response);

    const result = await controller.initiateCardPayment(
      org,
      user,
      req,
      'order-1',
    );

    expect(service.initiateCardPayment).toHaveBeenCalledWith(
      'org-1',
      'order-1',
      expect.objectContaining({
        actorUserId: 'user-1',
        requestId: 'req-1',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    );
    expect(result).toBe(response);
  });

  it('passes refund data through to the service', async () => {
    const payment = { id: 'pay-1', refundStatus: 'REQUESTED' } as any;
    service.refundPayment.mockResolvedValue(payment);

    const result = await controller.refundPayment(org, user, req, 'order-1', {
      refundReason: 'Customer changed their mind',
    });

    expect(service.refundPayment).toHaveBeenCalledWith(
      'org-1',
      'order-1',
      { refundReason: 'Customer changed their mind' },
      expect.objectContaining({ actorUserId: 'user-1' }),
    );
    expect(result).toBe(payment);
  });

  it('propagates payment lookup errors', async () => {
    service.getPaymentByOrderId.mockRejectedValue(
      new NotFoundException('Payment not found for order'),
    );

    await expect(controller.getPayment(org, 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
