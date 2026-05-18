import { toUtcDate } from "@/lib/scheduling/dates";
import type { ShiftCode } from "@/lib/scheduling/types";

export type RotationStepType = "L" | "N" | "TWENTY_FOUR" | "OFF";

export type RotationStepInfo = {
  sortOrder: number;
  stepType: RotationStepType;
};

export type DoctorRotationInfo = {
  doctorId: string;
  startDate: Date;
  startOffset: number;
  steps: RotationStepInfo[];
};

function daysBetween(start: Date, end: Date): number {
  const a = toUtcDate(start).getTime();
  const b = toUtcDate(end).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function sortedSteps(steps: RotationStepInfo[]): RotationStepInfo[] {
  return [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getExpectedStep(
  rotation: DoctorRotationInfo,
  date: Date,
): RotationStepType | null {
  const ordered = sortedSteps(rotation.steps);
  if (ordered.length === 0) return null;
  const dayIndex =
    (daysBetween(rotation.startDate, date) + rotation.startOffset) %
    ordered.length;
  const normalized =
    ((dayIndex % ordered.length) + ordered.length) % ordered.length;
  return ordered[normalized]?.stepType ?? null;
}

export function matchesRotationForShift(
  rotation: DoctorRotationInfo | undefined,
  date: Date,
  shiftCode: ShiftCode,
): boolean {
  if (!rotation) return false;
  const expected = getExpectedStep(rotation, date);
  if (expected === "OFF") return false;
  return expected === shiftCode;
}

export function buildDoctorRotationMap(
  rows: {
    doctorId: string;
    startDate: Date;
    startOffset: number;
    template: { steps: { sortOrder: number; stepType: RotationStepType }[] };
  }[],
): Map<string, DoctorRotationInfo> {
  const map = new Map<string, DoctorRotationInfo>();
  for (const row of rows) {
    map.set(row.doctorId, {
      doctorId: row.doctorId,
      startDate: row.startDate,
      startOffset: row.startOffset,
      steps: row.template.steps.map((s) => ({
        sortOrder: s.sortOrder,
        stepType: s.stepType,
      })),
    });
  }
  return map;
}
