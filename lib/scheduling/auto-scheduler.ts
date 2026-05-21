import { isSameDay } from "date-fns";
import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import { isOnApprovedLeave } from "@/lib/scheduling/eligibility";
import { matchesRotationForShift } from "@/lib/scheduling/rotation";
import type { DoctorRotationInfo } from "@/lib/scheduling/rotation";
import {
  doctorInfoToDoctorRecord,
  shiftAssignmentToShiftRecord,
  shiftTypeToShiftCode,
} from "@/lib/scheduling/shift-validation-adapters";
import {
  ShiftType,
  calculateMonthlyHours,
  validateDailyManpower,
  validateShiftSequence,
  type ShiftRecord,
} from "@/lib/scheduling/shift-validation-service";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import type {
  CoverageTarget,
  DoctorInfo,
  ShiftAssignment,
  ShiftCode,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

/** Per-day staffing targets (maps to coverage day/night band counts). */
export type DailyRequirement = {
  longDayCount: number;
  nightCount: number;
};

export type AutoSchedulerParams = {
  doctors: DoctorInfo[];
  shiftTypes: ShiftTypeInfo[];
  monthKeys: string[];
  existingShifts: ShiftAssignment[];
  getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;
  leaveByDoctor?: Map<string, Set<string>>;
  doctorRotations?: Map<string, DoctorRotationInfo>;
  rules: SchedulingRulesConfig;
};

export type AutoSchedulerResult = {
  proposals: AutoAssignProposal[];
  warnings: string[];
};

type BandShiftType = ShiftType.LONG_DAY | ShiftType.NIGHT;

type ShiftTypeConfig = {
  shiftType: ShiftType;
  shiftCode: ShiftCode;
  typeId: string;
  hours: number;
};

/**
 * Greedy month builder inspired by hospital AutoScheduler pattern:
 * for each day → fill Long Day → fill Night → internal OFF markers for rule checks.
 * All legality checks go through {@link validateShiftSequence} and {@link validateDailyManpower}.
 */
export class AutoScheduler {
  private readonly doctors: DoctorInfo[];
  private readonly monthKeys: string[];
  private readonly shiftConfigs: Map<ShiftType, ShiftTypeConfig>;
  private readonly existingKeys: Set<string>;
  private readonly records: ShiftRecord[] = [];
  private readonly warnings: string[] = [];
  private readonly leaveByDoctor: Map<string, Set<string>>;
  private readonly doctorRotations: Map<string, DoctorRotationInfo>;
  private readonly rules: SchedulingRulesConfig;
  private readonly getCoverageForDateKey: (dateKeyStr: string) => CoverageTarget;

  constructor(params: AutoSchedulerParams) {
    this.doctors = params.doctors;
    this.monthKeys = params.monthKeys;
    this.leaveByDoctor = params.leaveByDoctor ?? new Map();
    this.doctorRotations = params.doctorRotations ?? new Map();
    this.rules = params.rules;
    this.getCoverageForDateKey = params.getCoverageForDateKey;

    const l = params.shiftTypes.find((s) => s.code === "L" && s.isActive);
    const n = params.shiftTypes.find((s) => s.code === "N" && s.isActive);
    const h24 = params.shiftTypes.find(
      (s) => s.code === "TWENTY_FOUR" && s.isActive,
    );
    this.shiftConfigs = new Map();
    if (l) {
      this.shiftConfigs.set(ShiftType.LONG_DAY, {
        shiftType: ShiftType.LONG_DAY,
        shiftCode: "L",
        typeId: l.id,
        hours: l.durationHours,
      });
    }
    if (n) {
      this.shiftConfigs.set(ShiftType.NIGHT, {
        shiftType: ShiftType.NIGHT,
        shiftCode: "N",
        typeId: n.id,
        hours: n.durationHours,
      });
    }
    if (h24) {
      this.shiftConfigs.set(ShiftType.TWENTY_FOUR, {
        shiftType: ShiftType.TWENTY_FOUR,
        shiftCode: "TWENTY_FOUR",
        typeId: h24.id,
        hours: h24.durationHours,
      });
    }

    this.existingKeys = new Set(
      params.existingShifts.map(
        (s) => `${s.doctorId}__${dateKey(s.date)}`,
      ),
    );
    for (const s of params.existingShifts) {
      this.records.push(shiftAssignmentToShiftRecord(s));
    }
  }

  /** Main entry: L/N coverage per day; 24h is deferred to hour-fill when necessary. */
  generateSchedule(includeTwentyFour = false): AutoSchedulerResult {
    for (const key of this.monthKeys) {
      const date = parseDateKey(key);
      const req = this.dailyRequirement(key);

      this.fillShiftType(date, key, ShiftType.LONG_DAY, req.longDayCount);
      this.fillShiftType(date, key, ShiftType.NIGHT, req.nightCount);
      this.markUnassignedAsOff(date, key);
    }

    if (includeTwentyFour) {
      this.fillTwentyFourShifts();
    }

    return {
      proposals: this.toProposals(),
      warnings: [...this.warnings],
    };
  }

  getWorkingShifts(): ShiftAssignment[] {
    const out: ShiftAssignment[] = [];
    for (const r of this.records) {
      if (r.shiftType === ShiftType.OFF) continue;
      const code = shiftTypeToShiftCode(r.shiftType);
      const config = code ? this.shiftConfigs.get(r.shiftType) : undefined;
      if (!code || !config) continue;
      out.push({
        doctorId: r.doctorId,
        date: r.date,
        shiftCode: code,
        durationHours: config.hours,
      });
    }
    return out;
  }

  private dailyRequirement(dateKeyStr: string): DailyRequirement {
    const c = this.getCoverageForDateKey(dateKeyStr);
    return {
      longDayCount: c.dayShiftTarget,
      nightCount: c.nightShiftTarget,
    };
  }

  private fillShiftType(
    date: Date,
    key: string,
    shiftType: BandShiftType,
    requiredCount: number,
  ) {
    const config = this.shiftConfigs.get(shiftType);
    if (!config || requiredCount <= 0) return;

    const assignedThisBand: DoctorInfo[] = [];

    for (let slot = 0; slot < requiredCount; slot++) {
      const eligible = this.doctors.filter(
        (doc) =>
          !assignedThisBand.some((d) => d.id === doc.id) &&
          !this.isAnchored(doc.id, key) &&
          !isOnApprovedLeave(doc.id, date, this.leaveByDoctor) &&
          !this.hasWorkOnDate(doc.id, date) &&
          this.canWorkShift(doc, date, shiftType),
      );

      if (eligible.length === 0) {
        this.warnings.push(
          `${key} ${config.shiftCode}: understaffed — need ${requiredCount}, assigned ${assignedThisBand.length} (no eligible doctor).`,
        );
        break;
      }

      const hasSenior = assignedThisBand.some(
        (d) => d.seniority === "SENIOR",
      );

      eligible.sort((a, b) => this.compareCandidates(
        a,
        b,
        date,
        config.shiftCode,
        hasSenior,
      ));

      let placed = false;
      for (const doctor of eligible) {
        const trialBand = [...assignedThisBand, doctor].map(
          doctorInfoToDoctorRecord,
        );
        const manpower = validateDailyManpower(date, shiftType, trialBand);
        if (!manpower.isValid) continue;

        this.assignRecord(doctor.id, date, shiftType);
        assignedThisBand.push(doctor);
        placed = true;
        break;
      }

      if (!placed) {
        this.warnings.push(
          `${key} ${config.shiftCode}: could not place slot ${slot + 1}/${requiredCount} (senior manpower or rules).`,
        );
      }
    }

    if (
      assignedThisBand.length > 0 &&
      !assignedThisBand.some((d) => d.seniority === "SENIOR")
    ) {
      this.warnings.push(
        `${key} ${config.shiftCode}: staffed without a Senior (main-flow requires at least one Senior on L/N).`,
      );
    }
  }

  private compareCandidates(
    a: DoctorInfo,
    b: DoctorInfo,
    date: Date,
    shiftCode: ShiftCode,
    hasSenior: boolean,
  ): number {
    if (!hasSenior) {
      if (a.seniority === "SENIOR" && b.seniority !== "SENIOR") return -1;
      if (b.seniority === "SENIOR" && a.seniority !== "SENIOR") return 1;
    }
    const aDeficit = a.targetHours - this.getWorkedHours(a.id);
    const bDeficit = b.targetHours - this.getWorkedHours(b.id);
    if (bDeficit !== aDeficit) return bDeficit - aDeficit;

    const rotA = matchesRotationForShift(
      this.doctorRotations.get(a.id),
      date,
      shiftCode,
    )
      ? 0
      : 1;
    const rotB = matchesRotationForShift(
      this.doctorRotations.get(b.id),
      date,
      shiftCode,
    )
      ? 0
      : 1;
    return rotA - rotB;
  }

  /** Assign 24h where legal and under monthly target (sorted by largest hour deficit). */
  private fillTwentyFourShifts() {
    const config = this.shiftConfigs.get(ShiftType.TWENTY_FOUR);
    if (!config) return;

    for (const key of this.monthKeys) {
      const date = parseDateKey(key);
      const candidates = this.doctors
        .filter(
          (d) =>
            !this.isAnchored(d.id, key) &&
            !this.hasWorkOnDate(d.id, date) &&
            !isOnApprovedLeave(d.id, date, this.leaveByDoctor),
        )
        .sort(
          (a, b) =>
            b.targetHours -
            this.getWorkedHours(b.id) -
            (a.targetHours - this.getWorkedHours(a.id)),
        );

      for (const doctor of candidates) {
        if (this.getWorkedHours(doctor.id) + config.hours > doctor.targetHours) {
          continue;
        }
        if (!this.canWorkShift(doctor, date, ShiftType.TWENTY_FOUR)) {
          continue;
        }
        this.assignRecord(doctor.id, date, ShiftType.TWENTY_FOUR);
      }
    }
  }

  /** Internal OFF rows for consecutive-off validation; not emitted as proposals. */
  private markUnassignedAsOff(date: Date, key: string) {
    const assignedIds = new Set(
      this.records
        .filter(
          (r) =>
            isSameDay(r.date, date) && r.shiftType !== ShiftType.OFF,
        )
        .map((r) => r.doctorId),
    );

    for (const doc of this.doctors) {
      if (assignedIds.has(doc.id)) continue;
      if (this.isAnchored(doc.id, key)) continue;
      if (isOnApprovedLeave(doc.id, date, this.leaveByDoctor)) continue;

      this.removeRecordOnDate(doc.id, date);
      this.records.push({
        doctorId: doc.id,
        date,
        shiftType: ShiftType.OFF,
      });
    }
  }

  private canWorkShift(
    doctor: DoctorInfo,
    date: Date,
    proposedShift: ShiftType,
  ): boolean {
    const outcome = validateShiftSequence(
      doctor.id,
      date,
      proposedShift,
      this.recordsForDoctor(doctor.id, date),
      this.rules,
    );
    if (!outcome.isValid) return false;

    const config = this.shiftConfigs.get(proposedShift);
    const hours = config?.hours ?? 0;
    if (proposedShift === ShiftType.OFF) return true;
    if (this.getWorkedHours(doctor.id) + hours > doctor.targetHours) {
      return false;
    }

    return true;
  }

  private recordsForDoctor(
    doctorId: string,
    excludeDate: Date,
  ): ShiftRecord[] {
    return this.records.filter(
      (r) =>
        r.doctorId === doctorId &&
        !isSameDay(r.date, excludeDate),
    );
  }

  private getWorkedHours(doctorId: string): number {
    return calculateMonthlyHours(
      this.records.filter(
        (r) => r.doctorId === doctorId && r.shiftType !== ShiftType.OFF,
      ),
    );
  }

  private hasWorkOnDate(doctorId: string, date: Date): boolean {
    const t = this.records.find(
      (s) =>
        s.doctorId === doctorId &&
        isSameDay(s.date, date) &&
        s.shiftType !== ShiftType.OFF,
    );
    return !!t;
  }

  private isAnchored(doctorId: string, key: string): boolean {
    return this.existingKeys.has(`${doctorId}__${key}`);
  }

  private assignRecord(doctorId: string, date: Date, shiftType: ShiftType) {
    this.removeRecordOnDate(doctorId, date);
    this.records.push({ doctorId, date, shiftType });
  }

  private removeRecordOnDate(doctorId: string, date: Date) {
    for (let i = this.records.length - 1; i >= 0; i--) {
      const r = this.records[i]!;
      if (r.doctorId === doctorId && isSameDay(r.date, date)) {
        this.records.splice(i, 1);
      }
    }
  }

  private toProposals(): AutoAssignProposal[] {
    const proposals: AutoAssignProposal[] = [];

    for (const r of this.records) {
      if (r.shiftType === ShiftType.OFF) continue;
      const key = dateKey(r.date);
      if (this.existingKeys.has(`${r.doctorId}__${key}`)) continue;

      const code = shiftTypeToShiftCode(r.shiftType);
      if (!code) continue;
      const config = this.shiftConfigs.get(r.shiftType);
      if (!config) continue;

      proposals.push({
        doctorId: r.doctorId,
        date: key,
        shiftCode: code,
        shiftTypeId: config.typeId,
        durationHours: config.hours,
      });
    }

    return proposals;
  }
}

export function runAutoScheduler(
  params: AutoSchedulerParams,
): AutoSchedulerResult {
  const scheduler = new AutoScheduler(params);
  return scheduler.generateSchedule(false);
}
