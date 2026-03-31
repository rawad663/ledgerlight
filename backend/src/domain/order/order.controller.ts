import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgProtected } from '@src/common/decorators/auth.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '@src/common/decorators/permissions.decorator';
import { hasPermission } from '@src/common/guards/permissions.guard';
import { Permission } from '@src/common/permissions';
import { OrderService } from './order.service';
import {
  type CurrentOrg,
  CurrentOrganization,
} from '@src/common/decorators/current-org.decorator';
import {
  CreateOrderDto,
  CreateOrderItemDto,
  GetOrderQueryDto,
  GetOrdersQueryDto,
  GetOrdersResponseDto,
  OrderDetailDto,
  OrderDto,
  OrderWithItemsDto,
  TransitionStatusBodyDto,
  UpdateOrderDto,
} from './order.dto';
import {
  ApiDoc,
  appendToPaginationQuery,
} from '@src/common/swagger/api-doc.decorator';
import { OrderStatus } from '@prisma/generated/enums';

const TRANSITION_PERMISSION: Record<OrderStatus, Permission> = {
  [OrderStatus.CONFIRMED]: Permission.ORDERS_TRANSITION_CONFIRM,
  [OrderStatus.FULFILLED]: Permission.ORDERS_TRANSITION_FULFILL,
  [OrderStatus.CANCELLED]: Permission.ORDERS_TRANSITION_CANCEL,
  [OrderStatus.PENDING]: Permission.ORDERS_TRANSITION_REOPEN,
  [OrderStatus.REFUNDED]: Permission.ORDERS_TRANSITION_REFUND,
};

@Controller('orders')
@OrgProtected()
@ApiTags('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * Orders
   */

  @Post()
  @RequirePermissions(Permission.ORDERS_CREATE)
  @ApiDoc({
    summary: 'Create Order & Order Items',
    body: CreateOrderDto,
    created: OrderWithItemsDto,
  })
  createOrder(
    @CurrentOrganization() org: CurrentOrg,
    @Body() data: CreateOrderDto,
  ) {
    return this.orderService.createOrder(org.organizationId, data);
  }

  @Post(':id/transition-status')
  @RequireAnyPermission(
    Permission.ORDERS_TRANSITION_CONFIRM,
    Permission.ORDERS_TRANSITION_FULFILL,
    Permission.ORDERS_TRANSITION_CANCEL,
    Permission.ORDERS_TRANSITION_REOPEN,
    Permission.ORDERS_TRANSITION_REFUND,
  )
  @ApiDoc({
    summary: 'Transition the status of an Order',
    params: [{ name: 'id', description: 'Order ID', type: String }],
    body: TransitionStatusBodyDto,
    created: OrderDto,
  })
  transitionStatus(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') id: string,
    @Body() data: TransitionStatusBodyDto,
  ) {
    const required = TRANSITION_PERMISSION[data.toStatus];
    if (!hasPermission(org.role, required)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return this.orderService.transitionStatus(org.organizationId, id, data);
  }

  @Get()
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiDoc({
    summary: 'List orders for an organization',
    description: 'Paginated list of orders with its items.',
    ok: GetOrdersResponseDto,
    queries: appendToPaginationQuery([
      { name: 'withItems', description: 'Include Order Items', type: Boolean },
      {
        name: 'status',
        description: 'Filter by status (default ALL)',
        type: String,
        enum: Object.values(OrderStatus),
      },
      {
        name: 'search',
        description: 'Search by Order ID, customer name or email',
        type: String,
      },
      {
        name: 'locationId',
        description: 'Filter by location ID',
        type: String,
      },
    ]),
  })
  getOrders(
    @CurrentOrganization() org: CurrentOrg,
    @Query() query: GetOrdersQueryDto,
  ) {
    return this.orderService.getOrders(org.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDERS_READ)
  @ApiDoc({
    summary: 'Get Order',
    description: 'Get an Order by ID',
    params: [{ name: 'id', type: String, in: 'path' }],
    ok: OrderDetailDto,
    queries: [
      { name: 'withItems', description: 'Include Order Items', type: Boolean },
    ],
  })
  getOrder(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') id: string,
    @Query() query: GetOrderQueryDto,
  ) {
    return this.orderService.getOrderById(org.organizationId, id, query);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ORDERS_UPDATE)
  @ApiDoc({
    summary: 'Update Order',
    description: 'Update an Order by ID (metadata only)',
    params: [{ name: 'id', type: String, in: 'path' }],
    ok: OrderDto,
    body: UpdateOrderDto,
  })
  updateOrder(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') id: string,
    @Body() data: UpdateOrderDto,
  ) {
    return this.orderService.updateOrder(org.organizationId, id, data);
  }

  @Delete(':id')
  @RequirePermissions(Permission.ORDERS_DELETE)
  @ApiDoc({
    summary: 'Delete Order',
    ok: OrderDto,
    params: [{ name: 'id', type: String, in: 'path' }],
  })
  deleteOrder(@CurrentOrganization() org: CurrentOrg, @Param('id') id: string) {
    return this.orderService.deleteOrder(org.organizationId, id);
  }

  /**
   * Order Items
   */

  @Post(':id/items')
  @RequirePermissions(Permission.ORDERS_UPDATE)
  @ApiDoc({
    summary: 'Add item to an order',
    description: 'Adds a new item to an existing order',
    ok: OrderWithItemsDto,
    body: CreateOrderItemDto,
    params: [{ name: 'id', type: String, in: 'path', description: 'Order ID' }],
  })
  addOrderItem(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') orderId: string,
    @Body() data: CreateOrderItemDto,
  ) {
    return this.orderService.addOrderItem(org.organizationId, orderId, data);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions(Permission.ORDERS_UPDATE)
  @ApiDoc({
    summary: 'Delete item from an order',
    description: 'Delete an item from an existing order',
    ok: OrderWithItemsDto,
    params: [
      { name: 'id', type: String, in: 'path', description: 'Order ID' },
      {
        name: 'itemId',
        type: String,
        in: 'path',
        description: 'Order Item ID',
      },
    ],
  })
  deleteOrderItem(
    @CurrentOrganization() org: CurrentOrg,
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.orderService.deleteOrderItem(
      org.organizationId,
      orderId,
      itemId,
    );
  }
}
