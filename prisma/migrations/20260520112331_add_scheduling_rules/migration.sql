-- CreateTable
CREATE TABLE "scheduling_rules" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "post24_min_rest_days" INTEGER NOT NULL DEFAULT 1,
    "block_night_before24" BOOLEAN NOT NULL DEFAULT true,
    "block_long_day_before24" BOOLEAN NOT NULL DEFAULT false,
    "max_consecutive_long_day" INTEGER NOT NULL DEFAULT 3,
    "max_consecutive_night" INTEGER NOT NULL DEFAULT 3,
    "max_consecutive_off_days" INTEGER NOT NULL DEFAULT 3,
    "min_days_off_per_month" INTEGER NOT NULL DEFAULT 4,
    "require_senior_on_day_band" BOOLEAN NOT NULL DEFAULT true,
    "require_senior_on_night_band" BOOLEAN NOT NULL DEFAULT true,
    "ft_default_target_hours" INTEGER NOT NULL DEFAULT 240,
    "half_time_default_target_hours" INTEGER NOT NULL DEFAULT 120,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_rules_pkey" PRIMARY KEY ("id")
);
