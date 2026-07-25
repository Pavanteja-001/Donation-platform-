-- CreateEnum
CREATE TYPE "NeedType" AS ENUM ('MONEY', 'BLOOD', 'KIT', 'GOODS', 'MEAL_SLOT', 'SKILL_REQUEST', 'QUESTION');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('NORMAL', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "NeedStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'LIVE', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Need" (
    "id" TEXT NOT NULL,
    "type" "NeedType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "postedById" TEXT NOT NULL,
    "status" "NeedStatus" NOT NULL DEFAULT 'DRAFT',
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMAL',
    "city" TEXT,
    "area" TEXT,
    "linkedInstitutionId" TEXT,
    "adminVerified" BOOLEAN NOT NULL DEFAULT false,
    "institutionVerified" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Need_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Need_status_urgency_idx" ON "Need"("status", "urgency");

-- CreateIndex
CREATE INDEX "Need_postedById_idx" ON "Need"("postedById");

-- AddForeignKey
ALTER TABLE "Need" ADD CONSTRAINT "Need_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Need" ADD CONSTRAINT "Need_linkedInstitutionId_fkey" FOREIGN KEY ("linkedInstitutionId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
