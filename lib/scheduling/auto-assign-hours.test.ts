import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoAssign } from "@/lib/scheduling/auto-assign";
import {
  fillAllDoctorsToTarget,
  fillHoursToTarget,
} from "@/lib/scheduling/auto-assign-hours";
import { proposalsToDraftRows } from "@/lib/scheduling/draft-helpers";
import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import { parseDateKey, getMonthDateKeys } from "@/lib/scheduling/dates";
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
    id: "d1",
    name: "Alice",
    targetHours: 24,
    seniority: "SENIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "d2",
    name: "Bob",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
];

const rules = {
  ...DEFAULT_SCHEDULING_RULES,
  maxConsecutiveOffDays: 31,
};

const monthDefaults = { dayShiftTarget: 1, nightShiftTarget: 1 };
const monthKeys = getMonthDateKeys(2026, 5);

describe("fillHoursToTarget", () => {
  it("adds shifts beyond band targets when doctor is under targetHours", () => {
    const workingShifts: ShiftAssignment[] = [
      {
        doctorId: "d2",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];

    const result = fillHoursToTarget({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey: () => monthDefaults,
      leaveByDoctor: new Map(),
      rules,
    });

    const d1Proposals = result.proposals.filter((p) => p.doctorId === "d1");
    assert.ok(d1Proposals.length >= 1, "should add hour-fill shifts for d1");

    const worked = computeMonthlyHours("d1", monthKeys, workingShifts);
    assert.ok(worked <= 24, "must not exceed targetHours");
    assert.ok(worked >= 12, "should move toward target");
  });

  it("prefers TWENTY_FOUR when target is 24h and rules allow", () => {
    const workingShifts: ShiftAssignment[] = [];
    const result = fillHoursToTarget({
      doctors: [
        {
          id: "d3",
          name: "Carol",
          targetHours: 24,
          seniority: "SENIOR",
          restrictions: [],
    schedulingRuleExempt: false,
        },
      ],
      shiftTypes,
      workingShifts,
      monthKeys: ["2026-05-01", "2026-05-02", "2026-05-03"],
      getCoverageForDateKey: () => monthDefaults,
      leaveByDoctor: new Map(),
      rules,
    });

    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0]?.shiftCode, "TWENTY_FOUR");
  });

  it("uses TWENTY_FOUR to close larger hour gaps when legal", () => {
    const workingShifts: ShiftAssignment[] = [];
    const result = fillHoursToTarget({
      doctors: [
        {
          id: "d3",
          name: "Carol",
          targetHours: 48,
          seniority: "SENIOR",
          restrictions: [],
    schedulingRuleExempt: false,
        },
      ],
      shiftTypes,
      workingShifts,
      monthKeys: ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04"],
      getCoverageForDateKey: () => monthDefaults,
      leaveByDoctor: new Map(),
      rules,
    });

    const h24 = result.proposals.filter((p) => p.shiftCode === "TWENTY_FOUR");
    assert.ok(h24.length >= 1, "should include at least one 24h shift");
    const worked = result.proposals.reduce((s, p) => s + p.durationHours, 0);
    assert.equal(worked, 48);
  });

  it("prefers TWENTY_FOUR when any band has a gap and doctor needs 24h+", () => {
    const workingShifts: ShiftAssignment[] = [];

    const result = fillHoursToTarget({
      doctors: [doctors[1]!],
      shiftTypes,
      workingShifts,
      monthKeys: ["2026-05-01", "2026-05-02", "2026-05-03"],
      getCoverageForDateKey: (key) =>
        key === "2026-05-01"
          ? { dayShiftTarget: 2, nightShiftTarget: 1 }
          : { dayShiftTarget: 1, nightShiftTarget: 1 },
      leaveByDoctor: new Map(),
      rules: {
        ...rules,
        requireSeniorOnDayBand: false,
        requireSeniorOnNightBand: false,
      },
    });

    const first = result.proposals[0];
    assert.ok(first, "should add at least one hour-fill shift");
    assert.equal(
      first.date,
      "2026-05-01",
      "should visit understaffed day before days already at band target",
    );
    assert.equal(
      first.shiftCode,
      "TWENTY_FOUR",
      "24h should win when any band gap exists and remaining hours allow",
    );
  });

  it("does not propose shifts that would exceed targetHours", () => {
    const workingShifts: ShiftAssignment[] = monthKeys.slice(0, 2).map((key) => ({
      doctorId: "d1",
      date: parseDateKey(key),
      shiftCode: "L" as const,
      durationHours: 12,
    }));

    const result = fillHoursToTarget({
      doctors: [doctors[0]!],
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey: () => monthDefaults,
      leaveByDoctor: new Map(),
      rules,
    });

    assert.equal(result.proposals.length, 0);
  });
});

