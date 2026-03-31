-- Step 2 of 2: Migrate ADMIN → OWNER and remove ADMIN from the Role enum.
--
-- Runs after 20260331000000 has committed, so 'OWNER' is now a valid value.

-- Migrate any remaining ADMIN memberships to OWNER
UPDATE "Membership" SET role = 'OWNER' WHERE role = 'ADMIN';

-- Recreate the enum without the legacy ADMIN value
-- (PostgreSQL has no ALTER TYPE ... DROP VALUE)
CREATE TYPE "Role_new" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'SUPPORT', 'INVENTORY_CLERK');

ALTER TABLE "Membership"
  ALTER COLUMN "role" TYPE "Role_new"
  USING "role"::text::"Role_new";

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
