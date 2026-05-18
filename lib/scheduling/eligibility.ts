import { dateKey } from "@/lib/scheduling/dates";
import { validateAssignment } from "@/lib/scheduling/validate-assignment";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
  ValidationResult,
} from "@/lib/scheduling/types";

export function isOnApprovedLeave(
  doctorId: string,
  date: Date,
  leaveByDoctor: Map<string, Set<string>>,
): boolean {
  const leaves = leaveByDoctor.get(doctorId);
  if (!leaves) return false;
  return leaves.has(dateKey(date));
}

export function isAssignedOnDate(
  doctorId: string,
  date: Date,
  workingShifts: ShiftAssignment[],
): boolean {
  const key = dateKey(date);
  return workingShifts.some(
    (s) => s.doctorId === doctorId && dateKey(s.date) === key,
  );
}

export function getEligibleDoctors(params: {
  doctors: DoctorInfo[];
  date: Date;
  shiftCode: ShiftCode;
  shiftTypes: ShiftTypeInfo[];
  workingShifts: ShiftAssignment[];
  monthKeys: string[];
  coverageTarget: CoverageTarget;
  leaveByDoctor: Map<string, Set<string>>;
}): { doctor: DoctorInfo; validation: ValidationResult }[] {
  const {
    doctors,
    date,
    shiftCode,
    shiftTypes,
    workingShifts,
    monthKeys,
    coverageTarget,
    leaveByDoctor,
  } = params;

  const eligible: { doctor: DoctorInfo; validation: ValidationResult }[] = [];

  for (const doctor of doctors) {
    if (isOnApprovedLeave(doctor.id, date, leaveByDoctor)) continue;
    if (isAssignedOnDate(doctor.id, date, workingShifts)) continue;

    const validation = validateAssignment({
      doctor,
      date,
      shiftCode,
      shiftTypes,
      existingShifts: workingShifts,
      monthKeys,
      coverageTarget,
    });

    if (validation.ok) {
      eligible.push({ doctor, validation });
    }
  }

  return eligible;
}
