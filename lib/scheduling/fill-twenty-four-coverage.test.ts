import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import { fillTwentyFourCoverage } from "@/lib/scheduling/fill-twenty-four-coverage";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
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
    schedulingRuleExempt: false,
  },
  {
    id: "junior-1",
    name: "Junior One",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
];

const rules = {
  ...DEFAULT_SCHEDULING_RULES,
  maxConsecutiveOffDays: 31,
};

describe("fillTwentyFourCoverage", () => {
  it("places 24h when both L and N bands have gaps", () => {
    const workingShifts: ShiftAssignment[] = [];
    const result = fillTwentyFourCoverage({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys: ["2026-05-01"],
      getCoverageForDateKey: () => ({
        dayShiftTarget: 1,
        nightShiftTarget: 1,
      }),
      leaveByDoctor: new Map(),
      rules,
    });

    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0]?.shiftCode, "TWENTY_FOUR");
    assert.equal(
      countBandForDate(parseDateKey("2026-05-01"), "L", workingShifts),
      1,
    );
    assert.equal(
      countBandForDate(parseDateKey("2026-05-01"), "N", workingShifts),
      1,
    );
  });

  it("places 24h when only the night band has a gap", () => {
    const workingShifts: ShiftAssignment[] = [
      {
        doctorId: "junior-1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    const result = fillTwentyFourCoverage({
      doctors: [doctors[0]!],
      shiftTypes,
      workingShifts,
      monthKeys: ["2026-05-01"],
      getCoverageForDateKey: () => ({
        dayShiftTarget: 1,
        nightShiftTarget: 1,
      }),
      leaveByDoctor: new Map(),
      rules,
    });

    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0]?.shiftCode, "TWENTY_FOUR");
    assert.equal(result.proposals[0]?.doctorId, "senior-1");
  });

  it("does not duplicate L/N on a day already satisfied by 24h", () => {
    const workingShifts: ShiftAssignment[] = [];
    fillTwentyFourCoverage({
      doctors,
      shiftTypes,
      workingShifts,
      monthKeys: ["2026-05-01"],
      getCoverageForDateKey: () => ({
        dayShiftTarget: 1,
        nightShiftTarget: 1,
      }),
      leaveByDoctor: new Map(),
      rules,
    });

    const date = parseDateKey("2026-05-01");
    const h24 = workingShifts.filter((s) => s.shiftCode === "TWENTY_FOUR");
    const ln = workingShifts.filter(
      (s) => s.shiftCode === "L" || s.shiftCode === "N",
    );
    assert.ok(h24.length >= 1);
    assert.equal(ln.length, 0);
    assert.equal(countBandForDate(date, "L", workingShifts), 1);
    assert.equal(countBandForDate(date, "N", workingShifts), 1);
  });
});
