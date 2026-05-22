import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import { isOnApprovedLeave } from "@/lib/scheduling/eligibility";
import {
  computeMonthlyHours,
  remainingMonthlyHours,
} from "@/lib/scheduling/compute-hours";
import { mayPlaceOnBand } from "@/lib/scheduling/enforce-senior-coverage";
import { getEligibleDoctors } from "@/lib/scheduling/eligibility";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import type { DoctorRotationInfo } from "@/lib/scheduling/rotation";
import { sortMonthKeysByUnderstaffGap } from "@/lib/scheduling/coverage-priority";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

export type HourShortfall = {
  doctorId: string;
  name: string;
  targetHours: number;
  worked: number;
  remaining: number;
};

export type FillHoursResult = {
  proposals: AutoAssignProposal[];
  shortfalls: HourShortfall[];
  warnings: string[];
};

type FillHoursParams = {
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  workingShifts: ShiftAssignment[];
  monthKeys: string[];
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;
  doctorRotations?: Map<string, DoctorRotationInfo>;
  leaveByDoctor?: Map<string, Set<string>>;
  rules?: SchedulingRulesConfig;
};

type HourSlot = {
  code: ShiftCode;
  typeId: string;
  hours: number;
  band?: "L" | "N";
};

function buildHourSlots(
  shiftTypes: ShiftTypeInfo[],
  includeTwentyFour = true,
): HourSlot[] {
  const slots: HourSlot[] = [];
  const lType = shiftTypes.find((s) => s.code === "L" && s.isActive);
  const nType = shiftTypes.find((s) => s.code === "N" && s.isActive);
  const h24Type = shiftTypes.find((s) => s.code === "TWENTY_FOUR" && s.isActive);
  if (lType) {
    slots.push({
      code: "L",
      typeId: lType.id,
      hours: lType.durationHours,
      band: "L",
    });
  }
  if (nType) {
    slots.push({
      code: "N",
      typeId: nType.id,
      hours: nType.durationHours,
      band: "N",
    });
  }
  if (includeTwentyFour && h24Type) {
    slots.push({
      code: "TWENTY_FOUR",
      typeId: h24Type.id,
      hours: h24Type.durationHours,
    });
  }
  return slots;
}

function doctorWorksOnDate(
  doctorId: string,
  dateKeyStr: string,
  workingShifts: ShiftAssignment[],
): boolean {
  return workingShifts.some(
    (s) => s.doctorId === doctorId && dateKey(s.date) === dateKeyStr,
  );
}

function hasOpenDateAfter(
  doctorId: string,
  currentKey: string,
  monthKeys: string[],
  workingShifts: ShiftAssignment[],
  leaveByDoctor: Map<string, Set<string>>,
): boolean {
  const idx = monthKeys.indexOf(currentKey);
  for (let i = idx + 1; i < monthKeys.length; i++) {
    const key = monthKeys[i]!;
    if (doctorWorksOnDate(doctorId, key, workingShifts)) continue;
    const date = parseDateKey(key);
    if (isOnApprovedLeave(doctorId, date, leaveByDoctor)) continue;
    return true;
  }
  return false;
}

function orderSlotsForDoctor(
  slots: HourSlot[],
  doctor: DoctorInfo,
  date: Date,
  dateKeyStr: string,
  monthKeys: string[],
  workingShifts: ShiftAssignment[],
  coverage: CoverageTarget,
  allowTwentyFour: boolean,
  leaveByDoctor: Map<string, Set<string>>,
): HourSlot[] {
  const remaining = remainingMonthlyHours(
    doctor.id,
    doctor.targetHours,
    monthKeys,
    workingShifts,
  );

  const openAfter = hasOpenDateAfter(
    doctor.id,
    dateKeyStr,
    monthKeys,
    workingShifts,
    leaveByDoctor,
  );

  return [...slots].sort((a, b) => {
    const score = (slot: HourSlot) => {
      let s = 0;
      if (slot.hours > remaining) return 1000 + slot.hours;
      // Prefer 24h when the doctor still needs at least 24h and rules allow it.
      if (slot.code === "TWENTY_FOUR") {
        if (allowTwentyFour && remaining >= slot.hours) {
          s -= 900;
          if (slot.hours === remaining) s -= 200;
          if (!openAfter && remaining === slot.hours) s -= 100;
        } else {
          s += 500;
        }
      } else if (slot.band) {
        s += 120;
        if (allowTwentyFour && remaining >= 24 && !openAfter) {
          s += 300;
        }
      }
      // Prefer shifts that land exactly on the monthly target.
      if (slot.hours === remaining) s -= 200;
      s -= 50 - Math.abs(remaining - slot.hours);
      if (slot.band) {
        const current = countBandForDate(date, slot.band, workingShifts);
        const target =
          slot.band === "L"
            ? coverage.dayShiftTarget
            : coverage.nightShiftTarget;
        const gap = target - current;
        if (gap > 0) {
          s -= gap * 100;
        } else if (gap === 0) {
          s += 50;
        } else {
          s += 100 + current;
        }
      }
      return s;
    };
    return score(a) - score(b);
  });
}

export function computeHourShortfalls(
  doctors: DoctorInfo[],
  monthKeys: string[],
  workingShifts: ShiftAssignment[],
): HourShortfall[] {
  const shortfalls: HourShortfall[] = [];
  for (const doctor of doctors) {
    const worked = computeMonthlyHours(doctor.id, monthKeys, workingShifts);
    const remaining = Math.max(0, doctor.targetHours - worked);
    if (remaining > 0) {
      shortfalls.push({
        doctorId: doctor.id,
        name: doctor.name,
        targetHours: doctor.targetHours,
        worked,
        remaining,
      });
    }
  }
  return shortfalls;
}

