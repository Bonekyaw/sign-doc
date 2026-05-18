import { prisma } from "@/lib/db";
import {
  getDailyCoverageOverrides,
  getMonthCoverageDefaults,
  loadDoctors,
} from "@/lib/scheduling/context";
import { getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import type { ShiftAssignment } from "@/lib/scheduling/types";

export type DashboardStats = {
  doctorCount: number;
  underCoveredDays: number;
  overHours: number;
  totalShifts: number;
};

export async function fetchDashboardStats(
  year: number,
  month: number,
): Promise<DashboardStats> {
  const monthKeys = getMonthDateKeys(year, month);
  const start = parseDateKey(monthKeys[0]);
  const end = parseDateKey(monthKeys[monthKeys.length - 1]);

  const [doctorCount, shiftRows, doctors, monthDefaults, dailyOverrides] =
    await Promise.all([
      prisma.doctor.count(),
      prisma.shift.findMany({
        where: { date: { gte: start, lte: end } },
        include: { shiftType: true },
      }),
      loadDoctors(),
      getMonthCoverageDefaults(year, month),
      getDailyCoverageOverrides(year, month),
    ]);

  const shifts: ShiftAssignment[] = shiftRows.map((s) => ({
    doctorId: s.doctorId,
    date: s.date,
    shiftCode: s.shiftType.code as ShiftAssignment["shiftCode"],
    durationHours: s.shiftType.durationHours,
  }));

  let underCoveredDays = 0;
  for (const key of monthKeys) {
    const target = dailyOverrides.get(key) ?? monthDefaults;
    const date = parseDateKey(key);
    const lCount = countBandForDate(date, "L", shifts);
    const nCount = countBandForDate(date, "N", shifts);
    if (lCount < target.dayShiftTarget || nCount < target.nightShiftTarget) {
      underCoveredDays++;
    }
  }

  const overHours = doctors.filter(
    (d) => computeMonthlyHours(d.id, monthKeys, shifts) > d.targetHours,
  ).length;

  return {
    doctorCount,
    underCoveredDays,
    overHours,
    totalShifts: shiftRows.length,
  };
}
