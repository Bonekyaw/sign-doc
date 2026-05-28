import { prisma } from "@/lib/db";
import { normalizeManpowerTargets } from "@/lib/scheduling/constants";
import { dateKey, getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import {
  buildDoctorRotationMap,
  type DoctorRotationInfo,
  type RotationStepType,
} from "@/lib/scheduling/rotation";
import { rulesForMainFlow } from "@/lib/scheduling/main-flow-rules";
import {
  DEFAULT_SCHEDULING_RULES,
  mapSchedulingRulesRow,
  SCHEDULING_RULES_ID,
  type SchedulingRulesConfig,
} from "@/lib/scheduling/rules-types";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

export type { SchedulingRulesConfig };

export async function loadSchedulingRules(): Promise<SchedulingRulesConfig> {
  const row = await loadSchedulingRulesRow();
  return mapSchedulingRulesRow(row);
}

/** Stored settings capped/enforced per `.cursor/rules/main-flow.mdc`. */
export async function loadMainFlowSchedulingRules(): Promise<SchedulingRulesConfig> {
  return rulesForMainFlow(await loadSchedulingRules());
}

export async function loadSchedulingRulesRow() {
  return prisma.schedulingRules.upsert({
    where: { id: SCHEDULING_RULES_ID },
    create: { id: SCHEDULING_RULES_ID, ...DEFAULT_SCHEDULING_RULES },
    update: {},
  });
}

export async function loadShiftTypes(): Promise<ShiftTypeInfo[]> {
  const rows = await prisma.shiftTypeConfig.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code as ShiftCode,
    label: r.label,
    durationHours: r.durationHours,
    color: r.color,
    isActive: r.isActive,
  }));
}

export async function loadDoctors(): Promise<DoctorInfo[]> {
  const rows = await prisma.doctor.findMany({
    include: { restrictions: true },
    orderBy: { name: "asc" },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    seniority: d.seniority,
    targetHours: d.targetMonthlyHours,
    restrictions: d.restrictions.map((r) => r.type as "NO_TWENTY_FOUR"),
    schedulingRuleExempt: d.schedulingRuleExempt,
  }));
}

export async function loadDoctorRotations(): Promise<
  Map<string, DoctorRotationInfo>
> {
  const rows = await prisma.doctorRotation.findMany({
    include: {
      template: { include: { steps: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  return buildDoctorRotationMap(
    rows.map((r) => ({
      doctorId: r.doctorId,
      startDate: r.startDate,
      startOffset: r.startOffset,
      template: {
        steps: r.template.steps.map((s) => ({
          sortOrder: s.sortOrder,
          stepType: s.stepType as RotationStepType,
        })),
      },
    })),
  );
}

export async function loadApprovedLeave(
  year: number,
  month: number,
): Promise<Map<string, Set<string>>> {
  const keys = getMonthDateKeys(year, month);
  const start = parseDateKey(keys[0]);
  const end = parseDateKey(keys[keys.length - 1]);
  const rows = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      date: { gte: start, lte: end },
    },
  });
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = map.get(row.doctorId) ?? new Set<string>();
    set.add(dateKey(row.date));
    map.set(row.doctorId, set);
  }
  return map;
}

export async function loadMonthShifts(
  year: number,
  month: number,
): Promise<ShiftAssignment[]> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const rows = await prisma.shift.findMany({
    where: { date: { gte: start, lte: end } },
    include: { shiftType: true },
  });
  return rows.map((s) => ({
    doctorId: s.doctorId,
    date: s.date,
    shiftCode: s.shiftType.code as ShiftCode,
    durationHours: s.shiftType.durationHours,
    source: s.source,
  }));
}

export function monthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

export async function getMonthCoverageDefaults(
  year: number,
  month: number,
): Promise<CoverageTarget> {
  const settings = await prisma.monthSettings.findUnique({
    where: { year_month: { year, month } },
  });
  return normalizeManpowerTargets(
    settings?.dayShiftTarget ?? 4,
    settings?.nightShiftTarget ?? 3,
  );
}

export async function getDailyCoverageOverrides(
  year: number,
  month: number,
): Promise<Map<string, CoverageTarget>> {
  const keys = getMonthDateKeys(year, month);
  const start = parseDateKey(keys[0]);
  const end = parseDateKey(keys[keys.length - 1]);
  const rows = await prisma.dailyCoverage.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const map = new Map<string, CoverageTarget>();
  for (const row of rows) {
    map.set(
      dateKey(row.date),
      normalizeManpowerTargets(row.dayShiftTarget, row.nightShiftTarget),
    );
  }
  return map;
}

export async function getCoverageForDate(
  year: number,
  month: number,
  date: Date,
): Promise<CoverageTarget> {
  const key = dateKey(date);
  const override = await prisma.dailyCoverage.findUnique({
    where: { date: parseDateKey(key) },
  });
  if (override) {
    return {
      dayShiftTarget: override.dayShiftTarget,
      nightShiftTarget: override.nightShiftTarget,
    };
  }
  return getMonthCoverageDefaults(year, month);
}

export function shiftCodeFromId(
  shiftTypes: ShiftTypeInfo[],
  shiftTypeId: string,
): ShiftCode | null {
  return shiftTypes.find((s) => s.id === shiftTypeId)?.code ?? null;
}
