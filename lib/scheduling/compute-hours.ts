import { dateKey } from "@/lib/scheduling/dates";
import type { ShiftAssignment } from "@/lib/scheduling/types";

export function computeMonthlyHours(
  doctorId: string,
  monthKeys: string[],
  shifts: ShiftAssignment[],
): number {
  const keySet = new Set(monthKeys);
  return shifts
    .filter(
      (s) => s.doctorId === doctorId && keySet.has(dateKey(s.date)),
    )
    .reduce((sum, s) => sum + s.durationHours, 0);
}

export function remainingMonthlyHours(
  doctorId: string,
  targetHours: number,
  monthKeys: string[],
  shifts: ShiftAssignment[],
): number {
  const worked = computeMonthlyHours(doctorId, monthKeys, shifts);
  return Math.max(0, targetHours - worked);
}

export function countDaysOff(
  doctorId: string,
  monthKeys: string[],
  shifts: ShiftAssignment[],
): number {
  const assigned = new Set(
    shifts
      .filter((s) => s.doctorId === doctorId)
      .map((s) => dateKey(s.date)),
  );
  return monthKeys.filter((k) => !assigned.has(k)).length;
}
