/*
  Warnings:

  - A unique constraint covering the columns `[id,organizationId]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Order_id_organizationId_key" ON "Order"("id", "organizationId");
