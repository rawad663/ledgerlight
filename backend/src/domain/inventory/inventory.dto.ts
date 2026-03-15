import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { OmitType, PickType } from '@nestjs/mapped-types';
import {
  createPaginatedResponseDto,
  PaginationOptionsQueryParamDto,
} from '@src/common/dto/pagination.dto';
import { ProductDto } from '@src/domain/product/product.dto';
import { LocationDto } from '@src/domain/location/location.dto';

/**
 * Inventory Levels
 */
export class InventoryLevelDto {
  @IsString()
  @IsUUID('loose')
  id: string;

  @IsString()
  @IsUUID('loose')
  productId: string;

  @IsString()
  @IsUUID('loose')
  locationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  @IsDate()
  updatedAt: Date;
}

export class GetLevelsQueryDto extends PaginationOptionsQueryParamDto {
  @IsOptional()
  @IsUUID('loose')
  @IsString()
  productId?: string;

  @IsOptional()
  @IsUUID('loose')
  @IsString()
  locationId?: string;
}

export class CreateInventoryLevelDto extends PickType(InventoryLevelDto, [
  'productId',
  'locationId',
  'quantity',
] as const) {}

export class UpdateInventoryLevelDto {
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;
}

export class InventoryLevelsDataDto extends OmitType(InventoryLevelDto, [
  'productId',
  'locationId',
]) {
  @ValidateNested()
  product: ProductDto;
  location: LocationDto;
}

export class GetInventoryLevelsResponseDto extends createPaginatedResponseDto(
  InventoryLevelsDataDto,
) {}

/**
 * Inventory Adjustments
 */
export class InventoryAdjustmentDto {
  @IsString()
  @IsUUID('loose')
  id: string;

  @IsString()
  @IsUUID('loose')
  organizationId: string;

  @IsString()
  @IsUUID('loose')
  productId: string;

  @IsString()
  @IsUUID('loose')
  locationId: string;

  @IsString()
  @IsOptional()
  @IsUUID('loose')
  actorUserId?: string;

  @IsNumber()
  @Type(() => Number)
  delta: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsDate()
  createdAt: Date;
}

export class CreateAdjustmentBodyDto extends PickType(InventoryAdjustmentDto, [
  'productId',
  'locationId',
  'delta',
  'reason',
  'note',
]) {}
