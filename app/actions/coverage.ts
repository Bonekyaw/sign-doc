"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { coverageTag, scheduleTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";
import { parseDateKey } from "@/lib/scheduling/dates";
import { validateCoverageTargetValues } from "@/lib/scheduling/constants";
import {
  coverageTargetSchema,
  dailyCoverageSchema,
  monthCoverageSchema,
} from "@/lib/schemas/coverage";

function assertCoverageTargets(dayShiftTarget: number, nightShiftTarget: number) {
  const err = validateCoverageTargetValues(dayShiftTarget, nightShiftTarget);
  if (err) throw new Error(err);
}

export async function getMonthSettings(year: number, month: number) {
  return prisma.monthSettings.findUnique({
    where: { year_month: { year, month } },
  });
}

export async function setMonthDefaults(
  year: number,
  month: number,
  dayShiftTarget: number,
  nightShiftTarget: number,
) {
  const parsed = monthCoverageSchema.safeParse({
    year,
    month,
    dayShiftTarget,
    nightShiftTarget,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid coverage.");
  }
  assertCoverageTargets(dayShiftTarget, nightShiftTarget);

  await prisma.monthSettings.upsert({
    where: { year_month: { year, month } },
    create: { year, month, dayShiftTarget, nightShiftTarget },
    update: { dayShiftTarget, nightShiftTarget },
  });
  revalidatePath("/settings/coverage");
  revalidatePath("/schedule");
  revalidatePath("/");
  revalidateTag(coverageTag(year, month), "max");
  revalidateTag(scheduleTag(year, month), "max");
}

export async function setDailyCoverage(
  dateStr: string,
  dayShiftTarget: number,
  nightShiftTarget: number,
) {
  const parsed = dailyCoverageSchema.safeParse({
    dateStr,
    dayShiftTarget,
    nightShiftTarget,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid coverage.");
  }
  assertCoverageTargets(dayShiftTarget, nightShiftTarget);

  const date = parseDateKey(dateStr);
  await prisma.dailyCoverage.upsert({
    where: { date },
    create: { date, dayShiftTarget, nightShiftTarget },
    update: { dayShiftTarget, nightShiftTarget },
  });
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  revalidatePath("/settings/coverage");
  revalidatePath("/schedule");
  revalidatePath("/");
  revalidateTag(coverageTag(year, month), "max");
  revalidateTag(scheduleTag(year, month), "max");
}

export async function clearDailyCoverage(dateStr: string) {
  const date = parseDateKey(dateStr);
  await prisma.dailyCoverage.deleteMany({ where: { date } });
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  revalidatePath("/settings/coverage");
  revalidatePath("/schedule");
  revalidateTag(coverageTag(year, month), "max");
  revalidateTag(scheduleTag(year, month), "max");
}