export function fillHoursToTarget(params: FillHoursParams): FillHoursResult {
  const {
    doctors,
    shiftTypes,
    workingShifts,
    monthKeys,
    getCoverageForDateKey,
    rules = DEFAULT_SCHEDULING_RULES,
    leaveByDoctor = new Map(),
  } = params;

  const allSlots = buildHourSlots(shiftTypes, true);
  if (allSlots.length === 0) {
    return { proposals: [], shortfalls: [], warnings: [] };
  }

  const proposals: AutoAssignProposal[] = [];
  const warnings: string[] = [];
  const allowTwentyFour = allSlots.some((s) => s.code === "TWENTY_FOUR");

  while (true) {
    const needy = doctors
      .map((doctor) => ({
        doctor,
        remaining: remainingMonthlyHours(
          doctor.id,
          doctor.targetHours,
          monthKeys,
          workingShifts,
        ),
      }))
      .filter((x) => x.remaining > 0)
      .sort((a, b) => {
        // Lower targets first so part-time/junior doctors secure L/N before
        // full-time schedules constrain fatigue and band placement.
        return (
          a.doctor.targetHours - b.doctor.targetHours ||
          b.remaining - a.remaining
        );
      });

    if (needy.length === 0) break;

    let progress = false;

    const datesByUnderstaffGap = sortMonthKeysByUnderstaffGap(
      monthKeys,
      workingShifts,
      getCoverageForDateKey,
    );

    // Doctor-first: each needy doctor gets up to one shift per round (scan all dates).
    for (const { doctor } of needy) {
      const remainingBefore = remainingMonthlyHours(
        doctor.id,
        doctor.targetHours,
        monthKeys,
        workingShifts,
      );
      if (remainingBefore <= 0) continue;

      for (const key of datesByUnderstaffGap) {
        const date = parseDateKey(key);
        const coverage = getCoverageForDateKey(key);
        const orderedSlots = orderSlotsForDoctor(
          allSlots,
          doctor,
          date,
          key,
          monthKeys,
          workingShifts,
          coverage,
          allowTwentyFour,
          leaveByDoctor,
        );

        for (const slot of orderedSlots) {
          const remaining = remainingMonthlyHours(
            doctor.id,
            doctor.targetHours,
            monthKeys,
            workingShifts,
          );
          if (remaining < slot.hours) continue;

          if (
            slot.band &&
            !mayPlaceOnBand({
              doctor,
              date,
              band: slot.band,
              workingShifts,
              doctors,
              rules,
            })
          ) {
            continue;
          }

          const eligible = getEligibleDoctors({
            doctors,
            date,
            shiftCode: slot.code,
            shiftTypes,
            workingShifts,
            monthKeys,
            coverageTarget: coverage,
            leaveByDoctor,
            rules,
            purpose: "hoursFill",
          }).find((e) => e.doctor.id === doctor.id);

          if (!eligible) continue;

          const validation = eligible.validation;
          proposals.push({
            doctorId: doctor.id,
            date: key,
            shiftCode: slot.code,
            shiftTypeId: slot.typeId,
            durationHours: slot.hours,
          });
          workingShifts.push({
            doctorId: doctor.id,
            date,
            shiftCode: slot.code,
            durationHours: slot.hours,
          });
          if (validation.warnings.length) {
            warnings.push(
              ...validation.warnings.map(
                (w) => `${key} (${doctor.name}, hour-fill): ${w}`,
              ),
            );
          }
          progress = true;
          break;
        }

        if (
          remainingMonthlyHours(
            doctor.id,
            doctor.targetHours,
            monthKeys,
            workingShifts,
          ) <= 0
        ) {
          break;
        }
      }
    }

    if (!progress) {
      break;
    }
  }

  const shortfalls = computeHourShortfalls(doctors, monthKeys, workingShifts);
  if (shortfalls.length > 0) {
    for (const s of shortfalls) {
      warnings.push(
        `${s.name}: ${s.worked}h / ${s.targetHours}h (${s.remaining}h short of monthly target).`,
      );
    }
  }

  return {
    proposals,
    shortfalls,
    warnings,
  };
}

/** Repeated hour-fill until every doctor reaches target or no legal slots remain. */
export function fillAllDoctorsToTarget(
  params: FillHoursParams,
): FillHoursResult {
  const workingShifts: ShiftAssignment[] = [...params.workingShifts];
  const allProposals: AutoAssignProposal[] = [];
  const allWarnings: string[] = [];
  const maxPasses = params.monthKeys.length * params.doctors.length;

  for (let pass = 0; pass < maxPasses; pass++) {
    const result = fillHoursToTarget({
      ...params,
      workingShifts,
    });
    allProposals.push(...result.proposals);
    allWarnings.push(...result.warnings);
    for (const p of result.proposals) {
      workingShifts.push({
        doctorId: p.doctorId,
        date: parseDateKey(p.date),
        shiftCode: p.shiftCode,
        durationHours: p.durationHours,
      });
    }
    if (result.shortfalls.length === 0) break;
    if (result.proposals.length === 0) break;
  }

  return {
    proposals: allProposals,
    shortfalls: computeHourShortfalls(
      params.doctors,
      params.monthKeys,
      workingShifts,
    ),
    warnings: allWarnings,
  };
}
