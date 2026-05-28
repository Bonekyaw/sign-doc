import { dateKey, getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import { runAutoScheduler } from "@/lib/scheduling/auto-scheduler";
import {
  computeHourShortfalls,
  fillAllDoctorsToTarget,
  type HourShortfall,
} from "@/lib/scheduling/auto-assign-hours";
import { fillUnderstaffedCoverage } from "@/lib/scheduling/fill-understaffed-coverage";
import { fillTwentyFourCoverage } from "@/lib/scheduling/fill-twenty-four-coverage";
import { optimizeAssignments } from "@/lib/scheduling/auto-assign-optimize";
import type { DoctorRotationInfo } from "@/lib/scheduling/rotation";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { repairSeniorManpower } from "@/lib/scheduling/enforce-senior-coverage";
import { rulesForAutoAssign } from "@/lib/scheduling/main-flow-rules";
import { filterCompliantProposals } from "@/lib/scheduling/filter-compliant-proposals";
import { auditMainFlowSchedule } from "@/lib/scheduling/validate-main-flow";
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

export type { HourShortfall };

export type AutoAssignResult = {
  proposals: AutoAssignProposal[];
  unfilled: UnfilledSlot[];
  warnings: string[];
  swapCount: number;
  hourShortfalls: HourShortfall[];
  removedViolationCount: number;
};

function getCoverageForDate(
  dateKeyStr: string,
  defaults: CoverageTarget,
  overrides: Map<string, CoverageTarget>,
): CoverageTarget {
  return overrides.get(dateKeyStr) ?? defaults;
}

function applyProposalsToWorking(
  workingShifts: ShiftAssignment[],
  newProposals: AutoAssignProposal[],
): void {
  for (const p of newProposals) {
    workingShifts.push({
      doctorId: p.doctorId,
      date: parseDateKey(p.date),
      shiftCode: p.shiftCode,
      durationHours: p.durationHours,
    });
  }
}

/** Alternates coverage gap-fill and hour-fill for doctors below monthly targets. */
function runCoverageAndHourFillLoop(params: {
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  workingShifts: ShiftAssignment[];
  monthKeys: string[];
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;
  doctorRotations?: Map<string, DoctorRotationInfo>;
  leaveByDoctor?: Map<string, Set<string>>;
  rules?: SchedulingRulesConfig;
  maxPasses?: number;
}): { proposals: AutoAssignProposal[]; warnings: string[] } {
  const {
    doctors,
    shiftTypes,
    workingShifts,
    monthKeys,
    getCoverageForDateKey,
    doctorRotations,
    leaveByDoctor,
    rules,
    maxPasses = Math.max(4, monthKeys.length),
  } = params;

  const proposals: AutoAssignProposal[] = [];
  const warnings: string[] = [];

  for (let pass = 0; pass < maxPasses; pass++) {
    const twentyFourFill = fillTwentyFourCoverage({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey,
      leaveByDoctor,
      rules,
    });
    const coverageFill = fillUnderstaffedCoverage({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey,
      leaveByDoctor,
      rules,
    });
    const hourFill = fillAllDoctorsToTarget({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey,
      doctorRotations,
      leaveByDoctor,
      rules,
    });

    proposals.push(
      ...twentyFourFill.proposals,
      ...coverageFill.proposals,
      ...hourFill.proposals,
    );
    warnings.push(
      ...twentyFourFill.warnings,
      ...coverageFill.warnings,
      ...hourFill.warnings,
    );
    applyProposalsToWorking(workingShifts, twentyFourFill.proposals);
    applyProposalsToWorking(workingShifts, coverageFill.proposals);
    applyProposalsToWorking(workingShifts, hourFill.proposals);

    if (
      twentyFourFill.proposals.length === 0 &&
      coverageFill.proposals.length === 0 &&
      hourFill.proposals.length === 0
    ) {
      break;
    }
  }

  return { proposals, warnings };
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
  rules?: SchedulingRulesConfig;
}): AutoAssignResult {
  const {
    year,
    month,
    doctors,
    shiftTypes,
    existingShifts,
    monthDefaults,
    dailyOverrides,
    rules: inputRules = DEFAULT_SCHEDULING_RULES,
    doctorRotations = new Map(),
    leaveByDoctor = new Map(),
  } = params;

  const rules = rulesForAutoAssign(inputRules);
  const monthKeys = getMonthDateKeys(year, month);
  const warnings: string[] = [];

  const lType = shiftTypes.find((s) => s.code === "L");
  const nType = shiftTypes.find((s) => s.code === "N");
  if (!lType || !nType) {
    return {
      proposals: [],
      unfilled: [],
      warnings: ["Long Day and Night shift types must be configured."],
      swapCount: 0,
      hourShortfalls: [],
      removedViolationCount: 0,
    };
  }

  const getCoverageForDateKey = (key: string) =>
    getCoverageForDate(key, monthDefaults, dailyOverrides);

  const schedulerResult = runAutoScheduler({
    doctors,
    shiftTypes,
    monthKeys,
    existingShifts,
    getCoverageForDateKey,
    leaveByDoctor,
    doctorRotations,
    rules,
  });

  let proposals = schedulerResult.proposals;
  warnings.push(...schedulerResult.warnings);

  const workingShifts: ShiftAssignment[] = [...existingShifts];
  for (const p of proposals) {
    workingShifts.push({
      doctorId: p.doctorId,
      date: parseDateKey(p.date),
      shiftCode: p.shiftCode,
      durationHours: p.durationHours,
    });
  }

  const initialFill = runCoverageAndHourFillLoop({
    doctors,
    shiftTypes,
    workingShifts,
    monthKeys,
    getCoverageForDateKey,
    doctorRotations,
    leaveByDoctor,
    rules,
  });
  proposals.push(...initialFill.proposals);
  warnings.push(...initialFill.warnings);

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
    rules,
  });

  const { proposals: seniorRepaired, warnings: seniorWarnings } =
    repairSeniorManpower({
      proposals: optimized,
      baseShifts: existingShifts,
      doctors,
      shiftTypes,
      monthKeys,
      getCoverageForDateKey,
      leaveByDoctor,
      rules,
    });

  let compliant = filterCompliantProposals({
    proposals: seniorRepaired,
    baseShifts: existingShifts,
    doctors,
    shiftTypes,
    monthKeys,
    getCoverageForDateKey,
    rules,
  }).proposals;
  let droppedCount =
    seniorRepaired.length - compliant.length;

  let finalWorking = buildWorkingFromProposals(existingShifts, compliant);

  const topUpFill = runCoverageAndHourFillLoop({
    doctors,
    shiftTypes,
    workingShifts: finalWorking,
    monthKeys,
    getCoverageForDateKey,
    doctorRotations,
    leaveByDoctor,
    rules,
  });
  if (topUpFill.proposals.length > 0) {
    const merged = [...compliant, ...topUpFill.proposals];
    const refiltered = filterCompliantProposals({
      proposals: merged,
      baseShifts: existingShifts,
      doctors,
      shiftTypes,
      monthKeys,
      getCoverageForDateKey,
      rules,
    });
    droppedCount += merged.length - refiltered.proposals.length;
    compliant = refiltered.proposals;
    warnings.push(...topUpFill.warnings);
  }

  finalWorking = buildWorkingFromProposals(existingShifts, compliant);

  const unfilled = buildUnfilledSlots(
    monthKeys,
    getCoverageForDateKey,
    finalWorking,
  );

  const mainFlowViolations = auditMainFlowSchedule({
    year,
    month,
    doctors,
    proposals: compliant,
    baseShifts: existingShifts,
    rules,
  });

  const complianceWarnings: string[] = [];
  if (droppedCount > 0) {
    complianceWarnings.push(
      `Removed ${droppedCount} shift(s) that violated main-flow rules.`,
    );
  }
  if (mainFlowViolations.length > 0) {
    complianceWarnings.push(
      ...mainFlowViolations.map((v) => `Main-flow rule: ${v}`),
    );
  }

  return {
    proposals: compliant,
    unfilled,
    warnings: [
      ...warnings,
      ...optimizationWarnings,
      ...seniorWarnings,
      ...complianceWarnings,
    ],
    swapCount,
    hourShortfalls: computeHourShortfalls(doctors, monthKeys, finalWorking),
    removedViolationCount: droppedCount,
  };
}

