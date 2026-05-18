export const ALLOWED_DAY_TARGETS = [3, 4] as const;
export const ALLOWED_NIGHT_TARGETS = [2, 3] as const;

export type DayShiftTarget = (typeof ALLOWED_DAY_TARGETS)[number];
export type NightShiftTarget = (typeof ALLOWED_NIGHT_TARGETS)[number];

export function isValidDayTarget(value: number): value is DayShiftTarget {
  return (ALLOWED_DAY_TARGETS as readonly number[]).includes(value);
}

export function isValidNightTarget(value: number): value is NightShiftTarget {
  return (ALLOWED_NIGHT_TARGETS as readonly number[]).includes(value);
}

export function validateCoverageTargetValues(
  dayShiftTarget: number,
  nightShiftTarget: number,
): string | null {
  if (!isValidDayTarget(dayShiftTarget)) {
    return "Day shift target must be 3 or 4 doctors.";
  }
  if (!isValidNightTarget(nightShiftTarget)) {
    return "Night shift target must be 2 or 3 doctors.";
  }
  return null;
}