describe("fillAllDoctorsToTarget", () => {
  it("drives every doctor to their monthly target when rules allow", () => {
    const ftDoctors: DoctorInfo[] = [
      {
        id: "s1",
        name: "Senior A",
        targetHours: 240,
        seniority: "SENIOR",
        restrictions: [],
    schedulingRuleExempt: false,
      },
      {
        id: "s2",
        name: "Senior B",
        targetHours: 240,
        seniority: "SENIOR",
        restrictions: [],
    schedulingRuleExempt: false,
      },
      {
        id: "j1",
        name: "Junior C",
        targetHours: 120,
        seniority: "JUNIOR",
        restrictions: [],
    schedulingRuleExempt: false,
      },
    ];

    const workingShifts: ShiftAssignment[] = [];
    const result = fillAllDoctorsToTarget({
      doctors: ftDoctors,
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey: () => monthDefaults,
      leaveByDoctor: new Map(),
      rules,
    });

    for (const doc of ftDoctors) {
      const worked =
        computeMonthlyHours(doc.id, monthKeys, workingShifts) +
        result.proposals
          .filter((p) => p.doctorId === doc.id)
          .reduce((sum, p) => sum + p.durationHours, 0);
      assert.equal(
        worked,
        doc.targetHours,
        `${doc.name} should reach ${doc.targetHours}h`,
      );
    }
    assert.equal(result.shortfalls.length, 0);
    const h24 = result.proposals.filter((p) => p.shiftCode === "TWENTY_FOUR");
    assert.ok(
      h24.length >= 1,
      "full-time targets should use 24h shifts when rules allow",
    );
  });
});

describe("autoAssign full rebuild", () => {
  it("fills month from empty anchors toward hour targets", () => {
    const result = autoAssign({
      year: 2026,
      month: 5,
      doctors,
      shiftTypes,
      existingShifts: [],
      monthDefaults: { dayShiftTarget: 1, nightShiftTarget: 1 },
      dailyOverrides: new Map(),
      leaveByDoctor: new Map(),
      rules,
    });

    assert.ok(result.proposals.length > 0);
    assert.equal(
      result.hourShortfalls.length,
      0,
      "all doctors should reach target when auto-assign completes",
    );
    for (const doc of doctors) {
      const worked = result.proposals
        .filter((p) => p.doctorId === doc.id)
        .reduce((s, p) => s + p.durationHours, 0);
      assert.equal(worked, doc.targetHours, `${doc.name} must hit ${doc.targetHours}h`);
    }
  });
});

describe("proposalsToDraftRows", () => {
  it("maps TWENTY_FOUR to display code 24", () => {
    const rows = proposalsToDraftRows(
      [
        {
          doctorId: "d1",
          date: "2026-05-01",
          shiftCode: "TWENTY_FOUR",
          shiftTypeId: "h24",
          durationHours: 24,
        },
      ],
      shiftTypes,
    );
    assert.equal(rows[0]?.code, "TWENTY_FOUR");
    assert.equal(rows[0]?.source, "AUTO");
  });
});
