/*
  Warnings:

  - You are about to drop the column `shift_type` on the `shifts` table. All the data in the column will be lost.
  - Added the required column `shift_type_id` to the `shifts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RestrictionType" AS ENUM ('NO_TWENTY_FOUR');

-- AlterTable
ALTER TABLE "shifts" DROP COLUMN "shift_type",
ADD COLUMN     "shift_type_id" TEXT NOT NULL;

-- DropEnum
DROP TYPE "ShiftType";

-- CreateTable
CREATE TABLE "shift_type_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "duration_hours" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shift_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_restrictions" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "type" "RestrictionType" NOT NULL,

    CONSTRAINT "doctor_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_settings" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day_shift_target" INTEGER NOT NULL,
    "night_shift_target" INTEGER NOT NULL,

    CONSTRAINT "month_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_coverage" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "day_shift_target" INTEGER NOT NULL,
    "night_shift_target" INTEGER NOT NULL,

    CONSTRAINT "daily_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_type_configs_code_key" ON "shift_type_configs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_restrictions_doctor_id_type_key" ON "doctor_restrictions"("doctor_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "month_settings_year_month_key" ON "month_settings"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "daily_coverage_date_key" ON "daily_coverage"("date");

-- CreateIndex
CREATE INDEX "shifts_date_shift_type_id_idx" ON "shifts"("date", "shift_type_id");

-- AddForeignKey
ALTER TABLE "doctor_restrictions" ADD CONSTRAINT "doctor_restrictions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_shift_type_id_fkey" FOREIGN KEY ("shift_type_id") REFERENCES "shift_type_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
