import { ApiProperty } from '@nestjs/swagger';
import { AuditAction, AuditEntityType } from '@prisma/generated/enums';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  createPaginatedResponseDto,
  PaginationOptionsQueryParamDto,
} from '@src/common/dto/pagination.dto';

export class AuditLogActorDto {
  @IsUUID('loose')
  id: string;

  @IsOptional()
  @IsString()
  firstName?: string | null;

  @IsOptional()
  @IsString()
  lastName?: string | null;

  @IsString()
  email: string;
}

export class AuditLogDto {
  @IsUUID('loose')
  id: string;

  @IsUUID('loose')
  organizationId: string;

  @IsOptional()
  @IsUUID('loose')
  actorUserId?: string | null;

  @ApiProperty({ enum: AuditEntityType })
  @IsEnum(AuditEntityType)
  entityType: AuditEntityType;

  @IsString()
  entityId: string;

  @ApiProperty({ enum: AuditAction })
  @IsEnum(AuditAction)
  action: AuditAction;

  @IsOptional()
  beforeJson?: unknown;

  @IsOptional()
  afterJson?: unknown;

  @IsOptional()
  @IsString()
  requestId?: string | null;

  @IsOptional()
  @IsString()
  ip?: string | null;

  @IsOptional()
  @IsString()
  userAgent?: string | null;

  @IsDate()
  createdAt: Date;

  @ValidateNested()
  @Type(() => AuditLogActorDto)
  @IsOptional()
  @ApiProperty({ type: AuditLogActorDto, nullable: true })
  actor?: AuditLogActorDto | null;
}

export class GetAuditLogsQueryDto extends PaginationOptionsQueryParamDto {
  @IsEnum(AuditEntityType)
  @IsOptional()
  @ApiProperty({ enum: AuditEntityType })
  entityType?: AuditEntityType;

  @IsString()
  @IsOptional()
  entityId?: string;
}

export class GetAuditLogsResponseDto extends createPaginatedResponseDto(
  AuditLogDto,
) {}
