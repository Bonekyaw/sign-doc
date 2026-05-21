import { addDays, dateKey, toUtcDate } from "@/lib/scheduling/dates";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import {
  shiftAssignmentsToShiftRecords,
  shiftCodeToShiftType,
} from "@/lib/scheduling/shift-validation-adapters";
import {
  validateShiftSequence,
  ShiftType,
} from "@/lib/scheduling/shift-validation-service";
import type { ShiftAssignment, ShiftCode } from "@/lib/scheduling/types";

export type { ShiftAssignment, ShiftCode };

/**
 * Validates a proposed shift assignment against hospital fatigue rules.
 * Delegates to {@link validateShiftSequence}; returns an error message or null.
 */
export function validateShift(
  doctorId: string,
  date: Date,
  newShiftCode: ShiftCode,
  existingShifts: ShiftAssignment[],
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): string | null {
  const proposedShift = shiftCodeToShiftType(newShiftCode);
  const records = shiftAssignmentsToShiftRecords(existingShifts);
  const outcome = validateShiftSequence(
    doctorId,
    date,
    proposedShift,
    records,
    rules,
  );
  if (!outcome.isValid) {
    return outcome.error ?? "Invalid shift assignment.";
  }

  // Optional admin setting (off by default per main-flow: L may precede 24h).
  if (rules.blockLongDayBefore24 && newShiftCode === "TWENTY_FOUR") {
    const normalized = toUtcDate(date);
    const prevKey = dateKey(addDays(normalized, -1));
    const prev = existingShifts.find(
      (s) =>
        s.doctorId === doctorId && dateKey(s.date) === prevKey,
    );
    if (prev?.shiftCode === "L") {
      return "A Long Day shift cannot be followed by a 24-hour shift.";
    }
  }

  return null;
}

export { validateShiftSequence, ShiftType };
