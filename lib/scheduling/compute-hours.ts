import { dateKey } from "@/lib/scheduling/dates";
import { shiftAssignmentsToShiftRecords } from "@/lib/scheduling/shift-validation-adapters";
import { calculateMonthlyHours as sumShiftRecordHours } from "@/lib/scheduling/shift-validation-service";
import type { ShiftAssignment } from "@/lib/scheduling/types";

export function computeMonthlyHours(
  doctorId: string,
  monthKeys: string[],
  shifts: ShiftAssignment[],
): number {
  const keySet = new Set(monthKeys);
  const records = shiftAssignmentsToShiftRecords(
    shifts.filter(
      (s) => s.doctorId === doctorId && keySet.has(dateKey(s.date)),
    ),
  );
  return sumShiftRecordHours(records);
}

export { calculateMonthlyHours } from "@/lib/scheduling/shift-validation-service";

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
