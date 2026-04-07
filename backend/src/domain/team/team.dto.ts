import { ApiProperty } from '@nestjs/swagger';
import { AuditAction, AuditEntityType, MembershipStatus, Role } from '@prisma/generated/enums';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  createPaginatedResponseDto,
  PaginationOptionsQueryParamDto,
} from '@src/common/dto/pagination.dto';

export class TeamLocationDto {
  @IsUUID('loose')
  @IsString()
  id: string;

  @IsString()
  name: string;
}

export class TeamMemberStatsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiProperty({ type: Number })
  activeMembers: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiProperty({ type: Number })
  pendingInvites: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiProperty({ type: Number })
  deactivatedMembers: number;
}

export class TeamMemberListItemDto {
  @IsUUID('loose')
  @IsString()
  membershipId: string;

  @IsUUID('loose')
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  firstName?: string | null;

  @IsOptional()
  @IsString()
  lastName?: string | null;

  @IsString()
  displayName: string;

  @IsEmail()
  email: string;

  @IsEnum(Role)
  @ApiProperty({ enum: Role })
  role: Role;

  @IsEnum(MembershipStatus)
  @ApiProperty({ enum: MembershipStatus })
  status: MembershipStatus;

  @IsOptional()
  @IsDate()
  lastActiveAt?: Date | null;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;

  @IsBoolean()
  hasAllLocations: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamLocationDto)
  locations: TeamLocationDto[];

  @IsBoolean()
  inviteExpired: boolean;

  @IsOptional()
  @IsDate()
  inviteExpiresAt?: Date | null;
}

export class TeamActivityItemDto {
  @IsUUID('loose')
  @IsString()
  id: string;

  @IsEnum(AuditAction)
  @ApiProperty({ enum: AuditAction })
  action: AuditAction;

  @IsEnum(AuditEntityType)
  @ApiProperty({ enum: AuditEntityType })
  entityType: AuditEntityType;

  @IsString()
  entityId: string;

  @IsOptional()
  actor?: unknown;

  @IsOptional()
  beforeJson?: unknown;

  @IsOptional()
  afterJson?: unknown;

  @IsDate()
  createdAt: Date;
}

export class TeamMemberDetailDto extends TeamMemberListItemDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamActivityItemDto)
  activity: TeamActivityItemDto[];
}

export class TeamMembersResponseDto extends createPaginatedResponseDto(
  TeamMemberListItemDto,
) {
  @ValidateNested()
  @Type(() => TeamMemberStatsDto)
  stats: TeamMemberStatsDto;
}

export class GetTeamMembersQueryDto extends PaginationOptionsQueryParamDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  @ApiProperty({ enum: Role, required: false })
  role?: Role;

  @IsOptional()
  @IsEnum(MembershipStatus)
  @ApiProperty({ enum: MembershipStatus, required: false })
  status?: MembershipStatus;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  @ApiProperty({ enum: Role })
  role: Role;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('loose', { each: true })
  locationIds?: string[];
}

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateTeamMemberRoleDto {
  @IsEnum(Role)
  @ApiProperty({ enum: Role })
  role: Role;
}

export class UpdateTeamMemberLocationsDto {
  @IsOptional()
  @IsArray()
  @IsUUID('loose', { each: true })
  locationIds?: string[];
}

export class TeamRoleDto {
  @IsEnum(Role)
  @ApiProperty({ enum: Role })
  role: Role;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({ type: Number })
  tier: number;

  @IsString()
  description: string;

  @IsString()
  summary: string;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiProperty({ type: Number })
  memberCount: number;
}

export class TeamRolesResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamRoleDto)
  data: TeamRoleDto[];
}

export class TeamMutationResponseDto {
  @ValidateNested()
  @Type(() => TeamMemberDetailDto)
  member: TeamMemberDetailDto;

  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  inviteUrl?: string;
}

export enum InviteResolutionStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  INVALID = 'INVALID',
}

export class ResolveInviteDto {
  @IsString()
  token: string;
}

export class AcceptInviteDto extends ResolveInviteDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

export class InvitationResolutionDto {
  @IsEnum(InviteResolutionStatus)
  @ApiProperty({ enum: InviteResolutionStatus })
  status: InviteResolutionStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => TeamMemberDetailDto)
  member?: TeamMemberDetailDto;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsString()
  roleDescription?: string;

  @IsOptional()
  @IsBoolean()
  requiresPassword?: boolean;
}

export class AcceptInviteResponseDto {
  @ValidateNested()
  @Type(() => TeamMemberDetailDto)
  member: TeamMemberDetailDto;

  @IsString()
  message: string;
}
