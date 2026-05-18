-- CreateEnum
CREATE TYPE "RotationStepType" AS ENUM ('L', 'N', 'TWENTY_FOUR', 'OFF');

-- CreateTable
CREATE TABLE "rotation_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "rotation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotation_template_steps" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "step_type" "RotationStepType" NOT NULL,

    CONSTRAINT "rotation_template_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_rotations" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "start_offset" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "doctor_rotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rotation_template_steps_template_id_sort_order_key" ON "rotation_template_steps"("template_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_rotations_doctor_id_key" ON "doctor_rotations"("doctor_id");

-- AddForeignKey
ALTER TABLE "rotation_template_steps" ADD CONSTRAINT "rotation_template_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "rotation_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_rotations" ADD CONSTRAINT "doctor_rotations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_rotations" ADD CONSTRAINT "doctor_rotations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "rotation_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
