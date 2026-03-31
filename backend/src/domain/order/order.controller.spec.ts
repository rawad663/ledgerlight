import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import {
  OrganizationContextGuard,
  JwtAuthGuard,
  PermissionsGuard,
} from '@src/common/guards';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@src/infra/prisma/prisma.service';
import { OrderStatus } from '@prisma/generated/enums';

describe('OrderController', () => {
  let controller: OrderController;
  let service: jest.Mocked<OrderService>;

  const org = { organizationId: 'org-1', role: 'MANAGER' };

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

  /**
   * Orders
   */

  describe('createOrder', () => {
    const body = {
      customerId: 'cust-1',
      locationId: 'loc-1',
      orderItems: [{ productId: 'prod-1', qty: 2 }],
    } as any;

    it('delegates to service and returns created order', async () => {
      const result = { id: 'order-1', items: [] } as any;
      service.createOrder.mockResolvedValue(result);

      const res = await controller.createOrder(org, body);

      expect(service.createOrder).toHaveBeenCalledWith('org-1', body);
      expect(res).toBe(result);
    });

    it('propagates BadRequestException when order has no items', async () => {
      service.createOrder.mockRejectedValue(
        new BadRequestException('Order must contain at least one item'),
      );

      await expect(
        controller.createOrder(org, { orderItems: [] } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('transitionStatus', () => {
    it('delegates to service and returns updated order', async () => {
      const result = { id: 'order-1', status: OrderStatus.CONFIRMED } as any;
      service.transitionStatus.mockResolvedValue(result);

      const body = { toStatus: OrderStatus.CONFIRMED };
      const res = await controller.transitionStatus(org, 'order-1', body);

      expect(service.transitionStatus).toHaveBeenCalledWith(
        'org-1',
        'order-1',
        body,
      );
      expect(res).toBe(result);
    });

    it('propagates NotFoundException when order not found', async () => {
      service.transitionStatus.mockRejectedValue(
        new NotFoundException('Order not found for organization'),
      );

      await expect(
        controller.transitionStatus(org, 'missing', {
          toStatus: OrderStatus.CONFIRMED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('CASHIER can confirm an order', async () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' };
      const result = { id: 'order-1', status: OrderStatus.CONFIRMED } as any;
      service.transitionStatus.mockResolvedValue(result);

      const res = await controller.transitionStatus(cashierOrg, 'order-1', {
        toStatus: OrderStatus.CONFIRMED,
      });

      expect(service.transitionStatus).toHaveBeenCalled();
      expect(res).toBe(result);
    });

    it('CASHIER can fulfill an order', async () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' };
      const result = { id: 'order-1', status: OrderStatus.FULFILLED } as any;
      service.transitionStatus.mockResolvedValue(result);

      const res = await controller.transitionStatus(cashierOrg, 'order-1', {
        toStatus: OrderStatus.FULFILLED,
      });

      expect(service.transitionStatus).toHaveBeenCalled();
      expect(res).toBe(result);
    });

    it('CASHIER cannot cancel an order', () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' };

      expect(() =>
        controller.transitionStatus(cashierOrg, 'order-1', {
          toStatus: OrderStatus.CANCELLED,
        }),
      ).toThrow(ForbiddenException);
    });

    it('CASHIER cannot reopen an order', () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' };

      expect(() =>
        controller.transitionStatus(cashierOrg, 'order-1', {
          toStatus: OrderStatus.PENDING,
        }),
      ).toThrow(ForbiddenException);
    });

    it('CASHIER cannot refund an order', () => {
      const cashierOrg = { organizationId: 'org-1', role: 'CASHIER' };

      expect(() =>
        controller.transitionStatus(cashierOrg, 'order-1', {
          toStatus: OrderStatus.REFUNDED,
        }),
      ).toThrow(ForbiddenException);
    });

    it('MANAGER can refund an order', async () => {
      const result = { id: 'order-1', status: OrderStatus.REFUNDED } as any;
      service.transitionStatus.mockResolvedValue(result);

      const res = await controller.transitionStatus(org, 'order-1', {
        toStatus: OrderStatus.REFUNDED,
      });

      expect(service.transitionStatus).toHaveBeenCalled();
      expect(res).toBe(result);
    });

    it('MANAGER can cancel an order', async () => {
      const result = { id: 'order-1', status: OrderStatus.CANCELLED } as any;
      service.transitionStatus.mockResolvedValue(result);

      const res = await controller.transitionStatus(org, 'order-1', {
        toStatus: OrderStatus.CANCELLED,
      });

      expect(service.transitionStatus).toHaveBeenCalled();
      expect(res).toBe(result);
    });
  });

  describe('getOrders', () => {
    it('delegates to service with query and returns paginated list', async () => {
      const query = {
        limit: 10,
        cursor: undefined,
        withItems: true,
        status: undefined,
      } as any;
      const result = { data: [], totalCount: 0 } as any;
      service.getOrders.mockResolvedValue(result);

      const res = await controller.getOrders(org, query);

      expect(service.getOrders).toHaveBeenCalledWith('org-1', query);
      expect(res).toBe(result);
    });

    it('passes status filter to service', async () => {
      const query = {
        limit: 10,
        cursor: undefined,
        withItems: false,
        status: OrderStatus.PENDING,
      } as any;
      const result = { data: [], totalCount: 0 } as any;
      service.getOrders.mockResolvedValue(result);

      await controller.getOrders(org, query);

      expect(service.getOrders).toHaveBeenCalledWith('org-1', query);
    });
  });

  describe('getOrder', () => {
    it('delegates to service and returns order', async () => {
      const result = { id: 'order-1' } as any;
      const query = { withItems: false } as any;
      service.getOrderById.mockResolvedValue(result);

      const res = await controller.getOrder(org, 'order-1', query);

      expect(service.getOrderById).toHaveBeenCalledWith(
        'org-1',
        'order-1',
        query,
      );
      expect(res).toBe(result);
    });

    it('passes withItems=true to service', async () => {
      const query = { withItems: true } as any;
      service.getOrderById.mockResolvedValue({
        id: 'order-1',
        items: [],
      } as any);

      await controller.getOrder(org, 'order-1', query);

      expect(service.getOrderById).toHaveBeenCalledWith(
        'org-1',
        'order-1',
        query,
      );
    });

    it('propagates NotFoundException when order not found', async () => {
      service.getOrderById.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await expect(
        controller.getOrder(org, 'missing', { withItems: false } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOrder', () => {
    it('delegates to service and returns updated order', async () => {
      const body = { customerId: 'cust-2' } as any;
      const result = { id: 'order-1', customerId: 'cust-2' } as any;
      service.updateOrder.mockResolvedValue(result);

      const res = await controller.updateOrder(org, 'order-1', body);

      expect(service.updateOrder).toHaveBeenCalledWith(
        'org-1',
        'order-1',
        body,
      );
      expect(res).toBe(result);
    });

    it('propagates BadRequestException for invalid customer', async () => {
      service.updateOrder.mockRejectedValue(
        new BadRequestException('Customer not found with given id'),
      );

      await expect(
        controller.updateOrder(org, 'order-1', { customerId: 'bad' } as any),
      ).rejects.toThrow('Customer not found with given id');
    });
  });

  describe('deleteOrder', () => {
    it('delegates to service and returns deleted order', async () => {
      const result = { id: 'order-1' } as any;
      service.deleteOrder.mockResolvedValue(result);

      const res = await controller.deleteOrder(org, 'order-1');

      expect(service.deleteOrder).toHaveBeenCalledWith('org-1', 'order-1');
      expect(res).toBe(result);
    });

    it('propagates error when order does not exist', async () => {
      service.deleteOrder.mockRejectedValue(new Error('Record not found'));

      await expect(controller.deleteOrder(org, 'missing')).rejects.toThrow(
        'Record not found',
      );
    });
  });

  /**
   * Order Items
   */

  describe('addOrderItem', () => {
    const body = { productId: 'prod-1', qty: 3 } as any;

    it('delegates to service and returns order with items', async () => {
      const result = { id: 'order-1', items: [{ id: 'item-1' }] } as any;
      service.addOrderItem.mockResolvedValue(result);

      const res = await controller.addOrderItem(org, 'order-1', body);

      expect(service.addOrderItem).toHaveBeenCalledWith(
        'org-1',
        'order-1',
        body,
      );
      expect(res).toBe(result);
    });

    it('propagates error states', async () => {
      service.addOrderItem.mockRejectedValue(
        new NotFoundException(
          'Order not found for organization or is not Pending',
        ),
      );

      await expect(
        controller.addOrderItem(org, 'missing', body),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteOrderItem', () => {
    it('delegates to service and returns order with remaining items', async () => {
      const result = { id: 'order-1', items: [{ id: 'item-2' }] } as any;
      service.deleteOrderItem.mockResolvedValue(result);

      const res = await controller.deleteOrderItem(org, 'order-1', 'item-1');

      expect(service.deleteOrderItem).toHaveBeenCalledWith(
        'org-1',
        'order-1',
        'item-1',
      );
      expect(res).toBe(result);
    });

    it('propagates error states', async () => {
      service.deleteOrderItem.mockRejectedValue(
        new NotFoundException('Order item not found'),
      );

      await expect(
        controller.deleteOrderItem(org, 'order-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
