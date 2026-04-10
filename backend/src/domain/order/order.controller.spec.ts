import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import {
  JwtAuthGuard,
  OrganizationContextGuard,
  PermissionsGuard,
} from '@src/common/guards';
import { OrderStatus, Role } from '@prisma/generated/enums';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

describe('OrderController', () => {
  let controller: OrderController;
  let service: jest.Mocked<OrderService>;

  const org = { organizationId: 'org-1', role: 'MANAGER' as Role };
  const user = { id: 'user-1' } as any;
  const req = {
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1',
    requestId: 'req-1',
  } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            createOrder: jest.fn(),
            transitionStatus: jest.fn(),
            getOrders: jest.fn(),
            getOrderById: jest.fn(),
            updateOrder: jest.fn(),
            deleteOrder: jest.fn(),
            addOrderItem: jest.fn(),
            deleteOrderItem: jest.fn(),
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

    controller = module.get(OrderController);
    service = module.get(OrderService);
  });

  describe('createOrder', () => {
    it('delegates to service and returns created order', async () => {
      const body = {
        customerId: 'cust-1',
        locationId: 'loc-1',
        orderItems: [{ productId: 'prod-1', qty: 2 }],
      } as any;
      const result = { id: 'order-1', items: [], payment: null } as any;
      service.createOrder.mockResolvedValue(result);

      const res = await controller.createOrder(org, body);

      expect(service.createOrder).toHaveBeenCalledWith('org-1', body);
      expect(res).toBe(result);
    });

    it('propagates create validation errors', async () => {
      service.createOrder.mockRejectedValue(
        new BadRequestException('Order must contain at least one item'),
      );

      await expect(
        controller.createOrder(org, { orderItems: [] } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('transitionStatus', () => {
    it('delegates to service with audit context', async () => {
      const body = { toStatus: OrderStatus.CONFIRMED };
      const result = {
        id: 'order-1',
        status: OrderStatus.CONFIRMED,
        payment: { paymentStatus: 'UNPAID' },
      } as any;
      service.transitionStatus.mockResolvedValue(result);

      const res = await controller.transitionStatus(
        org,
        user,
        req,
        'order-1',
        body,
      );

      expect(service.transitionStatus).toHaveBeenCalledWith(
        'org-1',
        'order-1',
        body,
        expect.objectContaining({
          actorUserId: 'user-1',
          requestId: 'req-1',
          ip: '127.0.0.1',
          userAgent: 'jest',
        }),
      );
      expect(res).toBe(result);
    });

    it('propagates not found errors', async () => {
      service.transitionStatus.mockRejectedValue(
        new NotFoundException('Order not found for organization'),
      );

      await expect(
        controller.transitionStatus(org, user, req, 'missing', {
          toStatus: OrderStatus.CONFIRMED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('CASHIER can confirm an order', async () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' as Role };
      service.transitionStatus.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CONFIRMED,
      } as any);

      await controller.transitionStatus(cashierOrg, user, req, 'order-1', {
        toStatus: OrderStatus.CONFIRMED,
      });

      expect(service.transitionStatus).toHaveBeenCalled();
    });

    it('CASHIER can fulfill an order', async () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' as Role };
      service.transitionStatus.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.FULFILLED,
      } as any);

      await controller.transitionStatus(cashierOrg, user, req, 'order-1', {
        toStatus: OrderStatus.FULFILLED,
      });

      expect(service.transitionStatus).toHaveBeenCalled();
    });

    it('CASHIER cannot cancel an order', () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' as Role };

      expect(() =>
        controller.transitionStatus(cashierOrg, user, req, 'order-1', {
          toStatus: OrderStatus.CANCELLED,
        }),
      ).toThrow(ForbiddenException);
    });

    it('CASHIER cannot reopen an order', () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' as Role };

      expect(() =>
        controller.transitionStatus(cashierOrg, user, req, 'order-1', {
          toStatus: OrderStatus.PENDING,
        }),
      ).toThrow(ForbiddenException);
    });

    it('MANAGER can cancel an order', async () => {
      service.transitionStatus.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CANCELLED,
      } as any);

      const res = await controller.transitionStatus(org, user, req, 'order-1', {
        toStatus: OrderStatus.CANCELLED,
      });

      expect(service.transitionStatus).toHaveBeenCalled();
      expect(res.status).toBe(OrderStatus.CANCELLED);
    });
  });
});
