import { countDaysOff } from "@/lib/scheduling/compute-hours";
import type { DoctorInfo, ShiftAssignment } from "@/lib/scheduling/types";

const MIN_DAYS_OFF = 4;

export function validateMinDaysOff(
  doctor: DoctorInfo,
  monthKeys: string[],
  existingShifts: ShiftAssignment[],
  assigningDate?: string,
): string | null {
  const keys = assigningDate
    ? monthKeys
    : monthKeys;
  const offDays = countDaysOff(doctor.id, keys, existingShifts);
  if (offDays < MIN_DAYS_OFF) {
    return `${doctor.name} has fewer than ${MIN_DAYS_OFF} days off this month (${offDays} remaining after assignment).`;
  }
  return null;
}

export function warnMinDaysOff(
  doctor: DoctorInfo,
  monthKeys: string[],
  existingShifts: ShiftAssignment[],
): string | null {
  const offDays = countDaysOff(doctor.id, monthKeys, existingShifts);
  if (offDays < MIN_DAYS_OFF) {
    return `${doctor.name} has only ${offDays} day(s) off this month (minimum recommended: ${MIN_DAYS_OFF}).`;
  }
  return null;
}
