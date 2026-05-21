import { countDaysOff } from "@/lib/scheduling/compute-hours";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import type { DoctorInfo, ShiftAssignment } from "@/lib/scheduling/types";

export function validateMinDaysOff(
  doctor: DoctorInfo,
  monthKeys: string[],
  existingShifts: ShiftAssignment[],
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): string | null {
  const offDays = countDaysOff(doctor.id, monthKeys, existingShifts);
  const min = rules.minDaysOffPerMonth;
  if (offDays < min) {
    return `${doctor.name} has fewer than ${min} days off this month (${offDays} remaining after assignment).`;
  }
  return null;
}

export function warnMinDaysOff(
  doctor: DoctorInfo,
  monthKeys: string[],
  existingShifts: ShiftAssignment[],
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): string | null {
  const offDays = countDaysOff(doctor.id, monthKeys, existingShifts);
  const min = rules.minDaysOffPerMonth;
  if (offDays < min) {
    return `${doctor.name} has only ${offDays} day(s) off this month (minimum recommended: ${min}).`;
  }
  return null;
}
