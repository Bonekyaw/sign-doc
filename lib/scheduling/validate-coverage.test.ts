import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import {
  countBandForDate,
  shiftCountsTowardBand,
} from "@/lib/scheduling/validate-coverage";
import type { ShiftAssignment } from "@/lib/scheduling/types";

const date = parseDateKey("2026-05-01");

describe("shiftCountsTowardBand", () => {
  it("counts TWENTY_FOUR toward both L and N", () => {
    assert.equal(shiftCountsTowardBand("TWENTY_FOUR", "L"), true);
    assert.equal(shiftCountsTowardBand("TWENTY_FOUR", "N"), true);
    assert.equal(shiftCountsTowardBand("L", "L"), true);
    assert.equal(shiftCountsTowardBand("L", "N"), false);
    assert.equal(shiftCountsTowardBand("N", "N"), true);
    assert.equal(shiftCountsTowardBand("OFF", "L"), false);
  });
});

describe("countBandForDate", () => {
  it("counts one TWENTY_FOUR shift toward both bands", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date,
        shiftCode: "TWENTY_FOUR",
        durationHours: 24,
      },
    ];
    assert.equal(countBandForDate(date, "L", shifts), 1);
    assert.equal(countBandForDate(date, "N", shifts), 1);
  });

  it("combines L and TWENTY_FOUR counts correctly", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date,
        shiftCode: "L",
        durationHours: 12,
      },
      {
        doctorId: "d2",
        date,
        shiftCode: "TWENTY_FOUR",
        durationHours: 24,
      },
    ];
    assert.equal(countBandForDate(date, "L", shifts), 2);
    assert.equal(countBandForDate(date, "N", shifts), 1);
  });

  it("respects excludeDoctorId", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date,
        shiftCode: "TWENTY_FOUR",
        durationHours: 24,
      },
    ];
    assert.equal(countBandForDate(date, "L", shifts, "d1"), 0);
    assert.equal(countBandForDate(date, "N", shifts, "d1"), 0);
  });
});
