-- CreateEnum
CREATE TYPE "DoctorSeniority" AS ENUM ('SENIOR', 'MID_LEVEL', 'JUNIOR');

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "seniority" "DoctorSeniority" NOT NULL DEFAULT 'MID_LEVEL';
