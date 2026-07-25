-- CreateEnum
CREATE TYPE "MealSlotStatus" AS ENUM ('OPEN', 'BOOKED', 'CONFIRMED');

-- AlterEnum
ALTER TYPE "ContributionKind" ADD VALUE 'MEAL_SLOT';

-- CreateTable
CREATE TABLE "MealSlot" (
    "id" TEXT NOT NULL,
    "needId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "MealSlotStatus" NOT NULL DEFAULT 'OPEN',
    "contributionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MealSlot_contributionId_key" ON "MealSlot"("contributionId");

-- CreateIndex
CREATE INDEX "MealSlot_needId_status_idx" ON "MealSlot"("needId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MealSlot_needId_date_key" ON "MealSlot"("needId", "date");

-- AddForeignKey
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_needId_fkey" FOREIGN KEY ("needId") REFERENCES "Need"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
