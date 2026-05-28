import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fillUnderstaffedCoverage,
  isDateUnderstaffed,
} from "@/lib/scheduling/fill-understaffed-coverage";
import { parseDateKey } from "@/lib/scheduling/dates";
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
    id: "s1",
    name: "Senior",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "j1",
    name: "Junior",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
];

const monthKeys = ["2026-05-01"];

describe("isDateUnderstaffed", () => {
  it("is true when L or N count is below target", () => {
    assert.equal(
      isDateUnderstaffed({
        date: "2026-05-01",
        dayShiftTarget: 2,
        nightShiftTarget: 2,
        lCount: 1,
        nCount: 2,
      }),
      true,
    );
    assert.equal(
      isDateUnderstaffed({
        date: "2026-05-01",
        dayShiftTarget: 2,
        nightShiftTarget: 2,
        lCount: 2,
        nCount: 1,
      }),
      true,
    );
    assert.equal(
      isDateUnderstaffed({
        date: "2026-05-01",
        dayShiftTarget: 2,
        nightShiftTarget: 2,
        lCount: 2,
        nCount: 2,
      }),
      false,
    );
  });
});

describe("fillUnderstaffedCoverage", () => {
  it("fills missing L and N slots up to coverage targets", () => {
    const workingShifts: ShiftAssignment[] = [];
    const result = fillUnderstaffedCoverage({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey: () => ({
        dayShiftTarget: 1,
        nightShiftTarget: 1,
      }),
      rules: {
        ...DEFAULT_SCHEDULING_RULES,
        requireSeniorOnDayBand: false,
        requireSeniorOnNightBand: false,
      },
    });

    assert.equal(result.proposals.length, 2);
    const codes = result.proposals.map((p) => p.shiftCode).sort();
    assert.deepEqual(codes, ["L", "N"]);
    assert.equal(
      result.proposals.every((p) => p.date === "2026-05-01"),
      true,
    );
  });

  it("does not fill L or N when TWENTY_FOUR already satisfies L1-N1 targets", () => {
    const date = parseDateKey("2026-05-01");
    const workingShifts: ShiftAssignment[] = [
      {
        doctorId: "s1",
        date,
        shiftCode: "TWENTY_FOUR",
        durationHours: 24,
      },
    ];

    const result = fillUnderstaffedCoverage({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey: () => ({
        dayShiftTarget: 1,
        nightShiftTarget: 1,
      }),
      rules: {
        ...DEFAULT_SCHEDULING_RULES,
        requireSeniorOnDayBand: false,
        requireSeniorOnNightBand: false,
      },
    });

    assert.equal(result.proposals.length, 0);
  });

  it("prefers seniors when a band still needs a senior", () => {
    const date = parseDateKey("2026-05-01");
    const workingShifts: ShiftAssignment[] = [
      {
        doctorId: "j1",
        date,
        shiftCode: "L",
        durationHours: 12,
      },
    ];

    const result = fillUnderstaffedCoverage({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys,
      getCoverageForDateKey: () => ({
        dayShiftTarget: 2,
        nightShiftTarget: 0,
      }),
      rules: {
        ...DEFAULT_SCHEDULING_RULES,
        requireSeniorOnDayBand: true,
      },
    });

    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0]?.doctorId, "s1");
    assert.equal(result.proposals[0]?.shiftCode, "L");
  });
});
