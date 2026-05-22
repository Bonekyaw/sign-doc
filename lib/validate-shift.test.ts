import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { validateShift } from "@/lib/validate-shift";
import type { ShiftAssignment } from "@/lib/scheduling/types";

function shift(
  doctorId: string,
  date: Date,
  shiftCode: ShiftAssignment["shiftCode"],
): ShiftAssignment {
  return { doctorId, date, shiftCode, durationHours: 12 };
}

describe("validateShift fatigue transitions", () => {
  it("allows Long Day followed by 24-hour shift", () => {
    const date = parseDateKey("2026-05-11");
    const existing: ShiftAssignment[] = [
      shift("d1", parseDateKey("2026-05-10"), "L"),
    ];
    assert.equal(validateShift("d1", date, "TWENTY_FOUR", existing), null);
  });

  it("blocks Night followed by 24-hour shift", () => {
    const date = parseDateKey("2026-05-11");
    const existing: ShiftAssignment[] = [
      shift("d1", parseDateKey("2026-05-10"), "N"),
    ];
    assert.match(
      validateShift("d1", date, "TWENTY_FOUR", existing) ?? "",
      /Night/,
    );
  });

  it("blocks Night followed by Long Day shift", () => {
    const date = parseDateKey("2026-05-11");
    const existing: ShiftAssignment[] = [
      shift("d1", parseDateKey("2026-05-10"), "N"),
    ];
    assert.match(
      validateShift("d1", date, "L", existing) ?? "",
      /Night.*Long Day/i,
    );
  });

  it("allows Night followed by Night shift", () => {
    const date = parseDateKey("2026-05-11");
    const existing: ShiftAssignment[] = [
      shift("d1", parseDateKey("2026-05-10"), "N"),
    ];
    assert.equal(validateShift("d1", date, "N", existing), null);
  });

  it("requires at least one day off after 24-hour shift", () => {
    const after24 = parseDateKey("2026-05-11");
    const existing: ShiftAssignment[] = [
      shift("d1", parseDateKey("2026-05-10"), "TWENTY_FOUR"),
    ];
    assert.match(
      validateShift("d1", after24, "L", existing) ?? "",
      /off/i,
    );
  });

  it("blocks a 3rd consecutive Long Day when max is 2", () => {
    const date = parseDateKey("2026-05-03");
    const existing: ShiftAssignment[] = [
      shift("d1", parseDateKey("2026-05-01"), "L"),
      shift("d1", parseDateKey("2026-05-02"), "L"),
    ];
    const rules = { ...DEFAULT_SCHEDULING_RULES, maxConsecutiveLongDay: 2 };
    assert.match(
      validateShift("d1", date, "L", existing, rules) ?? "",
      /2 consecutive/,
    );
  });
});
