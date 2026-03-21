import { OrderStatus } from '@prisma/generated/enums';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';
import { PaginationOptionsQueryParamDto } from '@src/common/dto/pagination.dto';
import { BadRequestException } from '@nestjs/common';

/**
 * Order
 */
export class OrderDto {
  @IsUUID('loose')
  @IsString()
  id: string;

  @IsUUID('loose')
  @IsString()
  organizationId: string;

  @IsUUID('loose')
  @IsString()
  @IsOptional()
  customerId?: string | null;

  @IsUUID('loose')
  @IsString()
  @IsOptional()
  locationId?: string | null;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsInt()
  @Type(() => Number)
  subtotalCents: number;

  @IsInt()
  @Type(() => Number)
  taxCents: number;

  @IsInt()
  @Type(() => Number)
  discountCents: number;

  @IsInt()
  @Type(() => Number)
  totalCents: number;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;

  @IsDate()
  @IsOptional()
  placedAt?: Date | null;

  @IsDate()
  @IsOptional()
  cancelledAt?: Date | null;
}

export class OrderItemDto {
  @IsUUID('loose')
  id: string;

  @IsUUID('loose')
  orderId: string;

  @IsUUID('loose')
  productId: string;

  @IsString()
  productName: string;

  @IsString()
  @IsOptional()
  sku?: string | null;

  @IsInt()
  @Type(() => Number)
  qty: number;

  @IsInt()
  @Type(() => Number)
  unitPriceCents: number;

  @IsInt()
  @Type(() => Number)
  lineSubtotalCents: number; // qty * unitPriceCents

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  discountCents: number = 0;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  taxCents: number = 0;

  @IsInt()
  @Type(() => Number)
  lineTotalCents: number; // lineSubtotalCents - discountCents + taxCents
}

export class OrderWithItemsDto extends OrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  items: OrderItemDto[];
}

export class CreateOrderItemDto extends OmitType(OrderItemDto, [
  'id',
  'orderId',
  'lineSubtotalCents',
  'lineTotalCents',
  'unitPriceCents',
  'productName',
  'sku',
]) {}

export class CreateOrderDto extends PickType(OrderDto, [
  'customerId',
  'locationId',
]) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  orderItems: CreateOrderItemDto[];
}

export class TransitionStatusBodyDto {
  @IsEnum(OrderStatus)
  @ApiProperty({ enum: OrderStatus })
  toStatus: OrderStatus;
}

export class GetOrdersQueryDto extends PaginationOptionsQueryParamDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  @ApiProperty({ enum: OrderStatus })
  status?: OrderStatus = undefined;

  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined) return false;
    if (typeof value === 'boolean') return value;

    return value === 'true';
  })
  @IsOptional()
  withItems: boolean = false;
}

export class UpdateOrderDto extends PickType(OrderDto, [
  'customerId',
  'locationId',
]) {}
