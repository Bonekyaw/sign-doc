import { dateKey } from "@/lib/scheduling/dates";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import type { ShiftAssignment } from "@/lib/scheduling/types";

function assignedDatesForDoctor(
  doctorId: string,
  monthKeys: string[],
  shifts: ShiftAssignment[],
): Set<string> {
  const keySet = new Set(monthKeys);
  return new Set(
    shifts
      .filter((s) => s.doctorId === doctorId && keySet.has(dateKey(s.date)) && s.shiftCode !== "OFF")
      .map((s) => dateKey(s.date)),
  );
}

/** Longest run of consecutive unassigned days within monthKeys (inclusive order). */
export function maxConsecutiveOffStreak(
  doctorId: string,
  monthKeys: string[],
  shifts: ShiftAssignment[],
): number {
  const assigned = assignedDatesForDoctor(doctorId, monthKeys, shifts);
  let max = 0;
  let current = 0;
  for (const key of monthKeys) {
    if (assigned.has(key)) {
      current = 0;
    } else {
      current++;
      max = Math.max(max, current);
    }
  }
  return max;
}

/**
 * Longest off streak between first and last assigned day (excludes leading/trailing
 * unscheduled calendar padding — those are not "off days" in main-flow terms).
 */
export function maxConsecutiveOffStreakInWorkSpan(
  doctorId: string,
  monthKeys: string[],
  shifts: ShiftAssignment[],
): number {
  const assigned = assignedDatesForDoctor(doctorId, monthKeys, shifts);
  if (assigned.size === 0) return 0;

  let firstIdx = monthKeys.length;
  let lastIdx = -1;
  for (let i = 0; i < monthKeys.length; i++) {
    const key = monthKeys[i]!;
    if (assigned.has(key)) {
      firstIdx = Math.min(firstIdx, i);
      lastIdx = Math.max(lastIdx, i);
    }
  }
  if (lastIdx < 0) return 0;

  let max = 0;
  let current = 0;
  for (let i = firstIdx; i <= lastIdx; i++) {
    if (assigned.has(monthKeys[i]!)) {
      current = 0;
    } else {
      current++;
      max = Math.max(max, current);
    }
  }
  return max;
}

export function validateConsecutiveOffDays(
  doctorId: string,
  doctorName: string,
  monthKeys: string[],
  shifts: ShiftAssignment[],
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): string | null {
  const maxAllowed = rules.maxConsecutiveOffDays;
  const streak = maxConsecutiveOffStreakInWorkSpan(doctorId, monthKeys, shifts);
  if (streak > maxAllowed) {
    return `${doctorName} has ${streak} consecutive days off (maximum allowed is ${maxAllowed}).`;
  }
  return null;
}

/** Error if assigning on `date` would extend an off streak past the limit. */
export function validateOffStreakOnAssign(
  doctorId: string,
  doctorName: string,
  date: Date,
  monthKeys: string[],
  existingShifts: ShiftAssignment[],
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): string | null {
  const maxAllowed = rules.maxConsecutiveOffDays;
  const key = dateKey(date);
  const idx = monthKeys.indexOf(key);
  if (idx === -1) return null;

  const assigned = assignedDatesForDoctor(doctorId, monthKeys, existingShifts);
  if (assigned.has(key)) return null;

  // Unscheduled days at the start of a build are not "off days" yet.
  if (assigned.size === 0) return null;

  let before = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (assigned.has(monthKeys[i])) break;
    before++;
  }
  const workBeforeOffStreak =
    before > 0 && assigned.has(monthKeys[idx - before - 1]!);

  if (workBeforeOffStreak && before > maxAllowed) {
    return `${doctorName} cannot have more than ${maxAllowed} consecutive days off.`;
  }

  let after = 0;
  for (let i = idx + 1; i < monthKeys.length; i++) {
    if (assigned.has(monthKeys[i])) break;
    after++;
  }
  const workAfterOffStreak =
    after > 0 && assigned.has(monthKeys[idx + after + 1]!);

  if (workAfterOffStreak && after > maxAllowed) {
    return `${doctorName} cannot have more than ${maxAllowed} consecutive days off.`;
  }

  return null;
}

/** Error if clearing shift on `date` creates an off streak over the limit. */
export function validateOffStreakOnClear(
  doctorId: string,
  doctorName: string,
  date: Date,
  monthKeys: string[],
  shiftsAfterClear: ShiftAssignment[],
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): string | null {
  return validateConsecutiveOffDays(
    doctorId,
    doctorName,
    monthKeys,
    shiftsAfterClear,
    rules,
  );
}
