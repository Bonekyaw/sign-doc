import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoAssign } from "@/lib/scheduling/auto-assign";
import { rulesForAutoAssign } from "@/lib/scheduling/main-flow-rules";
import { bandHasSenior } from "@/lib/scheduling/validate-senior-manpower";
import { parseDateKey, getMonthDateKeys } from "@/lib/scheduling/dates";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import type { DoctorInfo, ShiftTypeInfo } from "@/lib/scheduling/types";

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

function buildRoster(): DoctorInfo[] {
  const roster: DoctorInfo[] = [];
  for (let i = 0; i < 3; i++) {
    roster.push({
      id: `senior-${i}`,
      name: `Senior ${i}`,
      targetHours: 240,
      seniority: "SENIOR",
      restrictions: [],
    });
  }
  for (let i = 0; i < 6; i++) {
    roster.push({
      id: `junior-${i}`,
      name: `Junior ${i}`,
      targetHours: 240,
      seniority: "JUNIOR",
      restrictions: [],
    });
  }
  return roster;
}

describe("senior manpower on auto-assign", () => {
  it("every staffed L and N band includes at least one Senior", () => {
    const doctors = buildRoster();
    const year = 2026;
    const month = 5;
    const monthKeys = getMonthDateKeys(year, month);
    const rules = rulesForAutoAssign(DEFAULT_SCHEDULING_RULES);

    const result = autoAssign({
      year,
      month,
      doctors,
      shiftTypes,
      existingShifts: [],
      monthDefaults: { dayShiftTarget: 2, nightShiftTarget: 2 },
      dailyOverrides: new Map(),
      leaveByDoctor: new Map(),
      rules,
    });

    assert.ok(result.proposals.length > 0, "should place shifts");

    const doctorsById = new Map(doctors.map((d) => [d.id, d]));
    for (const key of monthKeys) {
      const date = parseDateKey(key);
      const dayShifts = result.proposals
        .filter((p) => p.date === key)
        .map((p) => ({
          doctorId: p.doctorId,
          date: parseDateKey(p.date),
          shiftCode: p.shiftCode,
          durationHours: 12,
        }));

      for (const band of ["L", "N"] as const) {
        const staffed = dayShifts.some((s) => s.shiftCode === band);
        if (!staffed) continue;
        assert.equal(
          bandHasSenior(date, band, dayShifts, doctorsById),
          true,
          `${key} ${band} must have a Senior when staffed`,
        );
      }
    }
  });
});
