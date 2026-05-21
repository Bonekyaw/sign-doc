import type { ShiftAssignment, ShiftCode, DoctorInfo } from "@/lib/scheduling/types";
import {
  ShiftType,
  type DoctorRecord,
  type ShiftRecord,
} from "@/lib/scheduling/shift-validation-service";

const CODE_TO_TYPE: Record<ShiftCode, ShiftType> = {
  L: ShiftType.LONG_DAY,
  N: ShiftType.NIGHT,
  TWENTY_FOUR: ShiftType.TWENTY_FOUR,
  OFF: ShiftType.OFF,
};

const TYPE_TO_CODE: Record<ShiftType, ShiftCode> = {
  [ShiftType.LONG_DAY]: "L",
  [ShiftType.NIGHT]: "N",
  [ShiftType.TWENTY_FOUR]: "TWENTY_FOUR",
  [ShiftType.OFF]: "OFF",
};

export function shiftCodeToShiftType(code: ShiftCode): ShiftType {
  return CODE_TO_TYPE[code];
}

export function shiftTypeToShiftCode(
  type: ShiftType,
): ShiftCode | null {
  if (type === ShiftType.OFF) return null;
  return TYPE_TO_CODE[type];
}

export function shiftAssignmentToShiftRecord(
  assignment: ShiftAssignment,
): ShiftRecord {
  return {
    doctorId: assignment.doctorId,
    date: assignment.date,
    shiftType: shiftCodeToShiftType(assignment.shiftCode),
  };
}

export function shiftAssignmentsToShiftRecords(
  assignments: ShiftAssignment[],
): ShiftRecord[] {
  return assignments.map(shiftAssignmentToShiftRecord);
}

export function doctorInfoToDoctorRecord(doctor: DoctorInfo): DoctorRecord {
  return {
    id: doctor.id,
    seniority: doctor.seniority,
    targetMonthlyHours: doctor.targetHours,
  };
}
