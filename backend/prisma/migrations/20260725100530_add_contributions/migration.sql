-- CreateEnum
CREATE TYPE "ContributionKind" AS ENUM ('MONEY');

-- CreateEnum
CREATE TYPE "ContributionStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "Need" ADD COLUMN     "deadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "needId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "kind" "ContributionKind" NOT NULL DEFAULT 'MONEY',
    "amount" INTEGER NOT NULL,
    "status" "ContributionStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "utr" TEXT NOT NULL,
    "proofUrl" TEXT,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_utr_key" ON "Contribution"("utr");

-- CreateIndex
CREATE INDEX "Contribution_needId_idx" ON "Contribution"("needId");

-- CreateIndex
CREATE INDEX "Contribution_donorId_idx" ON "Contribution"("donorId");

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_needId_fkey" FOREIGN KEY ("needId") REFERENCES "Need"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
