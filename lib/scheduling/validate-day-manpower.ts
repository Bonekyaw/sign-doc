import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type {
  CoverageTarget,
  ShiftAssignment,
} from "@/lib/scheduling/types";

export type DayManpowerResult = {
  errors: string[];
  warnings: string[];
};

export function validateDayManpower(
  date: Date,
  shifts: ShiftAssignment[],
  target: CoverageTarget,
  excludeDoctorId?: string,
): DayManpowerResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lCount = countBandForDate(date, "L", shifts, excludeDoctorId);
  const nCount = countBandForDate(date, "N", shifts, excludeDoctorId);

  if (lCount > target.dayShiftTarget) {
    errors.push(
      `Day shift has ${lCount} doctors assigned; maximum is ${target.dayShiftTarget}.`,
    );
  } else if (lCount < target.dayShiftTarget) {
    warnings.push(
      `Day shift has ${lCount}/${target.dayShiftTarget} doctors assigned.`,
    );
  }

  if (nCount > target.nightShiftTarget) {
    errors.push(
      `Night shift has ${nCount} doctors assigned; maximum is ${target.nightShiftTarget}.`,
    );
  } else if (nCount < target.nightShiftTarget) {
    warnings.push(
      `Night shift has ${nCount}/${target.nightShiftTarget} doctors assigned.`,
    );
  }

  return { errors, warnings };
}

export function assertDayComplete(
  date: Date,
  shifts: ShiftAssignment[],
  target: CoverageTarget,
): DayManpowerResult {
  return validateDayManpower(date, shifts, target);
}
