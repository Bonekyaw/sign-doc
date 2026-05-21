import { parseDateKey } from "@/lib/scheduling/dates";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import { sortMonthKeysByUnderstaffGap } from "@/lib/scheduling/coverage-priority";
import { getEligibleDoctors } from "@/lib/scheduling/eligibility";
import { mayPlaceOnBand } from "@/lib/scheduling/enforce-senior-coverage";
import { remainingMonthlyHours } from "@/lib/scheduling/compute-hours";
import { bandNeedsSenior } from "@/lib/scheduling/validate-senior-manpower";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

export type FillUnderstaffedResult = {
  proposals: AutoAssignProposal[];
  warnings: string[];
};

/** Fill day/night band gaps before hour-fill so coverage and doctor targets align. */
export function fillUnderstaffedCoverage(params: {
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  workingShifts: ShiftAssignment[];
  monthKeys: string[];
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;
  leaveByDoctor?: Map<string, Set<string>>;
  rules?: SchedulingRulesConfig;
}): FillUnderstaffedResult {
  const {
    doctors,
    shiftTypes,
    workingShifts,
    monthKeys,
    getCoverageForDateKey,
    leaveByDoctor = new Map(),
    rules = DEFAULT_SCHEDULING_RULES,
  } = params;

  const lType = shiftTypes.find((s) => s.code === "L" && s.isActive);
  const nType = shiftTypes.find((s) => s.code === "N" && s.isActive);
  const proposals: AutoAssignProposal[] = [];
  const warnings: string[] = [];

  if (!lType && !nType) {
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

    const bands: { band: "L" | "N"; type: typeof lType; target: number }[] = [];
    if (lType) {
      bands.push({ band: "L", type: lType, target: coverage.dayShiftTarget });
    }
    if (nType) {
      bands.push({ band: "N", type: nType, target: coverage.nightShiftTarget });
    }

    bands.sort((a, b) => {
      const gapA = a.target - countBandForDate(date, a.band, workingShifts);
      const gapB = b.target - countBandForDate(date, b.band, workingShifts);
      return gapB - gapA;
    });

    for (const { band, type, target } of bands) {
      if (!type) continue;

      while (countBandForDate(date, band, workingShifts) < target) {
        const needsSenior = bandNeedsSenior(
          date,
          band,
          workingShifts,
          doctorsById,
          rules,
        );

        const candidates = doctors
          .filter((doctor) => {
            if (needsSenior && doctor.seniority !== "SENIOR") {
              return false;
            }
            if (
              !mayPlaceOnBand({
                doctor,
                date,
                band,
                workingShifts,
                doctors,
                rules,
              })
            ) {
              return false;
            }
            return true;
          })
          .sort((a, b) => {
            if (needsSenior) {
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
            shiftCode: band,
            shiftTypes,
            workingShifts,
            monthKeys,
            coverageTarget: coverage,
            leaveByDoctor,
            rules,
            purpose: "hoursFill",
          }).find((e) => e.doctor.id === doctor.id);

          if (!eligible) continue;

          const remaining = remainingMonthlyHours(
            doctor.id,
            doctor.targetHours,
            monthKeys,
            workingShifts,
          );
          if (remaining < type.durationHours) continue;

          proposals.push({
            doctorId: doctor.id,
            date: key,
            shiftCode: band,
            shiftTypeId: type.id,
            durationHours: type.durationHours,
          });
          workingShifts.push({
            doctorId: doctor.id,
            date,
            shiftCode: band,
            durationHours: type.durationHours,
          });
          placed = true;
          break;
        }

        if (!placed) break;
      }
    }
  }

  return { proposals, warnings };
}

export function isDateUnderstaffed(
  coverage: {
    date: string;
    dayShiftTarget: number;
    nightShiftTarget: number;
    lCount: number;
    nCount: number;
  },
): boolean {
  return (
    coverage.lCount < coverage.dayShiftTarget ||
    coverage.nCount < coverage.nightShiftTarget
  );
}
