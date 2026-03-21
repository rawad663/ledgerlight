import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  Authorized,
  OrgProtected,
} from '@src/common/decorators/auth.decorator';
import { OrderService } from './order.service';
import {
  type CurrentOrg,
  CurrentOrganization,
} from '@src/common/decorators/current-org.decorator';
import {
  CreateOrderDto,
  GetOrdersQueryDto,
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

@Controller('orders')
@OrgProtected()
@ApiTags('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * Orders
   */

  @Post()
  @Authorized('ADMIN', 'MANAGER')
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
  @Authorized('ADMIN', 'MANAGER')
  @ApiDoc({
    summary: 'Transition the status of an Order',
    params: [{ name: 'id', description: 'Order ID', type: String }],
    body: TransitionStatusBodyDto,
    created: OrderDto,
  })
  transitionStatus(
    @Param('id') id: string,
    @Body() data: TransitionStatusBodyDto,
  ) {
    return this.orderService.transitionStatus(id, data);
  }

  @Get()
  @ApiDoc({
    summary: 'List orders for an organization',
    description: 'Paginated list of orders with its items.',
    ok: [OrderWithItemsDto],
    queries: appendToPaginationQuery([
      { name: 'withItems', description: 'Include Order Items', type: Boolean },
      {
        name: 'status',
        description: 'Filter by status (default ALL)',
        type: String,
        enum: Object.values(OrderStatus),
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
  @ApiDoc({
    summary: 'Get Order',
    description: 'Get an Order by ID',
    params: [{ name: 'id', type: String, in: 'path' }],
    ok: OrderDto,
  })
  getOrder(@CurrentOrganization() org: CurrentOrg, @Param('id') id: string) {
    return this.orderService.getOrderById(org.organizationId, id);
  }

  @Patch(':id')
  @Authorized('ADMIN', 'MANAGER')
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
  @Authorized('ADMIN')
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
  @Authorized('ADMIN', 'MANAGER')
  createOrderItem(@Param('id') id: string) {
    return 'creating order item with id ' + id;
  }

  @Patch(':id/items/:itemId')
  @Authorized('ADMIN', 'MANAGER')
  updateOrderItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return `updating item with id ${id} and itemId ${itemId}`;
  }

  @Delete(':id/items/:itemId')
  @Authorized('ADMIN')
  deleteOrderItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return `deleting item with id ${id} and itemId ${itemId}`;
  }
}
