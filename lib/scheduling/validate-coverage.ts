import { dateKey } from "@/lib/scheduling/dates";
import type {
  CoverageTarget,
  ShiftAssignment,
  ShiftCode,
} from "@/lib/scheduling/types";

/** 24h duty covers both Long Day and Night bands for manpower ratio purposes. */
export function shiftCountsTowardBand(
  shiftCode: ShiftCode,
  band: "L" | "N",
): boolean {
  return shiftCode === band || shiftCode === "TWENTY_FOUR";
}

export function countBandForDate(
  date: Date,
  band: "L" | "N",
  shifts: ShiftAssignment[],
  excludeDoctorId?: string,
): number {
  const key = dateKey(date);
  return shifts.filter(
    (s) =>
      dateKey(s.date) === key &&
      shiftCountsTowardBand(s.shiftCode, band) &&
      s.doctorId !== excludeDoctorId,
  ).length;
}

export function validateCoverage(
  date: Date,
  shiftCode: ShiftCode,
  shifts: ShiftAssignment[],
  target: CoverageTarget,
  excludeDoctorId?: string,
  options?: { allowOverCoverage?: boolean },
): { error: string | null; warning: string | null } {
  if (shiftCode !== "L" && shiftCode !== "N") {
    return { error: null, warning: null };
  }

  const count =
    countBandForDate(date, shiftCode, shifts, excludeDoctorId) + 1;
  const targetCount =
    shiftCode === "L" ? target.dayShiftTarget : target.nightShiftTarget;
  const label = shiftCode === "L" ? "day" : "night";

  if (count > targetCount) {
    if (options?.allowOverCoverage) {
      return {
        error: null,
        warning: `Over target ${label} coverage (${count}/${targetCount}).`,
      };
    }
    return {
      error: `This date already has the maximum ${label} shift coverage (${targetCount}).`,
      warning: null,
    };
  }

  if (count < targetCount) {
    return {
      error: null,
      warning: `Under target ${label} coverage (${count}/${targetCount}).`,
    };
  }

  return { error: null, warning: null };
}
