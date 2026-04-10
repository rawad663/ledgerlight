import { ApiProperty } from '@nestjs/swagger';
import {
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from '@prisma/generated/enums';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum FinancialStatus {
  NO_PAYMENT = 'NO_PAYMENT',
  UNPAID = 'UNPAID',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAID = 'PAID',
  REFUND_REQUESTED = 'REFUND_REQUESTED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUND_FAILED = 'REFUND_FAILED',
  REFUNDED = 'REFUNDED',
}

export class PaymentAttemptSummaryDto {
  @IsUUID('loose')
  id: string;

  @IsString()
  stripePaymentIntentId: string;

  @ApiProperty({ enum: PaymentAttemptStatus })
  @IsEnum(PaymentAttemptStatus)
  status: PaymentAttemptStatus;

  @IsOptional()
  @IsString()
  lastFailure?: string | null;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}

export class PaymentSummaryDto {
  @IsUUID('loose')
  id: string;

  @IsOptional()
  @ApiProperty({ enum: PaymentMethod, nullable: true })
  @IsEnum(PaymentMethod)
  method?: PaymentMethod | null;

  @ApiProperty({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  paymentStatus: PaymentStatus;

  @ApiProperty({ enum: RefundStatus })
  @IsEnum(RefundStatus)
  refundStatus: RefundStatus;

  @ApiProperty({ enum: FinancialStatus })
  @IsEnum(FinancialStatus)
  financialStatus: FinancialStatus;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  amountCents: number;

  @IsString()
  @MaxLength(3)
  currencyCode: string;

  @IsOptional()
  @IsDate()
  paidAt?: Date | null;

  @IsOptional()
  @IsDate()
  refundRequestedAt?: Date | null;

  @IsOptional()
  @IsDate()
  refundedAt?: Date | null;
}

export class PaymentDto extends PaymentSummaryDto {
  @IsUUID('loose')
  orderId: string;

  @IsUUID('loose')
  organizationId: string;

  @IsOptional()
  @IsString()
  stripeRefundId?: string | null;

  @IsOptional()
  @IsDate()
  refundFailedAt?: Date | null;

  @IsOptional()
  @IsString()
  refundReason?: string | null;

  @IsOptional()
  @IsString()
  lastPaymentFailure?: string | null;

  @IsOptional()
  @IsString()
  lastRefundFailure?: string | null;

  @ValidateNested()
  @Type(() => PaymentAttemptSummaryDto)
  @IsOptional()
  @ApiProperty({ type: PaymentAttemptSummaryDto, nullable: true })
  latestAttempt?: PaymentAttemptSummaryDto | null;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}

export class CreateCardPaymentResponseDto {
  @IsUUID('loose')
  paymentId: string;

  @IsUUID('loose')
  attemptId: string;

  @IsString()
  clientSecret: string;

  @ApiProperty({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  paymentStatus: PaymentStatus;

  @ApiProperty({ enum: PaymentAttemptStatus })
  @IsEnum(PaymentAttemptStatus)
  attemptStatus: PaymentAttemptStatus;
}

export class RefundPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refundReason: string;
}
