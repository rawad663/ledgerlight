-- Step 1 of 2: Add new Role enum values.
--
-- PostgreSQL requires enum ADD VALUE to be committed before the new values
-- can be used in DML (UPDATE, USING casts). This migration only adds the
-- values so they are visible to the next migration.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CASHIER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INVENTORY_CLERK';
