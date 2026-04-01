import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DashboardSalesTimeline {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class DashboardSummaryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  todaysSalesCents: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordersTodayCount: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockItemsCount: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  activeCustomersCount: number;
}

export class DashboardSalesOverviewQueryDto {
  @ApiProperty({
    enum: DashboardSalesTimeline,
    default: DashboardSalesTimeline.WEEK,
  })
  @IsEnum(DashboardSalesTimeline)
  timeline: DashboardSalesTimeline = DashboardSalesTimeline.WEEK;

  @ApiProperty({
    required: false,
    description:
      'Optional ISO anchor datetime used to resolve the requested calendar period.',
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  anchor?: string;
}

export class DashboardSalesBucketDto {
  @IsDate()
  bucketStart: Date;

  @IsDate()
  bucketEnd: Date;

  @IsString()
  label: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  salesCents: number;
}

export class DashboardSalesOverviewDto {
  @ApiProperty({ enum: DashboardSalesTimeline })
  @IsEnum(DashboardSalesTimeline)
  timeline: DashboardSalesTimeline;

  @IsDate()
  anchor: Date;

  @IsDate()
  periodStart: Date;

  @IsDate()
  periodEnd: Date;

  @IsDate()
  previousAnchor: Date;

  @IsDate()
  nextAnchor: Date;

  @IsBoolean()
  isCurrentPeriod: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalSalesCents: number;

  @ValidateNested({ each: true })
  @Type(() => DashboardSalesBucketDto)
  @ApiProperty({ type: [DashboardSalesBucketDto] })
  buckets: DashboardSalesBucketDto[];
}
