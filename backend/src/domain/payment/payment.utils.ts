import { Payment, PaymentAttempt } from '@prisma/generated/client';
import { PaymentStatus, RefundStatus } from '@prisma/generated/enums';
import {
  FinancialStatus,
  PaymentAttemptSummaryDto,
  PaymentDto,
  PaymentSummaryDto,
} from './payment.dto';

type PaymentWithAttempts = Payment & {
  attempts?: PaymentAttempt[];
};

export function deriveFinancialStatus(
  payment: Pick<Payment, 'paymentStatus' | 'refundStatus'> | null | undefined,
): FinancialStatus {
  if (!payment) {
    return FinancialStatus.NO_PAYMENT;
  }

  if (payment.refundStatus === RefundStatus.REFUNDED) {
    return FinancialStatus.REFUNDED;
  }

  if (payment.refundStatus === RefundStatus.REQUESTED) {
    return FinancialStatus.REFUND_REQUESTED;
  }

  if (payment.refundStatus === RefundStatus.PENDING) {
    return FinancialStatus.REFUND_PENDING;
  }

  if (payment.refundStatus === RefundStatus.FAILED) {
    return FinancialStatus.REFUND_FAILED;
  }

  if (payment.paymentStatus === PaymentStatus.PAID) {
    return FinancialStatus.PAID;
  }

  if (payment.paymentStatus === PaymentStatus.PENDING) {
    return FinancialStatus.PAYMENT_PENDING;
  }

  if (payment.paymentStatus === PaymentStatus.FAILED) {
    return FinancialStatus.PAYMENT_FAILED;
  }

  return FinancialStatus.UNPAID;
}

export function toPaymentAttemptSummaryDto(
  attempt?: PaymentAttempt | null,
): PaymentAttemptSummaryDto | null {
  if (!attempt) {
    return null;
  }

  return {
    id: attempt.id,
    stripePaymentIntentId: attempt.stripePaymentIntentId,
    status: attempt.status,
    lastFailure: attempt.lastFailure,
    createdAt: attempt.createdAt,
    updatedAt: attempt.updatedAt,
  };
}

export function toPaymentSummaryDto(
  payment?: PaymentWithAttempts | null,
): PaymentSummaryDto | null {
  if (!payment) {
    return null;
  }

  return {
    id: payment.id,
    method: payment.method,
    paymentStatus: payment.paymentStatus,
    refundStatus: payment.refundStatus,
    financialStatus: deriveFinancialStatus(payment),
    amountCents: payment.amountCents,
    currencyCode: payment.currencyCode,
    paidAt: payment.paidAt,
    refundRequestedAt: payment.refundRequestedAt,
    refundedAt: payment.refundedAt,
  };
}

export function toPaymentDto(payment: PaymentWithAttempts): PaymentDto {
  const latestAttempt =
    payment.attempts?.length && payment.attempts[0]
      ? toPaymentAttemptSummaryDto(payment.attempts[0])
      : null;

  return {
    ...(toPaymentSummaryDto(payment) as PaymentSummaryDto),
    orderId: payment.orderId,
    organizationId: payment.organizationId,
    stripeRefundId: payment.stripeRefundId,
    refundFailedAt: payment.refundFailedAt,
    refundReason: payment.refundReason,
    lastPaymentFailure: payment.lastPaymentFailure,
    lastRefundFailure: payment.lastRefundFailure,
    latestAttempt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
