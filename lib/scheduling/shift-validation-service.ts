import { addDays, dateKey, toUtcDate } from "@/lib/scheduling/dates";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { rulesForMainFlow } from "@/lib/scheduling/main-flow-rules";

/**
 * Canonical shift types for validation (maps to ShiftTypeConfig codes L, N, TWENTY_FOUR, OFF).
 * Adjust hospital rules in SHIFT_VALIDATION_RULES below.
 */
export enum ShiftType {
  LONG_DAY = "LONG_DAY",
  NIGHT = "NIGHT",
  TWENTY_FOUR = "TWENTY_FOUR",
  OFF = "OFF",
}

export type DoctorSeniority = "SENIOR" | "MID_LEVEL" | "JUNIOR";

export type ValidationOutcome = {
  isValid: boolean;
  error?: string;
  warning?: string;
};

export type ShiftRecord = {
  doctorId: string;
  date: Date;
  shiftType: ShiftType;
};

export type DoctorRecord = {
  id: string;
  seniority: DoctorSeniority;
  targetMonthlyHours: number;
};

/**
 * Hospital scheduling constraints — mirrors `.cursor/rules/main-flow.mdc`.
 * Change these values (or pass SchedulingRulesConfig) when management updates policy.
 */
export const SHIFT_VALIDATION_RULES = {
  /** Days off required immediately after a 24h shift (1 or 2 per admin settings). */
  post24RestDays: 1 as 1 | 2,
  /** Cannot work 3 LONG_DAY in a row → max 2 consecutive. */
  maxConsecutiveLongDay: 2,
  /** Cannot work 3 NIGHT in a row → max 2 consecutive. */
  maxConsecutiveNight: 2,
  /** Cannot take 4 OFF days in a row → max 3 consecutive. */
  maxConsecutiveOffDays: 3,
  /** Hours credited per shift type for monthly totals. */
  shiftTypeHours: {
    [ShiftType.LONG_DAY]: 12,
    [ShiftType.NIGHT]: 12,
    [ShiftType.TWENTY_FOUR]: 24,
    [ShiftType.OFF]: 0,
  } as Record<ShiftType, number>,
  /** Full-time monthly hour target (doctors with targetMonthlyHours >= this). */
  fullTimeTargetHours: 240,
} as const;

export type ShiftValidationRules = {
  post24RestDays: 1 | 2;
  maxConsecutiveLongDay: number;
  maxConsecutiveNight: number;
  maxConsecutiveOffDays: number;
  shiftTypeHours: Record<ShiftType, number>;
  fullTimeTargetHours: number;
};

export function rulesToShiftValidation(
  rules: SchedulingRulesConfig = rulesForMainFlow(),
): ShiftValidationRules {
  const post24 = Math.min(2, Math.max(1, rules.post24MinRestDays)) as 1 | 2;
  return {
    post24RestDays: post24,
    maxConsecutiveLongDay: rules.maxConsecutiveLongDay,
    maxConsecutiveNight: rules.maxConsecutiveNight,
    maxConsecutiveOffDays: rules.maxConsecutiveOffDays,
    shiftTypeHours: SHIFT_VALIDATION_RULES.shiftTypeHours,
    fullTimeTargetHours: rules.ftDefaultTargetHours,
  };
}

function isWorkShift(type: ShiftType): boolean {
  return type !== ShiftType.OFF;
}

function buildDoctorShiftMap(
  doctorId: string,
  targetDate: Date,
  currentMonthShifts: ShiftRecord[],
): Map<string, ShiftType> {
  const targetKey = dateKey(targetDate);
  const map = new Map<string, ShiftType>();

  for (const shift of currentMonthShifts) {
    if (shift.doctorId !== doctorId) continue;
    const key = dateKey(shift.date);
    if (key === targetKey) continue;
    map.set(key, shift.shiftType);
  }

  return map;
}

