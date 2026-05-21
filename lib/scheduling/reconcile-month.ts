import { prisma } from "@/lib/db";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import {
  suggestReconcileMonth,
  type ReconcileContext,
} from "@/lib/scheduling/reconcile-suggest";
import {
  getDailyCoverageOverrides,
  getMonthCoverageDefaults,
  loadApprovedLeave,
  loadDoctorRotations,
  loadDoctors,
  loadMainFlowSchedulingRules,
  loadShiftTypes,
  monthDateRange,
} from "@/lib/scheduling/context";
import { getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import type { ShiftAssignment } from "@/lib/scheduling/types";

export type { ReconcileContext };

export async function loadReconcileContext(
  year: number,
  month: number,
): Promise<ReconcileContext> {
  const [
    doctors,
    shiftTypes,
    monthDefaults,
    dailyOverrides,
    doctorRotations,
    leaveByDoctor,
    rules,
  ] = await Promise.all([
    loadDoctors(),
    loadShiftTypes(),
    getMonthCoverageDefaults(year, month),
    getDailyCoverageOverrides(year, month),
    loadDoctorRotations(),
    loadApprovedLeave(year, month),
    loadMainFlowSchedulingRules(),
  ]);
  return {
    year,
    month,
    doctors,
    shiftTypes,
    monthDefaults,
    dailyOverrides,
    doctorRotations,
    leaveByDoctor,
    rules,
  };
}

export async function loadManualShiftsForMonth(
  year: number,
  month: number,
): Promise<ShiftAssignment[]> {
  const { start, end } = monthDateRange(year, month);
  const rows = await prisma.shift.findMany({
    where: { date: { gte: start, lte: end }, source: "MANUAL" },
    include: { shiftType: true },
  });
  return rows.map((s) => ({
    doctorId: s.doctorId,
    date: s.date,
    shiftCode: s.shiftType.code as ShiftAssignment["shiftCode"],
    durationHours: s.shiftType.durationHours,
    source: "MANUAL" as const,
  }));
}

export async function upsertAutoProposals(proposals: AutoAssignProposal[]) {
  for (const p of proposals) {
    const date = parseDateKey(p.date);
    await prisma.shift.upsert({
      where: {
        doctorId_date: {
          doctorId: p.doctorId,
          date,
        },
      },
      create: {
        doctorId: p.doctorId,
        date,
        shiftTypeId: p.shiftTypeId,
        source: "AUTO",
      },
      update: {
        shiftTypeId: p.shiftTypeId,
        source: "AUTO",
      },
    });
  }
}

export async function reconcileMonthSchedule(year: number, month: number) {
  const ctx = await loadReconcileContext(year, month);
  const { start, end } = monthDateRange(year, month);

  const manualShifts = await loadManualShiftsForMonth(year, month);

  const deleted = await prisma.shift.deleteMany({
    where: { date: { gte: start, lte: end }, source: "AUTO" },
  });

  const result = suggestReconcileMonth(ctx, manualShifts);
  await upsertAutoProposals(result.proposals);

  return {
    ...result,
    manualCount: manualShifts.length,
    deletedAutoCount: deleted.count,
    monthKeys: getMonthDateKeys(year, month),
  };
}

export async function previewReconcileMonth(year: number, month: number) {
  const ctx = await loadReconcileContext(year, month);
  const manualShifts = await loadManualShiftsForMonth(year, month);
  return previewReconcileFromManualShifts(ctx, manualShifts);
}

export function previewReconcileFromManualShifts(
  ctx: ReconcileContext,
  manualShifts: ShiftAssignment[],
) {
  const result = suggestReconcileMonth(ctx, manualShifts);
  return {
    ...result,
    manualCount: manualShifts.length,
    manualShifts,
  };
}
