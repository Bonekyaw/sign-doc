import type { DoctorInfo, ShiftCode } from "@/lib/scheduling/types";

export function validateRestrictions(
  doctor: DoctorInfo,
  shiftCode: ShiftCode,
): string | null {
  if (
    shiftCode === "TWENTY_FOUR" &&
    doctor.restrictions.includes("NO_TWENTY_FOUR")
  ) {
    return `${doctor.name} is tagged girls off 24h and cannot be assigned to 24-hour shifts.`;
  }
  return null;
}
