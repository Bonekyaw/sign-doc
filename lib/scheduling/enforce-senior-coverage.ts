import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import { getEligibleDoctors } from "@/lib/scheduling/eligibility";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import {
  bandHasSenior,
  bandNeedsSenior,
} from "@/lib/scheduling/validate-senior-manpower";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

function toShifts(
  proposals: AutoAssignProposal[],
  base: ShiftAssignment[],
): ShiftAssignment[] {
  const map = new Map<string, ShiftAssignment>();
  for (const s of base) {
    map.set(`${s.doctorId}__${dateKey(s.date)}`, s);
  }
  for (const p of proposals) {
    map.set(`${p.doctorId}__${p.date}`, {
      doctorId: p.doctorId,
      date: parseDateKey(p.date),
      shiftCode: p.shiftCode,
      durationHours: p.durationHours,
    });
  }
  return [...map.values()];
}

function shiftTypeId(
  shiftTypes: ShiftTypeInfo[],
  code: ShiftCode,
): string | undefined {
  return shiftTypes.find((t) => t.code === code)?.id;
}

/** When a band still needs a Senior, only Seniors may be placed on L/N. */
export function mayPlaceOnBand(params: {
  doctor: DoctorInfo;
  date: Date;
  band: "L" | "N";
  workingShifts: ShiftAssignment[];
  doctors: DoctorInfo[];
  rules: SchedulingRulesConfig;
}): boolean {
  const doctorsById = new Map(params.doctors.map((d) => [d.id, d]));
  if (
    !bandNeedsSenior(
      params.date,
      params.band,
      params.workingShifts,
      doctorsById,
      params.rules,
    )
  ) {
    return true;
  }
  return params.doctor.seniority === "SENIOR";
}

/**
 * Fix dates where L or N is staffed without a Senior (main-flow manpower rule).
 * Tries to swap a Junior/Mid assignment for an eligible Senior on the same band.
 */
export function repairSeniorManpower(params: {
  proposals: AutoAssignProposal[];
  baseShifts: ShiftAssignment[];
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  monthKeys: string[];
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;
  leaveByDoctor: Map<string, Set<string>>;
  rules: SchedulingRulesConfig;
}): { proposals: AutoAssignProposal[]; warnings: string[] } {
  const proposals = params.proposals.map((p) => ({ ...p }));
  const warnings: string[] = [];
  const doctorsById = new Map(params.doctors.map((d) => [d.id, d]));
  const seniors = params.doctors.filter((d) => d.seniority === "SENIOR");

  for (const key of params.monthKeys) {
    const date = parseDateKey(key);
    const coverage = params.getCoverageForDateKey(key);

    for (const band of ["L", "N"] as const) {
      let shifts = toShifts(proposals, params.baseShifts);
      if (countBandForDate(date, band, shifts) === 0) continue;

      while (!bandHasSenior(date, band, shifts, doctorsById)) {
        const onBand = proposals.filter(
          (p) => p.date === key && p.shiftCode === band,
        );
        const nonSeniorIdx = onBand.findIndex(
          (p) => doctorsById.get(p.doctorId)?.seniority !== "SENIOR",
        );
        if (nonSeniorIdx === -1) break;

        const victim = onBand[nonSeniorIdx]!;
        const proposalIdx = proposals.findIndex(
          (p) =>
            p.doctorId === victim.doctorId &&
            p.date === victim.date &&
            p.shiftCode === victim.shiftCode,
        );
        if (proposalIdx === -1) break;

        const working = toShifts(proposals, params.baseShifts).filter(
          (s) =>
            !(
              s.doctorId === victim.doctorId && dateKey(s.date) === key
            ),
        );

        let replaced = false;
        for (const senior of seniors) {
          if (senior.id === victim.doctorId) continue;
          const alreadyOnDay = working.some(
            (s) => s.doctorId === senior.id && dateKey(s.date) === key,
          );
          if (alreadyOnDay) continue;

          const eligible = getEligibleDoctors({
            doctors: [senior],
            date,
            shiftCode: band,
            shiftTypes: params.shiftTypes,
            workingShifts: working,
            monthKeys: params.monthKeys,
            coverageTarget: coverage,
            leaveByDoctor: params.leaveByDoctor,
            rules: params.rules,
          });
          if (eligible.length === 0) continue;

          const typeId = shiftTypeId(params.shiftTypes, band);
          if (!typeId) continue;

          proposals[proposalIdx] = {
            doctorId: senior.id,
            date: key,
            shiftCode: band,
            shiftTypeId: typeId,
            durationHours:
              params.shiftTypes.find((t) => t.code === band)?.durationHours ??
              12,
          };
          warnings.push(
            `${key} ${band}: assigned Senior ${senior.name} (replacing non-senior) to satisfy manpower rule.`,
          );
          replaced = true;
          break;
        }

        if (!replaced) {
          proposals.splice(proposalIdx, 1);
          warnings.push(
            `${key} ${band}: removed non-senior shift — no eligible Senior available for this band.`,
          );
        }

        shifts = toShifts(proposals, params.baseShifts);
        if (countBandForDate(date, band, shifts) === 0) break;
      }
    }
  }

  return { proposals, warnings };
}
