-- CreateEnum
CREATE TYPE "DoctorType" AS ENUM ('FT', 'HALF_TIME', 'PT');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('L', 'N', 'TWENTY_FOUR');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DoctorType" NOT NULL,
    "target_hours" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift_type" "ShiftType" NOT NULL,
    "doctor_id" TEXT NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_date_idx" ON "shifts"("date");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_doctor_id_date_key" ON "shifts"("doctor_id", "date");

-- CreateIndex
CREATE INDEX "leave_requests_date_status_idx" ON "leave_requests"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_doctor_id_date_key" ON "leave_requests"("doctor_id", "date");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
