// ...existing code...
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PickType } from '@nestjs/swagger';
import { createPaginatedResponseDto } from '@src/common/dto/pagination.dto';

export class ProductDto {
  @IsString()
  @IsUUID('loose')
  id: string;

  @IsString()
  @IsUUID('loose')
  organizationId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  category?: string | null;

  @IsString()
  sku: string;

  @IsNumber()
  @Min(0)
  priceCents: number;

  @IsBoolean()
  active: boolean;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}

export class InventoryDto {
  @IsString()
  @IsUUID('loose')
  locationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateProductDto extends PickType(ProductDto, [
  'name',
  'sku',
  'priceCents',
  'category',
] as const) {
  @IsOptional()
  @ValidateNested()
  @Type(() => InventoryDto)
  inventory?: InventoryDto;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  @IsOptional()
  category?: string | null;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceCents?: number;

  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class GetProductsResponseDto extends createPaginatedResponseDto(
  ProductDto,
) {}
