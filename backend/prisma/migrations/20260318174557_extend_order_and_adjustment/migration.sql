/*
  Warnings:

  - The `reason` column on the `InventoryAdjustment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `productName` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InventoryAjustmentReason" AS ENUM ('MANUAL', 'RESTOCK', 'SALE', 'RETURN', 'SHRINKAGE', 'COUNT_CORRECTION', 'INITIAL_STOCK');

-- AlterTable
ALTER TABLE "InventoryAdjustment" DROP COLUMN "reason",
ADD COLUMN     "reason" "InventoryAjustmentReason" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "placedAt" TIMESTAMP(3),
ADD COLUMN     "subtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lineSubtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lineTotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productName" TEXT NOT NULL,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
