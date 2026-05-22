import {
  addDays,
  dateKey,
  getMonthDateKeys,
  parseDateKey,
} from "@/lib/scheduling/dates";
import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import { rulesForMainFlow } from "@/lib/scheduling/main-flow-rules";
import { validateShift } from "@/lib/validate-shift";
import { validateConsecutiveOffDays } from "@/lib/scheduling/validate-consecutive-off";
import { validateSeniorManpowerForDate } from "@/lib/scheduling/validate-senior-manpower";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import type {
  AutoAssignProposal,
} from "@/lib/scheduling/auto-assign";
import type {
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
} from "@/lib/scheduling/types";

/** Audit a schedule against main-flow rules; returns human-readable violations. */
export function auditMainFlowSchedule(params: {
  year: number;
  month: number;
  doctors: DoctorInfo[];
  proposals: AutoAssignProposal[];
  baseShifts?: ShiftAssignment[];
  rules?: SchedulingRulesConfig;
}): string[] {
  const {
    year,
    month,
    doctors,
    proposals,
    baseShifts = [],
    rules: inputRules,
  } = params;
  const rules = rulesForMainFlow(inputRules);
  const monthKeys = getMonthDateKeys(year, month);
  const violations: string[] = [];

  const map = new Map<string, ShiftAssignment>();
  for (const s of baseShifts) {
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
  const allShifts = [...map.values()];

  for (const p of proposals) {
    const doctor = doctors.find((d) => d.id === p.doctorId);
    const date = parseDateKey(p.date);
    const others = allShifts.filter(
      (s) =>
        !(
          s.doctorId === p.doctorId && dateKey(s.date) === p.date
        ),
    );

    const fatigue = validateShift(
      p.doctorId,
      date,
      p.shiftCode,
      others,
      rules,
    );
    if (fatigue) {
      violations.push(
        `${p.date} ${doctor?.name ?? p.doctorId} ${p.shiftCode}: ${fatigue}`,
      );
    }
  }

  const staffedDates = new Set<string>();
  for (const s of allShifts) {
    if (s.shiftCode === "L" || s.shiftCode === "N") {
      staffedDates.add(dateKey(s.date));
    }
  }
  for (const key of staffedDates) {
    const date = parseDateKey(key);
    const dayShifts = allShifts.filter((s) => dateKey(s.date) === key);
    const seniorErrors = validateSeniorManpowerForDate(
      date,
      dayShifts,
      doctors,
      rules,
    );
    violations.push(
      ...seniorErrors.map((e) => `${key}: ${e}`),
    );
  }

  for (const doctor of doctors) {
    const offErr = validateConsecutiveOffDays(
      doctor.id,
      doctor.name,
      monthKeys,
      allShifts,
      rules,
    );
    if (offErr) violations.push(offErr);
  }

  return violations;
}

/** Validate a full month schedule against main-flow (fatigue, senior, off-days, FT hours). */
export function validateShiftsAgainstMainFlow(params: {
  year: number;
  month: number;
  doctors: DoctorInfo[];
  shifts: ShiftAssignment[];
  rules?: SchedulingRulesConfig;
  requireMonthlyHourTargets?: boolean;
}): string[] {
  const {
    year,
    month,
    doctors,
    shifts,
    rules: inputRules,
    requireMonthlyHourTargets = false,
  } = params;
  const rules = rulesForMainFlow(inputRules);
  const monthKeys = getMonthDateKeys(year, month);

  const proposals: AutoAssignProposal[] = shifts.map((s) => ({
    doctorId: s.doctorId,
    date: dateKey(s.date),
    shiftCode: s.shiftCode,
    shiftTypeId: "",
    durationHours: s.durationHours,
  }));

  const violations = auditMainFlowSchedule({
    year,
    month,
    doctors,
    proposals,
    baseShifts: [],
    rules,
  });

  if (requireMonthlyHourTargets) {
    for (const doctor of doctors) {
      const worked = computeMonthlyHours(doctor.id, monthKeys, shifts);
      if (worked < doctor.targetHours) {
        const short = doctor.targetHours - worked;
        violations.push(
          `${doctor.name}: ${worked}h / ${doctor.targetHours}h (${short}h short of monthly target).`,
        );
      }
    }
  }

  return violations;
}

/** True when Night → Long Day appears in the schedule (forbidden by main-flow). */
export function hasNightBeforeLongDay(
  shifts: ShiftAssignment[],
): boolean {
  for (const s of shifts) {
    if (s.shiftCode !== "L") continue;
    const prevKey = dateKey(addDays(s.date, -1));
    const prev = shifts.find(
      (x) =>
        x.doctorId === s.doctorId && dateKey(x.date) === prevKey,
    );
    if (prev?.shiftCode === "N") return true;
  }
  return false;
}

/** True when Night → 24h appears in the schedule (forbidden by main-flow). */
export function hasNightBeforeTwentyFour(
  shifts: ShiftAssignment[],
): boolean {
  for (const s of shifts) {
    if (s.shiftCode !== "TWENTY_FOUR") continue;
    const prevKey = dateKey(addDays(s.date, -1));
    const prev = shifts.find(
      (x) =>
        x.doctorId === s.doctorId && dateKey(x.date) === prevKey,
    );
    if (prev?.shiftCode === "N") return true;
  }
  return false;
}
