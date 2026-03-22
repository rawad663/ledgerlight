-- 1) Add nullable column first
ALTER TABLE "OrderItem" ADD COLUMN "organizationId" TEXT;

-- 2) Backfill from parent Order
UPDATE "OrderItem" oi
SET "organizationId" = o."organizationId"
FROM "Order" o
WHERE oi."orderId" = o."id";

-- 3) Sanity check (optional; comment out in deploy)
-- SELECT count(*) AS null_org_items FROM "OrderItem" WHERE "organizationId" IS NULL;

-- 4) Make it required
ALTER TABLE "OrderItem" ALTER COLUMN "organizationId" SET NOT NULL;

-- 5) Drop previous single-column FK to Order (name may differ; verify in DB)
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_orderId_fkey";

-- 6) Helpful index for joins
CREATE INDEX IF NOT EXISTS "OrderItem_organizationId_orderId_idx"
ON "OrderItem" ("organizationId", "orderId");

-- 7) Add composite FK to Order(id, organizationId)
ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_orderId_organizationId_fkey"
FOREIGN KEY ("orderId", "organizationId")
REFERENCES "Order"("id", "organizationId")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 8) (Optional) If you added a composite unique in the schema, ensure it exists.
-- Note: since "id" is already the PK, this unique is redundant functionally.
-- ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_id_organizationId_key" UNIQUE ("id","organizationId");