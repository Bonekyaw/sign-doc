import { parseDateKey } from "@/lib/scheduling/dates";
import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import { coverageSeniorFlags } from "@/lib/scheduling/validate-senior-manpower";
import {
  DEFAULT_SCHEDULING_RULES,
  type SchedulingRulesConfig,
} from "@/lib/scheduling/rules-types";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
} from "@/lib/scheduling/types";

export type DraftAssignmentInput = {
  doctorId: string;
  date: string;
  shiftCode: ShiftCode;
  durationHours: number;
  source?: "MANUAL" | "AUTO";
};

export function draftToShiftAssignments(
  rows: DraftAssignmentInput[],
): ShiftAssignment[] {
  return rows.map((r) => ({
    doctorId: r.doctorId,
    date: parseDateKey(r.date),
    shiftCode: r.shiftCode,
    durationHours: r.durationHours,
  }));
}

export function computeScheduleMetrics(params: {
  monthKeys: string[];
  assignments: DraftAssignmentInput[];
  doctors: DoctorInfo[];
  coverageTemplate: {
    date: string;
    dayShiftTarget: number;
    nightShiftTarget: number;
  }[];
  rules?: Pick<
    SchedulingRulesConfig,
    "requireSeniorOnDayBand" | "requireSeniorOnNightBand"
  >;
}) {
  const { monthKeys, assignments, doctors, coverageTemplate } = params;
  const rules = {
    ...DEFAULT_SCHEDULING_RULES,
    ...params.rules,
  };
  const shifts = draftToShiftAssignments(assignments);
  const doctorsById = new Map(doctors.map((d) => [d.id, d]));

  const coverageByDate = coverageTemplate.map((row) => {
    const date = parseDateKey(row.date);
    const lCount = countBandForDate(date, "L", shifts);
    const nCount = countBandForDate(date, "N", shifts);
    const senior = coverageSeniorFlags(date, shifts, doctorsById, rules);
    return {
      date: row.date,
      dayShiftTarget: row.dayShiftTarget,
      nightShiftTarget: row.nightShiftTarget,
      lCount,
      nCount,
      lHasSenior: senior.lHasSenior,
      nHasSenior: senior.nHasSenior,
    };
  });

  const hourSummary = doctors.map((d) => ({
    doctorId: d.id,
    worked: computeMonthlyHours(d.id, monthKeys, shifts),
    target: d.targetHours,
  }));

  const manualCount = assignments.filter((a) => a.source === "MANUAL").length;
  const autoCount = assignments.filter((a) => a.source === "AUTO").length;

  return { coverageByDate, hourSummary, manualCount, autoCount };
}
