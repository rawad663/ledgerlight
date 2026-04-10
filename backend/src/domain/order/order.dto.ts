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
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, OmitType, PickType } from '@nestjs/swagger';
import {
  createPaginatedResponseDto,
  PaginationOptionsQueryParamDto,
} from '@src/common/dto/pagination.dto';
import { CustomerDto } from '@src/domain/customer/customer.dto';
import { LocationDto } from '@src/domain/location/location.dto';
import { PaymentSummaryDto } from '@src/domain/payment/payment.dto';

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
  @Min(0)
  subtotalCents: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  taxCents: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  discountCents: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
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

  @ValidateNested()
  @Type(() => PaymentSummaryDto)
  @IsOptional()
  @ApiProperty({ type: PaymentSummaryDto, nullable: true })
  payment?: PaymentSummaryDto | null;
}

export class OrderItemDto {
  @IsUUID('loose')
  id: string;

  @IsUUID('loose')
  orderId: string;

  @IsUUID('loose')
  organizationId: string;

  @IsUUID('loose')
  productId: string;

  @IsString()
  productName: string;

  @IsString()
  @IsOptional()
  sku?: string | null;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  qty: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  unitPriceCents: number;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  lineSubtotalCents: number; // qty * unitPriceCents

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
  discountCents: number = 0;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  @Min(0)
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
  'organizationId',
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

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined) return false;
    if (typeof value === 'boolean') return value;

    return value === 'true';
  })
  @IsOptional()
  withItems: boolean = false;
}

export class GetOrderQueryDto {
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

export class OrderCustomerDto extends PickType(CustomerDto, [
  'id',
  'name',
  'email',
]) {}

export class OrderLocationDto extends PickType(LocationDto, [
  'id',
  'name',
  'addressLine1',
  'city',
  'stateProvince',
  'postalCode',
  'countryCode',
]) {}

export class OrderListItemDto extends OrderDto {
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  @IsOptional()
  @ApiProperty({ type: OrderCustomerDto, nullable: true })
  customer?: OrderCustomerDto | null;

  @ValidateNested()
  @Type(() => OrderLocationDto)
  @IsOptional()
  @ApiProperty({ type: OrderLocationDto, nullable: true })
  location?: OrderLocationDto | null;
}

export class OrderDetailDto extends OrderDto {
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  @IsOptional()
  @ApiProperty({ type: OrderCustomerDto, nullable: true })
  customer?: OrderCustomerDto | null;

  @ValidateNested()
  @Type(() => OrderLocationDto)
  @IsOptional()
  @ApiProperty({ type: OrderLocationDto, nullable: true })
  location?: OrderLocationDto | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @IsOptional()
  @ApiProperty({ type: [OrderItemDto] })
  items?: OrderItemDto[];
}

export class GetOrdersResponseDto extends createPaginatedResponseDto(
  OrderListItemDto,
) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLocationDto)
  @ApiProperty({ type: [OrderLocationDto] })
  locations: OrderLocationDto[];
}
