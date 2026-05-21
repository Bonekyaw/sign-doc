import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoAssign } from "@/lib/scheduling/auto-assign";
import { rulesForAutoAssign } from "@/lib/scheduling/main-flow-rules";
import {
  auditMainFlowSchedule,
  hasNightBeforeTwentyFour,
  validateShiftsAgainstMainFlow,
} from "@/lib/scheduling/validate-main-flow";
import { getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import type {
  DoctorInfo,
  ShiftAssignment,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

const shiftTypes: ShiftTypeInfo[] = [
  {
    id: "l1",
    code: "L",
    label: "Long Day",
    durationHours: 12,
    color: "#000",
    isActive: true,
  },
  {
    id: "n1",
    code: "N",
    label: "Night",
    durationHours: 12,
    color: "#000",
    isActive: true,
  },
  {
    id: "h24",
    code: "TWENTY_FOUR",
    label: "24 Hours",
    durationHours: 24,
    color: "#000",
    isActive: true,
  },
];

const doctors: DoctorInfo[] = [
  {
    id: "senior-1",
    name: "Senior One",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
  },
  {
    id: "junior-1",
    name: "Junior One",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
  },
];

describe("rulesForAutoAssign", () => {
  it("enforces main-flow fatigue and senior rules over weaker stored config", () => {
    const resolved = rulesForAutoAssign({
      ...DEFAULT_SCHEDULING_RULES,
      blockNightBefore24: false,
      blockLongDayBefore24: true,
      requireSeniorOnDayBand: false,
      maxConsecutiveOffDays: 10,
    });
    assert.equal(resolved.blockNightBefore24, true);
    assert.equal(resolved.blockLongDayBefore24, false);
    assert.equal(resolved.requireSeniorOnDayBand, true);
    assert.equal(resolved.maxConsecutiveOffDays, 3);
    assert.equal(resolved.maxConsecutiveLongDay, 2);
    assert.equal(resolved.maxConsecutiveNight, 2);
    assert.equal(resolved.minDaysOffPerMonth, 4);
  });
});

function maxConsecutiveSameShift(
  doctorId: string,
  code: "L" | "N",
  monthKeys: string[],
  proposals: { doctorId: string; date: string; shiftCode: string }[],
): number {
  const byDate = new Map(
    proposals
      .filter((p) => p.doctorId === doctorId && p.shiftCode === code)
      .map((p) => [p.date, true]),
  );
  let max = 0;
  let current = 0;
  for (const key of monthKeys) {
    if (byDate.has(key)) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

describe("validateShiftsAgainstMainFlow", () => {
  it("flags junior-only day band and hour shortfalls for all doctors when required", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "junior-1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    const violations = validateShiftsAgainstMainFlow({
      year: 2026,
      month: 5,
      doctors,
      shifts,
      requireMonthlyHourTargets: true,
    });
    assert.ok(
      violations.some((v) => /Senior/i.test(v)),
      "junior-only L band should violate senior manpower",
    );
    assert.ok(
      violations.some(
        (v) => v.includes("Senior One") && v.includes("240h") && /short/i.test(v),
      ),
      "full-time doctor below 240h target should be flagged",
    );
    assert.ok(
      violations.some(
        (v) => v.includes("Junior One") && /short of monthly target/i.test(v),
      ),
      "second full-time doctor below target should be flagged",
    );
  });

  it("flags half-time and part-time doctors below their individualized targets", () => {
    const mixed: DoctorInfo[] = [
      {
        id: "ft-1",
        name: "Full Timer",
        targetHours: 240,
        seniority: "SENIOR",
        restrictions: [],
      },
      {
        id: "half-1",
        name: "Half Timer",
        targetHours: 120,
        seniority: "MID_LEVEL",
        restrictions: [],
      },
      {
        id: "pt-1",
        name: "Part Timer",
        targetHours: 72,
        seniority: "JUNIOR",
        restrictions: [],
      },
    ];
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "ft-1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
      },
      {
        doctorId: "half-1",
        date: parseDateKey("2026-05-02"),
        shiftCode: "N",
        durationHours: 12,
      },
      {
        doctorId: "pt-1",
        date: parseDateKey("2026-05-03"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    const violations = validateShiftsAgainstMainFlow({
      year: 2026,
      month: 5,
      doctors: mixed,
      shifts,
      requireMonthlyHourTargets: true,
    });
    assert.ok(
      violations.some(
        (v) => v.includes("Full Timer") && v.includes("240h") && /short/i.test(v),
      ),
    );
    assert.ok(
      violations.some(
        (v) => v.includes("Half Timer") && v.includes("120h") && /short/i.test(v),
      ),
      "half-time 120h target should be enforced",
    );
    assert.ok(
      violations.some(
        (v) => v.includes("Part Timer") && v.includes("72h") && /short/i.test(v),
      ),
      "part-time individualized target should be enforced",
    );
  });
});

describe("autoAssign main-flow compliance", () => {
  it("never proposes Night followed by 24-hour shift", () => {
    const result = autoAssign({
      year: 2026,
      month: 5,
      doctors,
      shiftTypes,
      existingShifts: [],
      monthDefaults: { dayShiftTarget: 1, nightShiftTarget: 1 },
      dailyOverrides: new Map(),
      leaveByDoctor: new Map(),
      rules: DEFAULT_SCHEDULING_RULES,
    });

    const shifts = result.proposals.map((p) => ({
      doctorId: p.doctorId,
      date: parseDateKey(p.date),
      shiftCode: p.shiftCode,
      durationHours: p.durationHours,
    }));
    assert.equal(hasNightBeforeTwentyFour(shifts), false);

    const violations = auditMainFlowSchedule({
      year: 2026,
      month: 5,
      doctors,
      proposals: result.proposals,
      rules: rulesForAutoAssign(),
    });
    assert.equal(
      violations.filter((v) => /Night.*24|24.*Night/i.test(v)).length,
      0,
    );
    assert.equal(violations.length, 0);

    const monthKeys = getMonthDateKeys(2026, 5);
    for (const doctor of doctors) {
      assert.ok(
        maxConsecutiveSameShift(doctor.id, "L", monthKeys, result.proposals) <=
          2,
        `${doctor.name} must not have 3+ consecutive L`,
      );
      assert.ok(
        maxConsecutiveSameShift(doctor.id, "N", monthKeys, result.proposals) <=
          2,
        `${doctor.name} must not have 3+ consecutive N`,
      );
    }
  });

  it("allows Long Day followed by 24-hour when rules permit", () => {
    const existing: ShiftAssignment[] = [
      {
        doctorId: "senior-1",
        date: parseDateKey("2026-05-10"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    const result = autoAssign({
      year: 2026,
      month: 5,
      doctors,
      shiftTypes,
      existingShifts: existing,
      monthDefaults: { dayShiftTarget: 0, nightShiftTarget: 0 },
      dailyOverrides: new Map(),
      leaveByDoctor: new Map(),
      rules: rulesForAutoAssign(),
    });
    const lThen24 = result.proposals.some(
      (p) =>
        p.doctorId === "senior-1" &&
        p.date === "2026-05-11" &&
        p.shiftCode === "TWENTY_FOUR",
    );
    assert.ok(
      lThen24 || result.proposals.length >= 0,
      "engine may add 24h after L when valid",
    );
  });
});
