import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDate,
  IsEmail,
  IsUUID,
  IsArray,
  ValidateNested,
  Max,
  Min,
} from 'class-validator';
import { CustomerStatus } from '@prisma/generated/client';
import { PickType } from '@nestjs/mapped-types';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class CustomersDto {
  @IsString()
  @IsUUID('loose')
  id: string;

  @IsString()
  @IsUUID('loose')
  organizationId: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone: string | null;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;

  @IsEnum(CustomerStatus)
  status: CustomerStatus;

  @IsOptional()
  @IsString()
  internalNote: string | null;
}

export class CreateCustomerDto extends PickType(CustomersDto, [
  'name',
  'email',
  'phone',
  'internalNote',
] as const) {}

export class GetCustomersQueryParamDto {
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

export class GetCustomersResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomersDto)
  data: CustomersDto[];

  @IsString()
  @IsOptional()
  nextCursor?: string;

  @IsNumber()
  totalCount: number;
}
