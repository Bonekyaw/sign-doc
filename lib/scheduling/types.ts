export type ShiftCode = "L" | "N" | "TWENTY_FOUR";

export type ShiftTypeInfo = {
  id: string;
  code: ShiftCode;
  label: string;
  durationHours: number;
  color: string;
  isActive: boolean;
};

export type ShiftAssignment = {
  doctorId: string;
  date: Date;
  shiftCode: ShiftCode;
  durationHours: number;
};

export type DoctorInfo = {
  id: string;
  name: string;
  targetHours: number;
  restrictions: ("NO_TWENTY_FOUR")[];
};

export type CoverageTarget = {
  dayShiftTarget: number;
  nightShiftTarget: number;
};

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};
