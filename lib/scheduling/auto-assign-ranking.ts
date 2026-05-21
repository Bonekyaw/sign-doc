import { remainingMonthlyHours } from "@/lib/scheduling/compute-hours";
import { matchesRotationForShift } from "@/lib/scheduling/rotation";
import type { DoctorRotationInfo } from "@/lib/scheduling/rotation";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { bandNeedsSenior } from "@/lib/scheduling/validate-senior-manpower";
import type {
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
} from "@/lib/scheduling/types";

type RankedCandidate = {
  doctor: DoctorInfo;
  rotationMatch: number;
  seniorBoost: number;
  remaining: number;
  shiftCount: number;
};

export function rankCandidates(
  eligible: { doctor: DoctorInfo }[],
  monthKeys: string[],
  workingShifts: ShiftAssignment[],
  date: Date,
  shiftCode: ShiftCode,
  doctorRotations: Map<string, DoctorRotationInfo>,
  doctors: DoctorInfo[],
  rules: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): RankedCandidate[] {
  const doctorsById = new Map(doctors.map((d) => [d.id, d]));
  const band = shiftCode === "L" || shiftCode === "N" ? shiftCode : null;
  const needsSenior =
    band !== null &&
    bandNeedsSenior(date, band, workingShifts, doctorsById, rules);

  return eligible
    .map(({ doctor }) => {
      const rotation = doctorRotations.get(doctor.id);
      const rotationMatch = matchesRotationForShift(
        rotation,
        date,
        shiftCode,
      )
        ? 0
        : 1;
      const seniorBoost =
        needsSenior && doctor.seniority === "SENIOR" ? 0 : 1;
      const remaining = remainingMonthlyHours(
        doctor.id,
        doctor.targetHours,
        monthKeys,
        workingShifts,
      );
      const shiftCount = workingShifts.filter(
        (s) => s.doctorId === doctor.id,
      ).length;
      return { doctor, rotationMatch, seniorBoost, remaining, shiftCount };
    })
    .sort(
      (a, b) =>
        a.rotationMatch - b.rotationMatch ||
        a.seniorBoost - b.seniorBoost ||
        b.remaining - a.remaining ||
        a.shiftCount - b.shiftCount,
    );
}
