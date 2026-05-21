import { parseDateKey } from "@/lib/scheduling/dates";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type { CoverageTarget, ShiftAssignment } from "@/lib/scheduling/types";

/** Total L/N slots still needed on a date (for prioritizing understaffed days). */
export function understaffGapForDate(
  dateKeyStr: string,
  workingShifts: ShiftAssignment[],
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget,
): number {
  const date = parseDateKey(dateKeyStr);
  const coverage = getCoverageForDateKey(dateKeyStr);
  const lGap = Math.max(
    0,
    coverage.dayShiftTarget - countBandForDate(date, "L", workingShifts),
  );
  const nGap = Math.max(
    0,
    coverage.nightShiftTarget - countBandForDate(date, "N", workingShifts),
  );
  return lGap + nGap;
}

export function sortMonthKeysByUnderstaffGap(
  monthKeys: string[],
  workingShifts: ShiftAssignment[],
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget,
): string[] {
  return [...monthKeys].sort(
    (a, b) =>
      understaffGapForDate(b, workingShifts, getCoverageForDateKey) -
      understaffGapForDate(a, workingShifts, getCoverageForDateKey),
  );
}
