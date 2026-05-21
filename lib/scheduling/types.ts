export type ShiftCode = "L" | "N" | "TWENTY_FOUR" | "OFF";

export type DoctorSeniority = "SENIOR" | "MID_LEVEL" | "JUNIOR";

export type ShiftTypeInfo = {
  id: string;
  code: ShiftCode;
  label: string;
  durationHours: number;
  color: string;
  isActive: boolean;
};

export type ShiftSource = "MANUAL" | "AUTO";

export type ShiftAssignment = {
  doctorId: string;
  date: Date;
  shiftCode: ShiftCode;
  durationHours: number;
  source?: ShiftSource;
};

export type DoctorInfo = {
  id: string;
  name: string;
  seniority: DoctorSeniority;
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
