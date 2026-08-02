-- CreateEnum
CREATE TYPE "NeedCategory" AS ENUM ('MEDICAL', 'BLOOD', 'EDUCATION', 'DONATE_ITEMS', 'WOMEN_EMPOWERMENT', 'ANIMALS', 'DISASTER_RELIEF', 'INTERNSHIP', 'SCRIBES', 'ORPHANAGES');

-- AlterTable
ALTER TABLE "Need" ADD COLUMN "category" "NeedCategory";

-- Backfill ONLY where exactly one cause can produce that type.
-- MONEY / KIT / SKILL_REQUEST are left null on purpose: each spans several causes, and guessing
-- the commonest one would show donors a category the poster never chose.
UPDATE "Need" SET "category" = 'BLOOD'        WHERE "type" = 'BLOOD';
UPDATE "Need" SET "category" = 'ORPHANAGES'   WHERE "type" = 'MEAL_SLOT';
-- GOODS predates DISASTER_RELIEF existing, so every historical row came from the donate-items flow.
UPDATE "Need" SET "category" = 'DONATE_ITEMS' WHERE "type" = 'GOODS';

-- Category browsing filters on (category, status); the existing indexes all lead with status.
CREATE INDEX "Need_category_status_idx" ON "Need"("category", "status");
