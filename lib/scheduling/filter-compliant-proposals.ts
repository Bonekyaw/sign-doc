import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { validateAssignment } from "@/lib/scheduling/validate-assignment";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

/** Keep only proposals that pass full assignment validation when applied in order. */
export function filterCompliantProposals(params: {
  proposals: AutoAssignProposal[];
  baseShifts: ShiftAssignment[];
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  monthKeys: string[];
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;
  rules: SchedulingRulesConfig;
}): { proposals: AutoAssignProposal[]; droppedCount: number } {
  const doctorsById = new Map(params.doctors.map((d) => [d.id, d]));
  const sorted = [...params.proposals].sort(
    (a, b) => a.date.localeCompare(b.date) || a.doctorId.localeCompare(b.doctorId),
  );

  const anchoredKeys = new Set(
    params.baseShifts.map((s) => `${s.doctorId}__${dateKey(s.date)}`),
  );

  const working: ShiftAssignment[] = [...params.baseShifts];
  const kept: AutoAssignProposal[] = [];

  for (const p of sorted) {
    const doctor = doctorsById.get(p.doctorId);
    if (!doctor) continue;

    const proposalKey = `${p.doctorId}__${p.date}`;
    if (anchoredKeys.has(proposalKey)) continue;

    const date = parseDateKey(p.date);
    const coverage = params.getCoverageForDateKey(p.date);
    const purpose =
      p.shiftCode === "TWENTY_FOUR" ? ("hoursFill" as const) : ("coverage" as const);
    const validation = validateAssignment({
      doctor,
      date,
      shiftCode: p.shiftCode,
      shiftTypes: params.shiftTypes,
      existingShifts: working,
      monthKeys: params.monthKeys,
      coverageTarget: coverage,
      doctors: params.doctors,
      rules: params.rules,
      purpose,
    });

    if (!validation.ok) continue;

    kept.push(p);
    working.push({
      doctorId: p.doctorId,
      date,
      shiftCode: p.shiftCode,
      durationHours: p.durationHours,
    });
  }

  return {
    proposals: kept,
    droppedCount: params.proposals.length - kept.length,
  };
}
