-- AlterEnum
ALTER TYPE "ContributionKind" ADD VALUE 'KIT';

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "kits" INTEGER,
ALTER COLUMN "amount" DROP NOT NULL,
ALTER COLUMN "utr" DROP NOT NULL;