function buildUnfilledSlots(
  monthKeys: string[],
  getCoverageForDateKey: (key: string) => CoverageTarget,
  shifts: ShiftAssignment[],
): UnfilledSlot[] {
  const unfilled: UnfilledSlot[] = [];
  for (const key of monthKeys) {
    const date = parseDateKey(key);
    const coverage = getCoverageForDateKey(key);
    const lCount = countBandForDate(date, "L", shifts);
    const nCount = countBandForDate(date, "N", shifts);
    if (lCount < coverage.dayShiftTarget) {
      unfilled.push({
        date: key,
        band: "L",
        needed: coverage.dayShiftTarget,
        assigned: lCount,
      });
    }
    if (nCount < coverage.nightShiftTarget) {
      unfilled.push({
        date: key,
        band: "N",
        needed: coverage.nightShiftTarget,
        assigned: nCount,
      });
    }
  }
  return unfilled;
}

function buildWorkingFromProposals(
  base: ShiftAssignment[],
  proposals: AutoAssignProposal[],
): ShiftAssignment[] {
  const map = new Map<string, ShiftAssignment>();
  for (const s of base) {
    map.set(`${s.doctorId}__${dateKey(s.date)}`, s);
  }
  for (const p of proposals) {
    map.set(`${p.doctorId}__${p.date}`, {
      doctorId: p.doctorId,
      date: parseDateKey(p.date),
      shiftCode: p.shiftCode,
      durationHours: p.durationHours,
    });
  }
  return [...map.values()];
}

// Re-export for tests that import rankCandidates from auto-assign
export { rankCandidates } from "@/lib/scheduling/auto-assign-ranking";
