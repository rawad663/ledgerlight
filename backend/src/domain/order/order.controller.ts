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
  getOrder(@Param('id') id: string) {
    return `orders with id ${id}`;
  }

  @Patch(':id')
  @Authorized('ADMIN', 'MANAGER')
  updateOrder(@Param('id') id: string) {
    return `ONLY METADATA update orders with id ${id}`;
  }

  @Delete(':id')
  @Authorized('ADMIN')
  deleteOrder(@Param('id') id: string) {
    return `delete order with id ${id}`;
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
