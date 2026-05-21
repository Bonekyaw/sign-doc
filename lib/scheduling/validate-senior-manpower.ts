import { dateKey } from "@/lib/scheduling/dates";
import {
  ShiftType,
  validateDailyManpower,
  type DoctorRecord,
} from "@/lib/scheduling/shift-validation-service";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type {
  DoctorInfo,
  DoctorSeniority,
  ShiftAssignment,
} from "@/lib/scheduling/types";

function seniorRequiredForBand(
  band: "L" | "N",
  rules: SchedulingRulesConfig,
): boolean {
  return band === "L"
    ? rules.requireSeniorOnDayBand
    : rules.requireSeniorOnNightBand;
}

export function bandHasSenior(
  date: Date,
  band: "L" | "N",
  shifts: ShiftAssignment[],
  doctorsById: Map<string, Pick<DoctorInfo, "seniority">>,
): boolean {
  const key = dateKey(date);
  const doctorIds = new Set(
    shifts
      .filter((s) => dateKey(s.date) === key && s.shiftCode === band)
      .map((s) => s.doctorId),
  );
  for (const id of doctorIds) {
    if (doctorsById.get(id)?.seniority === "SENIOR") return true;
  }
  return false;
}

export function validateSeniorManpowerForBand(
  date: Date,
  band: "L" | "N",
  shifts: ShiftAssignment[],
  doctorsById: Map<string, Pick<DoctorInfo, "seniority">>,
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): string | null {
  if (!seniorRequiredForBand(band, rules)) return null;
  const count = countBandForDate(date, band, shifts);
  if (count === 0) return null;

  const key = dateKey(date);
  const onBand = shifts.filter(
    (s) => dateKey(s.date) === key && s.shiftCode === band,
  );
  const assignedDoctors: DoctorRecord[] = onBand.map((s) => {
    const d = doctorsById.get(s.doctorId);
    return {
      id: s.doctorId,
      seniority: (d?.seniority ?? "JUNIOR") as DoctorRecord["seniority"],
      targetMonthlyHours: 0,
    };
  });

  const shiftType =
    band === "L" ? ShiftType.LONG_DAY : ShiftType.NIGHT;
  const outcome = validateDailyManpower(date, shiftType, assignedDoctors);
  return outcome.isValid ? null : (outcome.error ?? null);
}

export function validateSeniorManpowerForDate(
  date: Date,
  shifts: ShiftAssignment[],
  doctors: Pick<DoctorInfo, "id" | "seniority">[],
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): string[] {
  const doctorsById = new Map(
    doctors.map((d) => [d.id, { seniority: d.seniority as DoctorSeniority }]),
  );
  const errors: string[] = [];
  for (const band of ["L", "N"] as const) {
    const err = validateSeniorManpowerForBand(
      date,
      band,
      shifts,
      doctorsById,
      rules,
    );
    if (err) errors.push(err);
  }
  return errors;
}

export function coverageSeniorFlags(
  date: Date,
  shifts: ShiftAssignment[],
  doctorsById: Map<string, Pick<DoctorInfo, "seniority">>,
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): {
  lHasSenior: boolean;
  nHasSenior: boolean;
  lStaffed: boolean;
  nStaffed: boolean;
} {
  const lStaffed = countBandForDate(date, "L", shifts) > 0;
  const nStaffed = countBandForDate(date, "N", shifts) > 0;
  const lOk =
    !rules.requireSeniorOnDayBand ||
    !lStaffed ||
    bandHasSenior(date, "L", shifts, doctorsById);
  const nOk =
    !rules.requireSeniorOnNightBand ||
    !nStaffed ||
    bandHasSenior(date, "N", shifts, doctorsById);
  return {
    lStaffed,
    nStaffed,
    lHasSenior: lOk,
    nHasSenior: nOk,
  };
}

export function bandNeedsSenior(
  date: Date,
  band: "L" | "N",
  shifts: ShiftAssignment[],
  doctorsById: Map<string, Pick<DoctorInfo, "seniority">>,
  rules: SchedulingRulesConfig,
): boolean {
  if (!seniorRequiredForBand(band, rules)) return false;
  if (countBandForDate(date, band, shifts) === 0) return true;
  return !bandHasSenior(date, band, shifts, doctorsById);
}
