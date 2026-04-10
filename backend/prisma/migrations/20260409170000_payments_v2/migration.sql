-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'FAILED', 'PAID');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'REQUESTED', 'PENDING', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_ATTEMPT_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_PAID';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_REOPEN_VOIDED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_REFUND_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_REFUNDED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_REFUND_FAILED';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'PAYMENT';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod",
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
    "amountCents" INTEGER NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL DEFAULT 'CAD',
    "stripeRefundId" VARCHAR(100),
    "paidAt" TIMESTAMP(3),
    "refundRequestedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "refundFailedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "lastPaymentFailure" TEXT,
    "lastRefundFailure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "stripePaymentIntentId" VARCHAR(100) NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "clientSecret" VARCHAR(255) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "lastFailure" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookReceipt" (
    "id" TEXT NOT NULL,
    "stripeEventId" VARCHAR(255) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "StripeWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- Backfill fulfilled historical orders.
INSERT INTO "Payment" (
    "id",
    "organizationId",
    "orderId",
    "paymentStatus",
    "refundStatus",
    "amountCents",
    "currencyCode",
    "paidAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'pay_' || "id",
    "organizationId",
    "id",
    'PAID'::"PaymentStatus",
    'NONE'::"RefundStatus",
    "totalCents",
    'CAD',
    COALESCE("placedAt", "createdAt"),
    "createdAt",
    "updatedAt"
FROM "Order"
WHERE "status" = 'FULFILLED'::"OrderStatus";

-- Backfill confirmed historical orders.
INSERT INTO "Payment" (
    "id",
    "organizationId",
    "orderId",
    "paymentStatus",
    "refundStatus",
    "amountCents",
    "currencyCode",
    "createdAt",
    "updatedAt"
)
SELECT
    'pay_' || "id",
    "organizationId",
    "id",
    'UNPAID'::"PaymentStatus",
    'NONE'::"RefundStatus",
    "totalCents",
    'CAD',
    "createdAt",
    "updatedAt"
FROM "Order"
WHERE "status" = 'CONFIRMED'::"OrderStatus";

-- Backfill cancelled orders that had previously been confirmed.
INSERT INTO "Payment" (
    "id",
    "organizationId",
    "orderId",
    "paymentStatus",
    "refundStatus",
    "amountCents",
    "currencyCode",
    "createdAt",
    "updatedAt"
)
SELECT
    'pay_' || "id",
    "organizationId",
    "id",
    'UNPAID'::"PaymentStatus",
    'NONE'::"RefundStatus",
    "totalCents",
    'CAD',
    "createdAt",
    "updatedAt"
FROM "Order"
WHERE "status" = 'CANCELLED'::"OrderStatus"
  AND "placedAt" IS NOT NULL;

-- Backfill legacy refunded orders before removing REFUNDED from OrderStatus.
INSERT INTO "Payment" (
    "id",
    "organizationId",
    "orderId",
    "paymentStatus",
    "refundStatus",
    "amountCents",
    "currencyCode",
    "paidAt",
    "refundedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'pay_' || "id",
    "organizationId",
    "id",
    'PAID'::"PaymentStatus",
    'REFUNDED'::"RefundStatus",
    "totalCents",
    'CAD',
    COALESCE("placedAt", "createdAt"),
    COALESCE("updatedAt", "createdAt"),
    "createdAt",
    "updatedAt"
FROM "Order"
WHERE "status" = 'REFUNDED'::"OrderStatus";

-- Normalize refunded orders into the new lifecycle before removing REFUNDED.
UPDATE "Order"
SET "status" = 'FULFILLED'::"OrderStatus",
    "cancelledAt" = NULL
WHERE "status" = 'REFUNDED'::"OrderStatus";

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'FULFILLED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeRefundId_key" ON "Payment"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_createdAt_idx" ON "Payment"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paymentStatus_idx" ON "Payment"("organizationId", "paymentStatus");

-- CreateIndex
CREATE INDEX "Payment_organizationId_refundStatus_idx" ON "Payment"("organizationId", "refundStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_stripePaymentIntentId_key" ON "PaymentAttempt"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_paymentId_createdAt_idx" ON "PaymentAttempt"("paymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookReceipt_stripeEventId_key" ON "StripeWebhookReceipt"("stripeEventId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
