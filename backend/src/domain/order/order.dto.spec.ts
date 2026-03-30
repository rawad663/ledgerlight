import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  OrderDto,
  OrderItemDto,
  OrderWithItemsDto,
  CreateOrderItemDto,
  CreateOrderDto,
  TransitionStatusBodyDto,
  GetOrdersQueryDto,
  GetOrderQueryDto,
  UpdateOrderDto,
  GetOrdersResponseDto,
} from './order.dto';
import { OrderStatus } from '@prisma/generated/enums';

const uuid = 'a5b2b7f0-ec1b-4a0a-9e08-7e2dd6e7d5a0';
const uuid2 = '0b5f7ae8-5835-4ef4-bfb7-7d1b2d8d9d1a';

describe('OrderDto', () => {
  const valid = {
    id: uuid,
    organizationId: uuid2,
    customerId: uuid,
    locationId: uuid,
    status: OrderStatus.PENDING,
    subtotalCents: 3000,
    taxCents: 300,
    discountCents: 100,
    totalCents: 3200,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts a valid order', async () => {
    const dto = plainToInstance(OrderDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts optional fields as null', async () => {
    const dto = plainToInstance(OrderDto, {
      ...valid,
      customerId: null,
      locationId: null,
      placedAt: null,
      cancelledAt: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid uuid for id', async () => {
    const dto = plainToInstance(OrderDto, { ...valid, id: 'not-uuid' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid status', async () => {
    const dto = plainToInstance(OrderDto, { ...valid, status: 'SHIPPED' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative cents values', async () => {
    const dto = plainToInstance(OrderDto, {
      ...valid,
      subtotalCents: -1,
      taxCents: -5,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects non-integer cents', async () => {
    const dto = plainToInstance(OrderDto, { ...valid, totalCents: 10.5 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid date for createdAt', async () => {
    const dto = plainToInstance(OrderDto, { ...valid, createdAt: 'not-date' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('OrderItemDto', () => {
  const valid = {
    id: uuid,
    orderId: uuid,
    organizationId: uuid2,
    productId: uuid,
    productName: 'Widget',
    qty: 2,
    unitPriceCents: 1500,
    lineSubtotalCents: 3000,
    discountCents: 0,
    taxCents: 0,
    lineTotalCents: 3000,
  };

  it('accepts a valid order item', async () => {
    const dto = plainToInstance(OrderItemDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts optional sku as null', async () => {
    const dto = plainToInstance(OrderItemDto, { ...valid, sku: null });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('defaults discountCents and taxCents to 0 when omitted', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { discountCents, taxCents, ...rest } = valid;
    const dto = plainToInstance(OrderItemDto, rest);
    expect(dto.discountCents).toBe(0);
    expect(dto.taxCents).toBe(0);
  });

  it('rejects qty < 1', async () => {
    const dto = plainToInstance(OrderItemDto, { ...valid, qty: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative unitPriceCents', async () => {
    const dto = plainToInstance(OrderItemDto, {
      ...valid,
      unitPriceCents: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative discountCents', async () => {
    const dto = plainToInstance(OrderItemDto, {
      ...valid,
      discountCents: -10,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing productName', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { productName, ...rest } = valid;
    const dto = plainToInstance(OrderItemDto, rest);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('OrderWithItemsDto', () => {
  const validOrder = {
    id: uuid,
    organizationId: uuid2,
    status: OrderStatus.PENDING,
    subtotalCents: 3000,
    taxCents: 0,
    discountCents: 0,
    totalCents: 3000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('accepts order with valid items array', async () => {
    const dto = plainToInstance(OrderWithItemsDto, {
      ...validOrder,
      items: [],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when items is not an array', async () => {
    const dto = plainToInstance(OrderWithItemsDto, {
      ...validOrder,
      items: 'not-array',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateOrderItemDto', () => {
  it('accepts valid create item payload', async () => {
    const dto = plainToInstance(CreateOrderItemDto, {
      productId: uuid,
      qty: 3,
      discountCents: 0,
      taxCents: 50,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing productId', async () => {
    const dto = plainToInstance(CreateOrderItemDto, { qty: 1 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects qty < 1', async () => {
    const dto = plainToInstance(CreateOrderItemDto, {
      productId: uuid,
      qty: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateOrderDto', () => {
  it('accepts valid create order payload', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      customerId: uuid,
      locationId: uuid2,
      orderItems: [{ productId: uuid, qty: 1 }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts optional customerId and locationId as null', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      customerId: null,
      locationId: null,
      orderItems: [{ productId: uuid, qty: 2 }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when orderItems is not an array', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      orderItems: 'bad',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid customerId uuid', async () => {
    const dto = plainToInstance(CreateOrderDto, {
      customerId: 'not-uuid',
      orderItems: [{ productId: uuid, qty: 1 }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('TransitionStatusBodyDto', () => {
  it('accepts a valid OrderStatus', async () => {
    const dto = plainToInstance(TransitionStatusBodyDto, {
      toStatus: OrderStatus.CONFIRMED,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each(Object.values(OrderStatus))('accepts status %s', async (status) => {
    const dto = plainToInstance(TransitionStatusBodyDto, {
      toStatus: status,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid status value', async () => {
    const dto = plainToInstance(TransitionStatusBodyDto, {
      toStatus: 'SHIPPED',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing toStatus', async () => {
    const dto = plainToInstance(TransitionStatusBodyDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('GetOrdersQueryDto', () => {
  it('accepts empty object with defaults', async () => {
    const dto = plainToInstance(GetOrdersQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.withItems).toBe(false);
    expect(dto.status).toBeUndefined();
    expect(dto.search).toBeUndefined();
    expect(dto.locationId).toBeUndefined();
  });

  it('accepts search and locationId', async () => {
    const dto = plainToInstance(GetOrdersQueryDto, {
      search: 'emily',
      locationId: uuid,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.search).toBe('emily');
    expect(dto.locationId).toBe(uuid);
  });

  it('transforms string "true" to boolean for withItems', () => {
    const dto = plainToInstance(GetOrdersQueryDto, { withItems: 'true' });
    expect(dto.withItems).toBe(true);
  });

  it('transforms string "false" to false for withItems', () => {
    const dto = plainToInstance(GetOrdersQueryDto, { withItems: 'false' });
    expect(dto.withItems).toBe(false);
  });

  it('accepts valid status filter', async () => {
    const dto = plainToInstance(GetOrdersQueryDto, {
      status: OrderStatus.PENDING,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid status filter', async () => {
    const dto = plainToInstance(GetOrdersQueryDto, { status: 'INVALID' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('GetOrderQueryDto', () => {
  it('defaults withItems to false', () => {
    const dto = plainToInstance(GetOrderQueryDto, {});
    expect(dto.withItems).toBe(false);
  });

  it('transforms string "true" to boolean', () => {
    const dto = plainToInstance(GetOrderQueryDto, { withItems: 'true' });
    expect(dto.withItems).toBe(true);
  });

  it('passes through boolean true', () => {
    const dto = plainToInstance(GetOrderQueryDto, { withItems: true });
    expect(dto.withItems).toBe(true);
  });

  it('transforms undefined to false', () => {
    const dto = plainToInstance(GetOrderQueryDto, { withItems: undefined });
    expect(dto.withItems).toBe(false);
  });
});

describe('UpdateOrderDto', () => {
  it('accepts valid update payload', async () => {
    const dto = plainToInstance(UpdateOrderDto, {
      customerId: uuid,
      locationId: uuid2,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts null optional fields', async () => {
    const dto = plainToInstance(UpdateOrderDto, {
      customerId: null,
      locationId: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid uuid for customerId', async () => {
    const dto = plainToInstance(UpdateOrderDto, { customerId: 'bad' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('GetOrdersResponseDto', () => {
  const validOrder = {
    id: uuid,
    organizationId: uuid2,
    status: OrderStatus.PENDING,
    subtotalCents: 3000,
    taxCents: 0,
    discountCents: 0,
    totalCents: 3000,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: { id: uuid, name: 'Emily', email: 'emily@test.com' },
    location: {
      id: uuid2,
      name: 'Downtown',
      addressLine1: '456 Oak Ave',
      city: 'Portland',
      stateProvince: 'OR',
      postalCode: '97204',
      countryCode: 'US',
    },
  };

  it('validates paginated response with locations', async () => {
    const payload = {
      data: [validOrder],
      totalCount: 1,
      locations: [
        {
          id: uuid2,
          organizationId: uuid,
          name: 'Downtown',
          code: null,
          type: 'STORE',
          status: 'ACTIVE',
          addressLine1: '456 Oak Ave',
          addressLine2: null,
          city: 'Portland',
          stateProvince: 'OR',
          postalCode: '97204',
          countryCode: 'US',
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
    const dto = plainToInstance(GetOrdersResponseDto, payload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when data is invalid', async () => {
    const payload = { data: [{}], totalCount: 'one' } as any;
    const dto = plainToInstance(GetOrdersResponseDto, payload);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
