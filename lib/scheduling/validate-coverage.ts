import { dateKey } from "@/lib/scheduling/dates";
import type {
  CoverageTarget,
  ShiftAssignment,
  ShiftCode,
} from "@/lib/scheduling/types";

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
      s.shiftCode === band &&
      s.doctorId !== excludeDoctorId,
  ).length;
}

export function validateCoverage(
  date: Date,
  shiftCode: ShiftCode,
  shifts: ShiftAssignment[],
  target: CoverageTarget,
  excludeDoctorId?: string,
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
