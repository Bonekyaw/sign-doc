import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import {
  DEFAULT_SCHEDULING_RULES,
  type SchedulingRulesConfig,
} from "@/lib/scheduling/rules-types";
import { validateOffStreakOnAssign } from "@/lib/scheduling/validate-consecutive-off";
import {
  validateSeniorManpowerForBand,
} from "@/lib/scheduling/validate-senior-manpower";
import { validateShift } from "@/lib/validate-shift";
import type { ShiftAssignment } from "@/lib/scheduling/types";

const monthKeys = [
  "2026-05-01",
  "2026-05-02",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
];

function shift(
  doctorId: string,
  date: Date,
  shiftCode: ShiftAssignment["shiftCode"],
): ShiftAssignment {
  return { doctorId, date, shiftCode, durationHours: 12 };
}

describe("configurable scheduling rules", () => {
  it("blocks L→24h when blockLongDayBefore24 is enabled", () => {
    const rules: SchedulingRulesConfig = {
      ...DEFAULT_SCHEDULING_RULES,
      blockLongDayBefore24: true,
    };
    const existing = [shift("d1", parseDateKey("2026-05-10"), "L")];
    const err = validateShift(
      "d1",
      parseDateKey("2026-05-11"),
      "TWENTY_FOUR",
      existing,
      rules,
    );
    assert.match(err ?? "", /Long Day/);
  });

  it("skips senior check on day band when disabled", () => {
    const rules: SchedulingRulesConfig = {
      ...DEFAULT_SCHEDULING_RULES,
      requireSeniorOnDayBand: false,
    };
    const date = parseDateKey("2026-05-10");
    const doctorsById = new Map([["junior", { seniority: "JUNIOR" as const }]]);
    const shifts = [shift("junior", date, "L")];
    assert.equal(
      validateSeniorManpowerForBand(date, "L", shifts, doctorsById, rules),
      null,
    );
  });

  it("uses maxConsecutiveOffDays from rules on assign", () => {
    const rules: SchedulingRulesConfig = {
      ...DEFAULT_SCHEDULING_RULES,
      maxConsecutiveOffDays: 2,
    };
    const keys = [...monthKeys, "2026-05-06"];
    const existing = [shift("d1", parseDateKey("2026-05-01"), "L")];
    const err = validateOffStreakOnAssign(
      "d1",
      "Alice",
      parseDateKey("2026-05-06"),
      keys,
      existing,
      rules,
    );
    assert.match(err ?? "", /2 consecutive/);
  });
});
