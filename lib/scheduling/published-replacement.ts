import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import { getEligibleDoctors } from "@/lib/scheduling/eligibility";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { validateAssignment } from "@/lib/scheduling/validate-assignment";
import type {
  CoverageTarget,
  DoctorInfo,
  DoctorSeniority,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

export type ReplacementOption = {
  doctorId: string;
  name: string;
  seniority: DoctorSeniority;
  mode: "replace" | "swap";
  theirShiftCode?: ShiftCode;
  warnings: string[];
};

function shiftOnDate(
  shifts: ShiftAssignment[],
  doctorId: string,
  key: string,
): ShiftAssignment | undefined {
  return shifts.find(
    (s) => s.doctorId === doctorId && dateKey(s.date) === key,
  );
}

function withoutAssignmentsOnDate(
  shifts: ShiftAssignment[],
  date: Date,
  doctorIds: string[],
): ShiftAssignment[] {
  const key = dateKey(date);
  const exclude = new Set(doctorIds);
  return shifts.filter(
    (s) => !(dateKey(s.date) === key && exclude.has(s.doctorId)),
  );
}

export function findSameSeniorityReplacementOptions(params: {
  doctors: DoctorInfo[];
  shifts: ShiftAssignment[];
  dateStr: string;
  fromDoctorId: string;
  shiftTypes: ShiftTypeInfo[];
  monthKeys: string[];
  coverageTarget: CoverageTarget;
  leaveByDoctor: Map<string, Set<string>>;
  rules: SchedulingRulesConfig;
}): { ok: true; options: ReplacementOption[] } | { ok: false; error: string } {
  const {
    doctors,
    shifts,
    dateStr,
    fromDoctorId,
    shiftTypes,
    monthKeys,
    coverageTarget,
    leaveByDoctor,
    rules,
  } = params;

  const date = parseDateKey(dateStr);
  const fromDoctor = doctors.find((d) => d.id === fromDoctorId);
  if (!fromDoctor) {
    return { ok: false, error: "Doctor not found." };
  }

  const outgoing = shiftOnDate(shifts, fromDoctorId, dateStr);
  if (!outgoing) {
    return { ok: false, error: "This doctor has no shift on that date." };
  }

  const options: ReplacementOption[] = [];

  for (const candidate of doctors) {
    if (candidate.id === fromDoctorId) continue;
    if (candidate.seniority !== fromDoctor.seniority) continue;

    const theirShift = shiftOnDate(shifts, candidate.id, dateStr);

    if (!theirShift) {
      const base = withoutAssignmentsOnDate(shifts, date, [fromDoctorId]);
      const eligible = getEligibleDoctors({
        doctors: [candidate],
        date,
        shiftCode: outgoing.shiftCode,
        shiftTypes,
        workingShifts: base,
        monthKeys,
        coverageTarget,
        leaveByDoctor,
        rules,
      });
      if (eligible.length === 1) {
        options.push({
          doctorId: candidate.id,
          name: candidate.name,
          seniority: candidate.seniority,
          mode: "replace",
          warnings: eligible[0]!.validation.warnings ?? [],
        });
      }
      continue;
    }

    const base = withoutAssignmentsOnDate(shifts, date, [
      fromDoctorId,
      candidate.id,
    ]);

    const toValidation = validateAssignment({
      doctor: candidate,
      date,
      shiftCode: outgoing.shiftCode,
      shiftTypes,
      existingShifts: base,
      monthKeys,
      coverageTarget,
      doctors,
      rules,
    });

    const fromValidation = validateAssignment({
      doctor: fromDoctor,
      date,
      shiftCode: theirShift.shiftCode,
      shiftTypes,
      existingShifts: base,
      monthKeys,
      coverageTarget,
      doctors,
      rules,
    });

    if (toValidation.ok && fromValidation.ok) {
      options.push({
        doctorId: candidate.id,
        name: candidate.name,
        seniority: candidate.seniority,
        mode: "swap",
        theirShiftCode: theirShift.shiftCode,
        warnings: [
          ...(toValidation.warnings ?? []),
          ...(fromValidation.warnings ?? []),
        ],
      });
    }
  }

  options.sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, options };
}

export function validatePublishedReassignment(params: {
  doctors: DoctorInfo[];
  shifts: ShiftAssignment[];
  dateStr: string;
  fromDoctorId: string;
  toDoctorId: string;
  mode: "replace" | "swap";
  shiftTypes: ShiftTypeInfo[];
  monthKeys: string[];
  coverageTarget: CoverageTarget;
  leaveByDoctor: Map<string, Set<string>>;
  rules: SchedulingRulesConfig;
}): { ok: true; warnings: string[] } | { ok: false; errors: string[] } {
  const result = findSameSeniorityReplacementOptions({
    doctors: params.doctors,
    shifts: params.shifts,
    dateStr: params.dateStr,
    fromDoctorId: params.fromDoctorId,
    shiftTypes: params.shiftTypes,
    monthKeys: params.monthKeys,
    coverageTarget: params.coverageTarget,
    leaveByDoctor: params.leaveByDoctor,
    rules: params.rules,
  });

  if (!result.ok) {
    return { ok: false, errors: [result.error] };
  }

  const match = result.options.find(
    (o) => o.doctorId === params.toDoctorId && o.mode === params.mode,
  );
  if (!match) {
    return {
      ok: false,
      errors: [
        "That colleague cannot take this shift (different level, on leave, or scheduling rules).",
      ],
    };
  }

  return { ok: true, warnings: match.warnings };
}
