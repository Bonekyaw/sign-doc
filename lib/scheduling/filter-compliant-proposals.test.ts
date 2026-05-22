import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import { filterCompliantProposals } from "@/lib/scheduling/filter-compliant-proposals";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import type {
  AutoAssignProposal,
  DoctorInfo,
  ShiftAssignment,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

const monthKeys = ["2026-05-01"];
const doctors: DoctorInfo[] = [
  {
    id: "d1",
    name: "Doctor One",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
  },
];
const shiftTypes: ShiftTypeInfo[] = [
  {
    id: "l1",
    code: "L",
    label: "Long Day",
    durationHours: 12,
    color: "#0284c7",
    isActive: true,
  },
];

describe("filterCompliantProposals", () => {
  it("skips proposals on doctor-days already anchored in baseShifts", () => {
    const baseShifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "OFF",
        durationHours: 0,
      },
    ];
    const proposals: AutoAssignProposal[] = [
      {
        doctorId: "d1",
        date: "2026-05-01",
        shiftCode: "L",
        shiftTypeId: "l1",
        durationHours: 12,
      },
    ];

    const { proposals: kept, droppedCount } = filterCompliantProposals({
      proposals,
      baseShifts,
      doctors,
      shiftTypes,
      monthKeys,
      getCoverageForDateKey: () => ({ dayShiftTarget: 1, nightShiftTarget: 1 }),
      rules: DEFAULT_SCHEDULING_RULES,
    });

    assert.equal(kept.length, 0);
    assert.equal(droppedCount, 1);
  });
});
