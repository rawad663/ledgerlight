import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

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
