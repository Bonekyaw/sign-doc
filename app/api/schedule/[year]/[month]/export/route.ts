import { NextResponse } from "next/server";
import { requireAdminRead } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { monthDateRange } from "@/lib/scheduling/context";
import { buildScheduleWorkbook } from "@/lib/scheduling/export-excel";
import type { ShiftCode } from "@/lib/scheduling/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ year: string; month: string }> },
) {
  await requireAdminRead();
  const { year: yearStr, month: monthStr } = await context.params;
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month." }, { status: 400 });
  }

  const { start, end } = monthDateRange(year, month);
  const [doctors, shifts] = await Promise.all([
    prisma.doctor.findMany({ orderBy: { name: "asc" } }),
    prisma.shift.findMany({
      where: { date: { gte: start, lte: end } },
      include: { shiftType: true },
    }),
  ]);

  const buffer = await buildScheduleWorkbook({
    year,
    month,
    doctors: doctors.map((d) => ({
      id: d.id,
      name: d.name,
      seniority: d.seniority,
      targetHours: d.targetMonthlyHours,
    })),
    assignments: shifts.map((s) => ({
      doctorId: s.doctorId,
      dateKey: s.date.toISOString().slice(0, 10),
      shiftCode: s.shiftType.code as ShiftCode,
      source: s.source,
    })),
  });

  const filename = `schedule-${year}-${String(month).padStart(2, "0")}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
