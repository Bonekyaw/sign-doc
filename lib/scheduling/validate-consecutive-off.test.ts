import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import {
  maxConsecutiveOffStreak,
  maxConsecutiveOffStreakInWorkSpan,
  validateConsecutiveOffDays,
} from "@/lib/scheduling/validate-consecutive-off";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import type { ShiftAssignment } from "@/lib/scheduling/types";

describe("consecutive off streak", () => {
  const monthKeys = getMonthDateKeys(2026, 5);

  it("ignores leading unscheduled days in work-span audit", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-21"),
        shiftCode: "L",
        durationHours: 12,
      },
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-24"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    assert.equal(maxConsecutiveOffStreak("d1", monthKeys, shifts), 20);
    assert.equal(maxConsecutiveOffStreakInWorkSpan("d1", monthKeys, shifts), 2);
    assert.equal(
      validateConsecutiveOffDays("d1", "Dr One", monthKeys, shifts),
      null,
    );
  });

  it("flags 4+ off days between work in work span", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
      },
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-06"),
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    assert.equal(maxConsecutiveOffStreakInWorkSpan("d1", monthKeys, shifts), 4);
    const err = validateConsecutiveOffDays(
      "d1",
      "Dr One",
      monthKeys,
      shifts,
      DEFAULT_SCHEDULING_RULES,
    );
    assert.match(err ?? "", /4 consecutive days off/);
  });
});
