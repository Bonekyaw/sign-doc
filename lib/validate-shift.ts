import { addDays, dateKey, toUtcDate } from "@/lib/scheduling/dates";
import type { ShiftAssignment, ShiftCode } from "@/lib/scheduling/types";

export type { ShiftAssignment, ShiftCode };

function buildDoctorShiftMap(
  doctorId: string,
  assignDate: Date,
  existingShifts: ShiftAssignment[],
): Map<string, ShiftCode> {
  const assignKey = dateKey(assignDate);
  const map = new Map<string, ShiftCode>();

  for (const shift of existingShifts) {
    if (shift.doctorId !== doctorId) continue;
    const key = dateKey(shift.date);
    if (key === assignKey) continue;
    map.set(key, shift.shiftCode);
  }

  return map;
}

function countConsecutive(
  shiftCode: "L" | "N",
  fromDate: Date,
  direction: -1 | 1,
  shifts: Map<string, ShiftCode>,
): number {
  let count = 0;
  let cursor = addDays(fromDate, direction);

  while (shifts.get(dateKey(cursor)) === shiftCode) {
    count++;
    cursor = addDays(cursor, direction);
  }

  return count;
}

/**
 * Validates a proposed shift assignment against hospital fatigue rules.
 * Returns an error message when a rule is broken, or null if valid.
 */
export function validateShift(
  doctorId: string,
  date: Date,
  newShiftCode: ShiftCode,
  existingShifts: ShiftAssignment[],
): string | null {
  const normalizedDate = toUtcDate(date);
  const shifts = buildDoctorShiftMap(doctorId, normalizedDate, existingShifts);
  const previousKey = dateKey(addDays(normalizedDate, -1));
  const nextKey = dateKey(addDays(normalizedDate, 1));
  const previousShift = shifts.get(previousKey);

  if (previousShift === "TWENTY_FOUR") {
    return "Doctor must be off for at least one day after a 24-hour shift.";
  }

  if (newShiftCode === "TWENTY_FOUR") {
    if (previousShift === "L") {
      return "A Long Day shift cannot be followed by a 24-hour shift.";
    }
    if (previousShift === "N") {
      return "A Night shift cannot be followed by a 24-hour shift.";
    }
    if (shifts.has(nextKey)) {
      return "Doctor must be off for at least one day after a 24-hour shift.";
    }
  }

  if (newShiftCode === "L" || newShiftCode === "N") {
    const before = countConsecutive(newShiftCode, normalizedDate, -1, shifts);
    const after = countConsecutive(newShiftCode, normalizedDate, 1, shifts);
    const total = before + 1 + after;

    if (total > 3) {
      const label = newShiftCode === "L" ? "Long Day" : "Night";
      return `Cannot assign more than 3 consecutive ${label} shifts.`;
    }
  }

  return null;
}
