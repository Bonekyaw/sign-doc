import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import { getEligibleDoctors } from "@/lib/scheduling/eligibility";
import {
  matchesRotationForShift,
  type DoctorRotationInfo,
} from "@/lib/scheduling/rotation";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

const MAX_SWAP_ITERATIONS = 50;

type OptimizeParams = {
  proposals: AutoAssignProposal[];
  baseShifts: ShiftAssignment[];
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  monthKeys: string[];
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;
  doctorRotations: Map<string, DoctorRotationInfo>;
  leaveByDoctor: Map<string, Set<string>>;
};

function buildWorkingShifts(
  base: ShiftAssignment[],
  proposals: AutoAssignProposal[],
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

function doctorById(
  doctors: DoctorInfo[],
  id: string,
): DoctorInfo | undefined {
  return doctors.find((d) => d.id === id);
}

function validates(
  params: OptimizeParams,
  workingShifts: ShiftAssignment[],
  doctor: DoctorInfo,
  date: Date,
  shiftCode: ShiftCode,
  coverage: CoverageTarget,
): boolean {
  return (
    getEligibleDoctors({
      doctors: [doctor],
      date,
      shiftCode,
      shiftTypes: params.shiftTypes,
      workingShifts,
      monthKeys: params.monthKeys,
      coverageTarget: coverage,
      leaveByDoctor: params.leaveByDoctor,
    }).length === 1
  );
}

function rotationScore(
  doctorId: string,
  date: Date,
  shiftCode: ShiftCode,
  rotations: Map<string, DoctorRotationInfo>,
): number {
  return matchesRotationForShift(rotations.get(doctorId), date, shiftCode)
    ? 0
    : 1;
}

export function optimizeAssignments(params: OptimizeParams): {
  proposals: AutoAssignProposal[];
  optimizationWarnings: string[];
  swapCount: number;
} {
  const proposals = params.proposals.map((p) => ({ ...p }));
  const optimizationWarnings: string[] = [];
  let totalSwaps = 0;

  for (let iter = 0; iter < MAX_SWAP_ITERATIONS; iter++) {
    let improved = false;

    for (let i = 0; i < proposals.length; i++) {
      for (let j = i + 1; j < proposals.length; j++) {
        const a = proposals[i];
        const b = proposals[j];
        if (a.date !== b.date) continue;
        if (a.shiftCode === b.shiftCode) continue;

        const docA = doctorById(params.doctors, a.doctorId);
        const docB = doctorById(params.doctors, b.doctorId);
        if (!docA || !docB) continue;

        const date = parseDateKey(a.date);
        const coverage = params.getCoverageForDateKey(a.date);

        const beforeScore =
          rotationScore(a.doctorId, date, a.shiftCode, params.doctorRotations) +
          rotationScore(b.doctorId, date, b.shiftCode, params.doctorRotations);

        const afterScore =
          rotationScore(a.doctorId, date, b.shiftCode, params.doctorRotations) +
          rotationScore(b.doctorId, date, a.shiftCode, params.doctorRotations);

        if (afterScore >= beforeScore) continue;

        const working = buildWorkingShifts(params.baseShifts, proposals);
        const withoutPair = working.filter(
          (s) =>
            !(
              (s.doctorId === a.doctorId && dateKey(s.date) === a.date) ||
              (s.doctorId === b.doctorId && dateKey(s.date) === b.date)
            ),
        );

        const aNewHours =
          params.shiftTypes.find((t) => t.code === b.shiftCode)?.durationHours ??
          b.durationHours;
        const bNewHours =
          params.shiftTypes.find((t) => t.code === a.shiftCode)?.durationHours ??
          a.durationHours;

        if (
          !validates(params, withoutPair, docA, date, b.shiftCode, coverage) ||
          !validates(params, withoutPair, docB, date, a.shiftCode, coverage)
        ) {
          continue;
        }

        proposals[i] = {
          ...a,
          shiftCode: b.shiftCode,
          shiftTypeId: b.shiftTypeId,
          durationHours: aNewHours,
        };
        proposals[j] = {
          ...b,
          shiftCode: a.shiftCode,
          shiftTypeId: a.shiftTypeId,
          durationHours: bNewHours,
        };

        totalSwaps++;
        improved = true;
        optimizationWarnings.push(
          `Swapped ${a.date}: ${docA.name} ↔ ${docB.name} (${a.shiftCode}/${b.shiftCode}) for rotation fit.`,
        );
        break;
      }
      if (improved) break;
    }

    if (!improved) break;
  }

  if (totalSwaps > 0) {
    optimizationWarnings.unshift(
      `Rotation optimization applied ${totalSwaps} swap(s).`,
    );
  }

  return { proposals, optimizationWarnings, swapCount: totalSwaps };
}
