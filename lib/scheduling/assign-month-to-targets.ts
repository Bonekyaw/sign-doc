import { autoAssign, type AutoAssignResult } from "@/lib/scheduling/auto-assign";
import { rulesForAutoAssign } from "@/lib/scheduling/main-flow-rules";
import type { ReconcileContext } from "@/lib/scheduling/reconcile-suggest";
import type { ShiftAssignment } from "@/lib/scheduling/types";

export type AssignMonthParams = ReconcileContext & {
  existingShifts?: ShiftAssignment[];
};

/** Full-month assign toward each doctor's targetHours (coverage floor + hour fill + optimize). */
export function assignFullMonthToTargets(
  params: AssignMonthParams,
): AutoAssignResult {
  const { existingShifts = [], ...ctx } = params;
  return autoAssign({
    year: ctx.year,
    month: ctx.month,
    doctors: ctx.doctors,
    shiftTypes: ctx.shiftTypes,
    existingShifts,
    monthDefaults: ctx.monthDefaults,
    dailyOverrides: ctx.dailyOverrides,
    doctorRotations: ctx.doctorRotations,
    leaveByDoctor: ctx.leaveByDoctor,
    rules: rulesForAutoAssign(ctx.rules),
  });
}
