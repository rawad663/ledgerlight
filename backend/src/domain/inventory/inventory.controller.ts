import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  Authorized,
  OrgProtected,
} from '@src/common/decorators/auth.decorator';
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { InventoryService } from './inventory.service';
import {
  AggregatedInventoryItemDto,
  CreateAdjustmentBodyDto,
  CreateAdjustmentResponseDto,
  GetInventoryLevelsResponseDto,
  GetLevelsQueryDto,
} from './inventory.dto';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { type UserWithMemberships } from '../auth/strategies/jwt.strategy';
import {
  ApiDoc,
  appendToPaginationQuery,
} from '@src/common/swagger/api-doc.decorator';

@Controller('inventory')
@OrgProtected()
@ApiTags('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiDoc({
    summary: 'Get aggregated inventory',
    description:
      'Returns total quantity per product and breakdown by locations for the active organization.',
    ok: [AggregatedInventoryItemDto],
  })
  getInventory(@CurrentOrganization() org: CurrentOrg) {
    return this.inventoryService.getInventory(org.organizationId);
  }

  @Get('levels')
  @ApiDoc({
    summary: 'List inventory levels',
    description:
      'Paginated list of inventory levels with product and location.',
    ok: GetInventoryLevelsResponseDto,
    queries: appendToPaginationQuery([
      { name: 'productId', description: 'Filter by product ID', type: String },
      {
        name: 'locationId',
        description: 'Filter by location ID',
        type: String,
      },
    ]),
  })
  getLevels(@Query() query: GetLevelsQueryDto) {
    return this.inventoryService.getLevels(query);
  }

  @Post('/adjustments')
  @Authorized('ADMIN', 'MANAGER')
  @ApiDoc({
    summary: 'Create inventory adjustment',
    description:
      'Adjust inventory level for a product at a location. Positive delta restocks; negative delta reduces stock.',
    body: CreateAdjustmentBodyDto,
    ok: CreateAdjustmentResponseDto,
    badRequestDesc: 'Attempting to reduce product stock below zero',
  })
  createAdjustment(
    @CurrentUser() user: UserWithMemberships,
    @CurrentOrganization() org: CurrentOrg,
    @Body() adjustmentData: CreateAdjustmentBodyDto,
  ) {
    return this.inventoryService.createAdjustment({
      organizationId: org.organizationId,
      actorUserId: user.id,
      ...adjustmentData,
    });
  }

  /**
   * We do not need to expose routes for creating, updating, and deleting Inventory Levels.
   * The auditable way is to go through Inventory Adjustments which in term will handle the modification of Levels.
   *
   * On Product creation, we must create an associated Inventory Level to go with it. This must be done in this system
   * to guarantee synchronicity between Product and its Inventory Level.
   **/
}
