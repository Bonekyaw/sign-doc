import { assignFullMonthToTargets } from "@/lib/scheduling/assign-month-to-targets";
import type { DoctorRotationInfo } from "@/lib/scheduling/rotation";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import type {
  DoctorInfo,
  ShiftAssignment,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

export type ReconcileContext = {
  year: number;
  month: number;
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  monthDefaults: { dayShiftTarget: number; nightShiftTarget: number };
  dailyOverrides: Map<
    string,
    { dayShiftTarget: number; nightShiftTarget: number }
  >;
  doctorRotations: Map<string, DoctorRotationInfo>;
  leaveByDoctor: Map<string, Set<string>>;
  rules: SchedulingRulesConfig;
};

export function suggestReconcileMonth(
  ctx: ReconcileContext,
  manualShifts: ShiftAssignment[],
) {
  return assignFullMonthToTargets({
    ...ctx,
    existingShifts: manualShifts,
  });
}
