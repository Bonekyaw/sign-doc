import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findSameSeniorityReplacementOptions } from "@/lib/scheduling/published-replacement";
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
    id: "senior-a",
    name: "Senior A",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "senior-b",
    name: "Senior B",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "junior-a",
    name: "Junior A",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
];

const monthKeys = ["2026-05-01", "2026-05-02"];
const coverage = { dayShiftTarget: 1, nightShiftTarget: 1 };
const leaveByDoctor = new Map<string, Set<string>>();

describe("findSameSeniorityReplacementOptions", () => {
  it("offers replace only to same seniority when colleague is free", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "senior-a",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];

    const result = findSameSeniorityReplacementOptions({
      doctors,
      shifts,
      dateStr: "2026-05-01",
      fromDoctorId: "senior-a",
      shiftTypes,
      monthKeys,
      coverageTarget: coverage,
      leaveByDoctor,
      rules: DEFAULT_SCHEDULING_RULES,
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(
      result.options.some(
        (o) => o.doctorId === "senior-b" && o.mode === "replace",
      ),
    );
    assert.ok(
      !result.options.some((o) => o.doctorId === "junior-a"),
      "junior cannot replace senior",
    );
  });

  it("returns error when doctor has no shift on date", () => {
    const result = findSameSeniorityReplacementOptions({
      doctors,
      shifts: [],
      dateStr: "2026-05-01",
      fromDoctorId: "senior-a",
      shiftTypes,
      monthKeys,
      coverageTarget: coverage,
      leaveByDoctor,
      rules: DEFAULT_SCHEDULING_RULES,
    });
    assert.equal(result.ok, false);
  });
});
