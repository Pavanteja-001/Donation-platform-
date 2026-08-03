-- CreateEnum
CREATE TYPE "EventMode" AS ENUM ('OFFLINE', 'ONLINE');

-- CreateTable
CREATE TABLE "Helpline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "iconUrl" TEXT,
    "iconKey" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Helpline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessStory" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "beneficiaryName" TEXT,
    "relatedNeedId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuccessStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventType" TEXT,
    "mode" "EventMode" NOT NULL DEFAULT 'OFFLINE',
    "location" TEXT,
    "address" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "bannerUrl" TEXT,
    "iconUrl" TEXT,
    "registrationUrl" TEXT,
    "contactPhone" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Helpline_isActive_sortOrder_idx" ON "Helpline"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "SuccessStory_isPublished_sortOrder_publishedAt_idx" ON "SuccessStory"("isPublished", "sortOrder", "publishedAt");

-- CreateIndex
CREATE INDEX "PlatformEvent_isPublished_startsAt_idx" ON "PlatformEvent"("isPublished", "startsAt");

-- AddForeignKey
ALTER TABLE "SuccessStory" ADD CONSTRAINT "SuccessStory_relatedNeedId_fkey" FOREIGN KEY ("relatedNeedId") REFERENCES "Need"("id") ON DELETE SET NULL ON UPDATE CASCADE;

