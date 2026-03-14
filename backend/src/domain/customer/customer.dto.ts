import {
  IsEnum,
  IsOptional,
  IsString,
  IsDate,
  IsEmail,
  IsUUID,
} from 'class-validator';
import { CustomerStatus } from '@prisma/generated/client';
import { PickType } from '@nestjs/mapped-types';
import { createPaginatedResponseDto } from '@src/common/dto/pagination.dto';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class CustomerDto {
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

export class CreateCustomerDto extends PickType(CustomerDto, [
  'name',
  'email',
  'phone',
  'internalNote',
] as const) {}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone: string | null;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status: CustomerStatus;

  @IsOptional()
  @IsString()
  internalNote: string | null;
}

export class GetCustomersResponseDto extends createPaginatedResponseDto(
  CustomerDto,
) {}