function getShiftOnDate(
  map: Map<string, ShiftType>,
  date: Date,
): ShiftType | undefined {
  return map.get(dateKey(date));
}

/** Unassigned calendar days count as OFF for consecutive-off checks. */
function isOffOnDate(map: Map<string, ShiftType>, date: Date): boolean {
  const existing = getShiftOnDate(map, date);
  return existing === undefined || existing === ShiftType.OFF;
}

function countConsecutiveType(
  map: Map<string, ShiftType>,
  fromDate: Date,
  direction: -1 | 1,
  match: (t: ShiftType | undefined) => boolean,
): number {
  let count = 0;
  let cursor = addDays(fromDate, direction);
  while (match(getShiftOnDate(map, cursor))) {
    count++;
    cursor = addDays(cursor, direction);
  }
  return count;
}

function fail(error: string): ValidationOutcome {
  return { isValid: false, error };
}

function ok(warning?: string): ValidationOutcome {
  return warning ? { isValid: true, warning } : { isValid: true };
}

/**
 * Validates a proposed shift for one doctor on one date against sequential fatigue rules.
 */
export function validateShiftSequence(
  doctorId: string,
  targetDate: Date,
  proposedShift: ShiftType,
  currentMonthShifts: ShiftRecord[],
  rulesInput?: SchedulingRulesConfig,
): ValidationOutcome {
  const rules: ShiftValidationRules = rulesInput
    ? rulesToShiftValidation(rulesInput)
    : {
        ...SHIFT_VALIDATION_RULES,
        shiftTypeHours: SHIFT_VALIDATION_RULES.shiftTypeHours,
      };

  const normalizedDate = toUtcDate(targetDate);
  const shiftMap = buildDoctorShiftMap(
    doctorId,
    normalizedDate,
    currentMonthShifts,
  );
  const previousDate = addDays(normalizedDate, -1);
  const previousShift = getShiftOnDate(shiftMap, previousDate);

  // --- Rule 1: Post-24h rest — after TWENTY_FOUR, only OFF is allowed on rest days ---
  for (let i = 1; i <= rules.post24RestDays; i++) {
    const key = dateKey(addDays(normalizedDate, -i));
    if (shiftMap.get(key) === ShiftType.TWENTY_FOUR) {
      if (proposedShift !== ShiftType.OFF) {
        return fail(
          `Doctor must be OFF for at least ${rules.post24RestDays} day(s) after a 24-hour shift.`,
        );
      }
    }
  }

  // --- Rule 2: Night → 24h (strictly invalid) ---
  if (
    proposedShift === ShiftType.TWENTY_FOUR &&
    previousShift === ShiftType.NIGHT
  ) {
    return fail("A Night shift cannot be followed by a 24-hour shift.");
  }

  // --- Rule 3: Long day → 24h (explicitly allowed) ---
  if (
    proposedShift === ShiftType.TWENTY_FOUR &&
    previousShift === ShiftType.LONG_DAY
  ) {
    // Allowed by hospital policy — no block.
  }

  // --- Rule 4: Max consecutive LONG_DAY (cannot work 3 in a row) ---
  if (proposedShift === ShiftType.LONG_DAY) {
    const before = countConsecutiveType(
      shiftMap,
      normalizedDate,
      -1,
      (t) => t === ShiftType.LONG_DAY,
    );
    const after = countConsecutiveType(
      shiftMap,
      normalizedDate,
      1,
      (t) => t === ShiftType.LONG_DAY,
    );
    const total = before + 1 + after;
    if (total > rules.maxConsecutiveLongDay) {
      return fail(
        `Cannot assign more than ${rules.maxConsecutiveLongDay} consecutive Long Day shifts.`,
      );
    }
  }

  // --- Rule 5: Max consecutive NIGHT ---
  if (proposedShift === ShiftType.NIGHT) {
    const before = countConsecutiveType(
      shiftMap,
      normalizedDate,
      -1,
      (t) => t === ShiftType.NIGHT,
    );
    const after = countConsecutiveType(
      shiftMap,
      normalizedDate,
      1,
      (t) => t === ShiftType.NIGHT,
    );
    const total = before + 1 + after;
    if (total > rules.maxConsecutiveNight) {
      return fail(
        `Cannot assign more than ${rules.maxConsecutiveNight} consecutive Night shifts.`,
      );
    }
  }

  // --- Rule 6: Max consecutive OFF (cannot take 4 off days in a row) ---
  if (proposedShift === ShiftType.OFF) {
    let beforeOff = 0;
    let cursor = addDays(normalizedDate, -1);
    while (isOffOnDate(shiftMap, cursor)) {
      beforeOff++;
      cursor = addDays(cursor, -1);
    }
    if (beforeOff >= rules.maxConsecutiveOffDays) {
      return fail(
        `Cannot assign more than ${rules.maxConsecutiveOffDays} consecutive days off.`,
      );
    }
  }

  // --- Rule 7: Forward rest after proposing TWENTY_FOUR ---
  if (proposedShift === ShiftType.TWENTY_FOUR) {
    for (let i = 1; i <= rules.post24RestDays; i++) {
      const next = getShiftOnDate(shiftMap, addDays(normalizedDate, i));
      if (next !== undefined && isWorkShift(next)) {
        return fail(
          `Doctor must be off for at least ${rules.post24RestDays} day(s) after a 24-hour shift.`,
        );
      }
    }
  }

  return ok();
}

