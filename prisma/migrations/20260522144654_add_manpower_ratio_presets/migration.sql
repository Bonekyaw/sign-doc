-- CreateTable
CREATE TABLE "manpower_ratio_presets" (
    "id" TEXT NOT NULL,
    "day_shift_target" INTEGER NOT NULL,
    "night_shift_target" INTEGER NOT NULL,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manpower_ratio_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manpower_ratio_presets_day_shift_target_night_shift_target_key" ON "manpower_ratio_presets"("day_shift_target", "night_shift_target");
