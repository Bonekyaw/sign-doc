import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import { remainingMonthlyHours } from "@/lib/scheduling/compute-hours";
import { getEligibleDoctors } from "@/lib/scheduling/eligibility";
import { sortMonthKeysByUnderstaffGap } from "@/lib/scheduling/coverage-priority";
import { doctorInfoToDoctorRecord } from "@/lib/scheduling/shift-validation-adapters";
import {
  ShiftType,
  validateDailyManpower,
  type DoctorRecord,
} from "@/lib/scheduling/shift-validation-service";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { bandHasSenior } from "@/lib/scheduling/validate-senior-manpower";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

export type FillTwentyFourCoverageResult = {
  proposals: AutoAssignProposal[];
  warnings: string[];
};

function doctorsForBandManpower(
  date: Date,
  band: "L" | "N",
  additionalDoctorIds: string[],
  workingShifts: ShiftAssignment[],
  doctors: DoctorInfo[],
): DoctorRecord[] {
  const key = dateKey(date);
  const ids = new Set<string>();
  for (const s of workingShifts) {
    if (dateKey(s.date) !== key) continue;
    if (s.shiftCode === band || s.shiftCode === "TWENTY_FOUR") {
      ids.add(s.doctorId);
    }
  }
  for (const id of additionalDoctorIds) {
    ids.add(id);
  }
  return [...ids]
    .map((id) => {
      const doctor = doctors.find((d) => d.id === id);
      return doctor ? doctorInfoToDoctorRecord(doctor) : null;
    })
    .filter((d): d is DoctorRecord => d !== null);
}

function dateHasBandGap(
  date: Date,
  coverage: CoverageTarget,
  workingShifts: ShiftAssignment[],
): boolean {
  const lCount = countBandForDate(date, "L", workingShifts);
  const nCount = countBandForDate(date, "N", workingShifts);
  return (
    lCount < coverage.dayShiftTarget || nCount < coverage.nightShiftTarget
  );
}

/** Place TWENTY_FOUR before separate L/N when either band still has a gap. */
export function fillTwentyFourCoverage(params: {
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  workingShifts: ShiftAssignment[];
  monthKeys: string[];
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;
  leaveByDoctor?: Map<string, Set<string>>;
  rules?: SchedulingRulesConfig;
}): FillTwentyFourCoverageResult {
  const {
    doctors,
    shiftTypes,
    workingShifts,
    monthKeys,
    getCoverageForDateKey,
    leaveByDoctor = new Map(),
    rules = DEFAULT_SCHEDULING_RULES,
  } = params;

  const h24Type = shiftTypes.find(
    (s) => s.code === "TWENTY_FOUR" && s.isActive,
  );
  const proposals: AutoAssignProposal[] = [];
  const warnings: string[] = [];

  if (!h24Type) {
    return { proposals, warnings };
  }

  const doctorsById = new Map(doctors.map((d) => [d.id, d]));
  const orderedKeys = sortMonthKeysByUnderstaffGap(
    monthKeys,
    workingShifts,
    getCoverageForDateKey,
  );

  for (const key of orderedKeys) {
    const date = parseDateKey(key);
    const coverage = getCoverageForDateKey(key);
    if (!dateHasBandGap(date, coverage, workingShifts)) continue;

    const assignedToday = new Set(
      workingShifts
        .filter((s) => dateKey(s.date) === key)
        .map((s) => s.doctorId),
    );

    const lHasSenior = bandHasSenior(date, "L", workingShifts, doctorsById);
    const nHasSenior = bandHasSenior(date, "N", workingShifts, doctorsById);
    const preferSenior = !lHasSenior || !nHasSenior;

    const candidates = doctors
      .filter((doctor) => !assignedToday.has(doctor.id))
      .filter(
        (doctor) =>
          remainingMonthlyHours(
            doctor.id,
            doctor.targetHours,
            monthKeys,
            workingShifts,
          ) >= h24Type.durationHours,
      )
      .sort((a, b) => {
        if (preferSenior) {
          if (a.seniority === "SENIOR" && b.seniority !== "SENIOR") return -1;
          if (b.seniority === "SENIOR" && a.seniority !== "SENIOR") return 1;
        }
        return (
          remainingMonthlyHours(
            b.id,
            b.targetHours,
            monthKeys,
            workingShifts,
          ) -
          remainingMonthlyHours(
            a.id,
            a.targetHours,
            monthKeys,
            workingShifts,
          )
        );
      });

    let placed = false;
    for (const doctor of candidates) {
      const eligible = getEligibleDoctors({
        doctors,
        date,
        shiftCode: "TWENTY_FOUR",
        shiftTypes,
        workingShifts,
        monthKeys,
        coverageTarget: coverage,
        leaveByDoctor,
        rules,
        purpose: "hoursFill",
      }).find((entry) => entry.doctor.id === doctor.id);

      if (!eligible) continue;

      const trialL = doctorsForBandManpower(
        date,
        "L",
        [doctor.id],
        workingShifts,
        doctors,
      );
      const trialN = doctorsForBandManpower(
        date,
        "N",
        [doctor.id],
        workingShifts,
        doctors,
      );
      const lValid = validateDailyManpower(date, ShiftType.LONG_DAY, trialL);
      const nValid = validateDailyManpower(date, ShiftType.NIGHT, trialN);
      if (!lValid.isValid || !nValid.isValid) continue;

      proposals.push({
        doctorId: doctor.id,
        date: key,
        shiftCode: "TWENTY_FOUR",
        shiftTypeId: h24Type.id,
        durationHours: h24Type.durationHours,
      });
      workingShifts.push({
        doctorId: doctor.id,
        date,
        shiftCode: "TWENTY_FOUR",
        durationHours: h24Type.durationHours,
      });
      if (eligible.validation.warnings.length) {
        warnings.push(
          ...eligible.validation.warnings.map(
            (w) => `${key} (${doctor.name}, 24h coverage): ${w}`,
          ),
        );
      }
      placed = true;
      break;
    }
  }

  return { proposals, warnings };
}
