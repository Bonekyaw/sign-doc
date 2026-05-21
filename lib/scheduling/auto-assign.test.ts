import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import { remainingMonthlyHours } from "@/lib/scheduling/compute-hours";
import {
  getEligibleDoctors,
  isOnApprovedLeave,
} from "@/lib/scheduling/eligibility";
import { autoAssign, rankCandidates } from "@/lib/scheduling/auto-assign";
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
];

const doctors: DoctorInfo[] = [
  {
    id: "d1",
    name: "Alice",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
  },
  {
    id: "d2",
    name: "Bob",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: ["NO_TWENTY_FOUR"],
  },
];

describe("eligibility", () => {
  it("excludes doctors on approved leave", () => {
    const date = parseDateKey("2026-05-10");
    const leave = new Map<string, Set<string>>([
      ["d1", new Set(["2026-05-10"])],
    ]);
    assert.equal(isOnApprovedLeave("d1", date, leave), true);
    assert.equal(isOnApprovedLeave("d2", date, leave), false);
  });

  it("filters leave before validateAssignment", () => {
    const date = parseDateKey("2026-05-10");
    const leave = new Map<string, Set<string>>([
      ["d1", new Set(["2026-05-10"])],
    ]);
    const eligible = getEligibleDoctors({
      doctors,
      date,
      shiftCode: "L",
      shiftTypes,
      workingShifts: [],
      monthKeys: ["2026-05-10"],
      coverageTarget: { dayShiftTarget: 3, nightShiftTarget: 2 },
      leaveByDoctor: leave,
      rules: DEFAULT_SCHEDULING_RULES,
    });
    assert.equal(
      eligible.some((e) => e.doctor.id === "d1"),
      false,
    );
    assert.equal(
      eligible.some((e) => e.doctor.id === "d2"),
      true,
    );
  });
});

describe("remainingMonthlyHours", () => {
  it("returns target minus worked", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    const remaining = remainingMonthlyHours(
      "d1",
      240,
      ["2026-05-01", "2026-05-02"],
      shifts,
    );
    assert.equal(remaining, 228);
  });
});

describe("rankCandidates", () => {
  it("prefers Senior doctors when the band still needs senior coverage", () => {
    const monthKeys = ["2026-05-01", "2026-05-02"];
    const ranked = rankCandidates(
      doctors.map((d) => ({ doctor: d })),
      monthKeys,
      [],
      parseDateKey("2026-05-02"),
      "L",
      new Map(),
      doctors,
      DEFAULT_SCHEDULING_RULES,
    );
    assert.equal(ranked[0]?.doctor.id, "d1");
    assert.equal(ranked[1]?.doctor.id, "d2");
  });

  it("orders by remaining hours when rotation match is equal", () => {
    const monthKeys = ["2026-05-01", "2026-05-02"];
    const workingShifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    const ranked = rankCandidates(
      doctors.map((d) => ({ doctor: d })),
      monthKeys,
      workingShifts,
      parseDateKey("2026-05-02"),
      "L",
      new Map(),
      doctors,
      DEFAULT_SCHEDULING_RULES,
    );
    assert.equal(ranked[0]?.doctor.id, "d2");
    assert.equal(ranked[1]?.doctor.id, "d1");
  });
});

describe("autoAssign gap-fill", () => {
  it("only proposes gaps without replacing existing band assignments", () => {
    const existing: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-01"),
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
      monthDefaults: { dayShiftTarget: 3, nightShiftTarget: 2 },
      dailyOverrides: new Map(),
      leaveByDoctor: new Map(),
      rules: DEFAULT_SCHEDULING_RULES,
    });
    const may1L = result.proposals.filter(
      (p) => p.date === "2026-05-01" && p.shiftCode === "L",
    );
    assert.ok(may1L.length <= 2);
    assert.ok(
      !may1L.some((p) => p.doctorId === "d1"),
      "should not replace existing d1 L assignment",
    );
  });
});
