// ...existing code...
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PickType } from '@nestjs/mapped-types';
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

export class CreateProductDto extends PickType(ProductDto, [
  'name',
  'sku',
  'priceCents',
] as const) {}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

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
