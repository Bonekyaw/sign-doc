import { validateShift } from "@/lib/validate-shift";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { validateCoverage } from "@/lib/scheduling/validate-coverage";
import { validateDayManpower } from "@/lib/scheduling/validate-day-manpower";
import { validateHours } from "@/lib/scheduling/validate-hours";
import { warnMinDaysOff } from "@/lib/scheduling/validate-min-days-off";
import { validateRestrictions } from "@/lib/scheduling/validate-restrictions";
import { validateSeniorManpowerForDate } from "@/lib/scheduling/validate-senior-manpower";
import { validateOffStreakOnAssign } from "@/lib/scheduling/validate-consecutive-off";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
  ValidationResult,
} from "@/lib/scheduling/types";

export type AssignmentPurpose = "coverage" | "hoursFill" | "manualEdit";

export function validateAssignment(params: {
  doctor: DoctorInfo;
  date: Date;
  shiftCode: ShiftCode;
  shiftTypes: ShiftTypeInfo[];
  existingShifts: ShiftAssignment[];
  monthKeys: string[];
  coverageTarget: CoverageTarget;
  doctors: DoctorInfo[];
  rules?: SchedulingRulesConfig;
  purpose?: AssignmentPurpose;
}): ValidationResult {
  const {
    doctor,
    date,
    shiftCode,
    shiftTypes,
    existingShifts,
    monthKeys,
    coverageTarget,
    doctors,
    rules = DEFAULT_SCHEDULING_RULES,
    purpose = "coverage",
  } = params;

  const allowOverCoverage =
    purpose === "hoursFill" || purpose === "manualEdit";
  const errors: string[] = [];
  const warnings: string[] = [];

  const config = shiftTypes.find((s) => s.code === shiftCode);
  if (!config) {
    return { ok: false, errors: ["Unknown shift type."], warnings: [] };
  }
  if (!config.isActive) {
    return { ok: false, errors: ["This shift type is inactive."], warnings: [] };
  }

  const restrictionError = validateRestrictions(doctor, shiftCode);
  if (restrictionError) errors.push(restrictionError);

  const fatigueError = validateShift(
    doctor.id,
    date,
    shiftCode,
    existingShifts,
    rules,
  );
  if (fatigueError) errors.push(fatigueError);

  const hoursError = validateHours(
    doctor,
    monthKeys,
    existingShifts,
    config.durationHours,
    date,
  );
  if (hoursError) errors.push(hoursError);

  const { error: coverageError, warning: coverageWarning } = validateCoverage(
    date,
    shiftCode,
    existingShifts,
    coverageTarget,
    doctor.id,
    { allowOverCoverage },
  );
  if (coverageError) errors.push(coverageError);
  if (coverageWarning) warnings.push(coverageWarning);

  const proposedShifts: ShiftAssignment[] = [
    ...existingShifts.filter(
      (s) =>
        !(
          s.doctorId === doctor.id &&
          s.date.toISOString().slice(0, 10) === date.toISOString().slice(0, 10)
        ),
    ),
    {
      doctorId: doctor.id,
      date,
      shiftCode,
      durationHours: config.durationHours,
    },
  ];
  const dayManpower = validateDayManpower(
    date,
    proposedShifts,
    coverageTarget,
    undefined,
    { allowOverCoverage },
  );
  errors.push(...dayManpower.errors);
  warnings.push(...dayManpower.warnings);

  warnings.push(
    ...validateSeniorManpowerForDate(date, proposedShifts, doctors, rules),
  );

  const offStreakError = validateOffStreakOnAssign(
    doctor.id,
    doctor.name,
    date,
    monthKeys,
    existingShifts,
    rules,
  );
  if (offStreakError) errors.push(offStreakError);

  const offWarning = warnMinDaysOff(doctor, monthKeys, proposedShifts, rules);
  if (offWarning) warnings.push(offWarning);

  return { ok: errors.length === 0, errors, warnings };
}
