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
import {
  CurrentOrganization,
  type CurrentOrg,
} from '@src/common/decorators/current-org.decorator';
import { InventoryService } from './inventory.service';
import { CreateAdjustmentBodyDto, GetLevelsQueryDto } from './inventory.dto';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { type UserWithMemberships } from '../auth/strategies/jwt.strategy';

@Controller('inventory')
@OrgProtected()
@ApiTags('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('levels')
  getLevels(@Query() query: GetLevelsQueryDto) {
    return this.inventoryService.getLevels(query);
  }

  @Post('/adjustments')
  @Authorized('ADMIN', 'MANAGER')
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
