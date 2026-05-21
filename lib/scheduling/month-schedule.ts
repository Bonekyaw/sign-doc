import { prisma } from "@/lib/db";
import type { MonthScheduleStatus } from "@/app/generated/prisma/client";

export class MonthNotEditableError extends Error {
  constructor(year: number, month: number) {
    super(`Schedule for ${year}-${month} is published and cannot be edited.`);
    this.name = "MonthNotEditableError";
  }
}

export class MonthNotPublishedError extends Error {
  constructor(year: number, month: number) {
    super(
      `Schedule for ${year}-${month} is not published. Use draft editing instead.`,
    );
    this.name = "MonthNotPublishedError";
  }
}

export async function getOrCreateMonthSchedule(year: number, month: number) {
  return prisma.monthSchedule.upsert({
    where: { year_month: { year, month } },
    create: { year, month, status: "DRAFT" },
    update: {},
  });
}

export async function getMonthScheduleStatus(year: number, month: number) {
  const row = await prisma.monthSchedule.findUnique({
    where: { year_month: { year, month } },
  });
  return row;
}

export async function isMonthPublished(year: number, month: number) {
  const row = await getMonthScheduleStatus(year, month);
  return row?.status === "PUBLISHED";
}

export async function assertMonthEditable(year: number, month: number) {
  const row = await getMonthScheduleStatus(year, month);
  if (row?.status === "PUBLISHED") {
    throw new MonthNotEditableError(year, month);
  }
  if (!row) {
    await getOrCreateMonthSchedule(year, month);
  }
}

export async function assertMonthPublished(year: number, month: number) {
  const row = await getMonthScheduleStatus(year, month);
  if (row?.status !== "PUBLISHED") {
    throw new MonthNotPublishedError(year, month);
  }
}

export async function publishMonthSchedule(
  year: number,
  month: number,
  publishedBy: string,
) {
  return prisma.monthSchedule.upsert({
    where: { year_month: { year, month } },
    create: {
      year,
      month,
      status: "PUBLISHED",
      publishedAt: new Date(),
      publishedBy,
    },
    update: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      publishedBy,
    },
  });
}

export type MonthScheduleMeta = {
  status: MonthScheduleStatus;
  publishedAt: Date | null;
  publishedBy: string | null;
};

export async function getMonthScheduleMeta(
  year: number,
  month: number,
): Promise<MonthScheduleMeta> {
  const row = await getOrCreateMonthSchedule(year, month);
  return {
    status: row.status,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
  };
}