/**
 * Ensures at least one Senior is on a staffed LONG_DAY or NIGHT band.
 */
export function validateDailyManpower(
  _date: Date,
  shiftType: ShiftType,
  assignedDoctors: DoctorRecord[],
): ValidationOutcome {
  if (shiftType !== ShiftType.LONG_DAY && shiftType !== ShiftType.NIGHT) {
    return ok();
  }

  if (assignedDoctors.length === 0) {
    return ok();
  }

  const hasSenior = assignedDoctors.some((d) => d.seniority === "SENIOR");
  if (!hasSenior) {
    const band = shiftType === ShiftType.LONG_DAY ? "Day" : "Night";
    return fail(
      `${band} shift must include at least one Senior doctor.`,
    );
  }

  return ok();
}

/**
 * Sums worked hours from shift records (OFF = 0).
 */
export function calculateMonthlyHours(shifts: ShiftRecord[]): number {
  return shifts.reduce(
    (sum, s) => sum + SHIFT_VALIDATION_RULES.shiftTypeHours[s.shiftType],
    0,
  );
}

export type MonthlyHoursComparison = {
  worked: number;
  target: number;
  remaining: number;
  isUnder: boolean;
  isOver: boolean;
  warning?: string;
};

/**
 * Compares worked hours to the doctor's targetMonthlyHours for admin warnings.
 */
export function compareMonthlyHoursToTarget(
  doctor: DoctorRecord,
  shifts: ShiftRecord[],
  options?: { doctorIdFilter?: string },
): MonthlyHoursComparison {
  const doctorShifts = options?.doctorIdFilter
    ? shifts.filter((s) => s.doctorId === options.doctorIdFilter)
    : shifts.filter((s) => s.doctorId === doctor.id);

  const worked = calculateMonthlyHours(doctorShifts);
  const target = doctor.targetMonthlyHours;
  const remaining = Math.max(0, target - worked);
  const isUnder = worked < target;
  const isOver = worked > target;

  let warning: string | undefined;
  if (isOver) {
    warning = `${worked}h exceeds monthly target (${target}h).`;
  } else if (isUnder && target >= SHIFT_VALIDATION_RULES.fullTimeTargetHours) {
    warning = `${worked}h / ${target}h (${remaining}h short of full-time monthly target).`;
  } else if (isUnder) {
    warning = `${worked}h / ${target}h (${remaining}h below monthly target).`;
  }

  return { worked, target, remaining, isUnder, isOver, warning };
}
