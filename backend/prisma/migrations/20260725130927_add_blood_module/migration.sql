-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterEnum
ALTER TYPE "ContributionKind" ADD VALUE 'BLOOD';

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "units" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availableToDonate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bloodGroup" "BloodGroup",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "expoPushToken" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "lastDonationDate" TIMESTAMP(3);
