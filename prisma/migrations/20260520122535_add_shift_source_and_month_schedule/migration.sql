-- CreateEnum
CREATE TYPE "ShiftSource" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "MonthScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "source" "ShiftSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "month_schedules" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "MonthScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "month_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "month_schedules_year_month_key" ON "month_schedules"("year", "month");

-- CreateIndex
CREATE INDEX "shifts_date_source_idx" ON "shifts"("date", "source");
