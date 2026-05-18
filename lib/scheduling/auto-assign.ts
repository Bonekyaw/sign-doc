import { dateKey, getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import { remainingMonthlyHours } from "@/lib/scheduling/compute-hours";
import { getEligibleDoctors } from "@/lib/scheduling/eligibility";
import { optimizeAssignments } from "@/lib/scheduling/auto-assign-optimize";
import { matchesRotationForShift } from "@/lib/scheduling/rotation";
import type { DoctorRotationInfo } from "@/lib/scheduling/rotation";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

export type AutoAssignProposal = {
  doctorId: string;
  date: string;
  shiftCode: ShiftCode;
  shiftTypeId: string;
  durationHours: number;
};

export type UnfilledSlot = {
  date: string;
  band: "L" | "N";
  needed: number;
  assigned: number;
};

export type AutoAssignResult = {
  proposals: AutoAssignProposal[];
  unfilled: UnfilledSlot[];
  warnings: string[];
  swapCount: number;
};

function getCoverageForDate(
  dateKeyStr: string,
  defaults: CoverageTarget,
  overrides: Map<string, CoverageTarget>,
): CoverageTarget {
  return overrides.get(dateKeyStr) ?? defaults;
}

type RankedCandidate = {
  doctor: DoctorInfo;
  rotationMatch: number;
  remaining: number;
  shiftCount: number;
};

export function rankCandidates(
  eligible: { doctor: DoctorInfo }[],
  monthKeys: string[],
  workingShifts: ShiftAssignment[],
  date: Date,
  shiftCode: ShiftCode,
  doctorRotations: Map<string, DoctorRotationInfo>,
): RankedCandidate[] {
  return eligible
    .map(({ doctor }) => {
      const rotation = doctorRotations.get(doctor.id);
      const rotationMatch = matchesRotationForShift(
        rotation,
        date,
        shiftCode,
      )
        ? 0
        : 1;
      const remaining = remainingMonthlyHours(
        doctor.id,
        doctor.targetHours,
        monthKeys,
        workingShifts,
      );
      const shiftCount = workingShifts.filter(
        (s) => s.doctorId === doctor.id,
      ).length;
      return { doctor, rotationMatch, remaining, shiftCount };
    })
    .sort(
      (a, b) =>
        a.rotationMatch - b.rotationMatch ||
        b.remaining - a.remaining ||
        a.shiftCount - b.shiftCount,
    );
}

export function autoAssign(params: {
  year: number;
  month: number;
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  existingShifts: ShiftAssignment[];
  monthDefaults: CoverageTarget;
  dailyOverrides: Map<string, CoverageTarget>;
  doctorRotations?: Map<string, DoctorRotationInfo>;
  leaveByDoctor?: Map<string, Set<string>>;
}): AutoAssignResult {
  const {
    year,
    month,
    doctors,
    shiftTypes,
    existingShifts,
    monthDefaults,
    dailyOverrides,
    doctorRotations = new Map(),
    leaveByDoctor = new Map(),
  } = params;

  const monthKeys = getMonthDateKeys(year, month);
  const workingShifts: ShiftAssignment[] = [...existingShifts];
  const proposals: AutoAssignProposal[] = [];
  const unfilled: UnfilledSlot[] = [];
  const warnings: string[] = [];

  const lType = shiftTypes.find((s) => s.code === "L");
  const nType = shiftTypes.find((s) => s.code === "N");
  if (!lType || !nType) {
    return {
      proposals: [],
      unfilled: [],
      warnings: ["Long Day and Night shift types must be configured."],
      swapCount: 0,
    };
  }

  const getCoverageForDateKey = (key: string) =>
    getCoverageForDate(key, monthDefaults, dailyOverrides);

  for (const key of monthKeys) {
    const date = parseDateKey(key);
    const coverage = getCoverageForDateKey(key);

    const slots: {
      band: "L" | "N";
      code: ShiftCode;
      typeId: string;
      hours: number;
      target: number;
    }[] = [
      {
        band: "L",
        code: "L",
        typeId: lType.id,
        hours: lType.durationHours,
        target: coverage.dayShiftTarget,
      },
      {
        band: "N",
        code: "N",
        typeId: nType.id,
        hours: nType.durationHours,
        target: coverage.nightShiftTarget,
      },
    ];

    for (const slot of slots) {
      const alreadyFilled = countBandForDate(
        date,
        slot.band,
        workingShifts,
      );
      const gaps = Math.max(0, slot.target - alreadyFilled);

      if (gaps === 0) continue;

      const eligible = getEligibleDoctors({
        doctors,
        date,
        shiftCode: slot.code,
        shiftTypes,
        workingShifts,
        monthKeys,
        coverageTarget: coverage,
        leaveByDoctor,
      });

      const validationByDoctor = new Map(
        eligible.map((e) => [e.doctor.id, e.validation]),
      );
      const ranked = rankCandidates(
        eligible,
        monthKeys,
        workingShifts,
        date,
        slot.code,
        doctorRotations,
      );

      let placed = 0;
      for (const { doctor } of ranked) {
        if (placed >= gaps) break;
        const validation = validationByDoctor.get(doctor.id);

        const proposal: AutoAssignProposal = {
          doctorId: doctor.id,
          date: key,
          shiftCode: slot.code,
          shiftTypeId: slot.typeId,
          durationHours: slot.hours,
        };
        proposals.push(proposal);
        workingShifts.push({
          doctorId: doctor.id,
          date,
          shiftCode: slot.code,
          durationHours: slot.hours,
        });
        if (validation?.warnings.length) {
          warnings.push(
            ...validation.warnings.map((w) => `${key} (${doctor.name}): ${w}`),
          );
        }
        placed++;
      }

      const totalAfter = alreadyFilled + placed;
      if (totalAfter < slot.target) {
        unfilled.push({
          date: key,
          band: slot.band,
          needed: slot.target,
          assigned: totalAfter,
        });
        warnings.push(
          `${key} ${slot.band}: understaffed — need ${slot.target}, assigned ${totalAfter} (${slot.target - totalAfter} short).`,
        );
      }
    }
  }

  const {
    proposals: optimized,
    optimizationWarnings,
    swapCount,
  } = optimizeAssignments({
    proposals,
    baseShifts: existingShifts,
    doctors,
    shiftTypes,
    monthKeys,
    getCoverageForDateKey,
    doctorRotations,
    leaveByDoctor,
  });

  return {
    proposals: optimized,
    unfilled,
    warnings: [...warnings, ...optimizationWarnings],
    swapCount,
  };
}
