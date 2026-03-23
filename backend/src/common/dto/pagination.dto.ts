import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
export class PaginationOptionsQueryParamDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  @Min(1)
  limit: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Provide a constructor type
type ClassConstructor<T> = new (...args: any[]) => T;

// Factory that returns an abstract paginated response class for the given item DTO
export function createPaginatedResponseDto<T>(ItemDto: ClassConstructor<T>) {
  abstract class PaginatedResponseDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ItemDto)
    @ApiProperty({ type: [ItemDto] })
    data: T[];

    @IsString()
    @IsOptional()
    nextCursor?: string;

    @IsNumber()
    totalCount: number;
  }

  return PaginatedResponseDto;
}
