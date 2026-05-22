import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import {
  ShiftType,
  calculateMonthlyHours,
  compareMonthlyHoursToTarget,
  validateDailyManpower,
  validateShiftSequence,
  type DoctorRecord,
  type ShiftRecord,
} from "@/lib/scheduling/shift-validation-service";

function shift(
  doctorId: string,
  dateStr: string,
  shiftType: ShiftType,
): ShiftRecord {
  return {
    doctorId,
    date: parseDateKey(dateStr),
    shiftType,
  };
}

const doctorId = "d1";

describe("validateShiftSequence", () => {
  it("requires OFF on day after TWENTY_FOUR (post-24h rest)", () => {
    const existing = [shift(doctorId, "2026-05-10", ShiftType.TWENTY_FOUR)];
    const work = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-11"),
      ShiftType.LONG_DAY,
      existing,
    );
    assert.equal(work.isValid, false);
    const off = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-11"),
      ShiftType.OFF,
      existing,
    );
    assert.equal(off.isValid, true);
  });

  it("blocks NIGHT followed by TWENTY_FOUR", () => {
    const existing = [shift(doctorId, "2026-05-10", ShiftType.NIGHT)];
    const outcome = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-11"),
      ShiftType.TWENTY_FOUR,
      existing,
    );
    assert.equal(outcome.isValid, false);
    assert.match(outcome.error ?? "", /Night/i);
  });

  it("blocks NIGHT followed by LONG_DAY", () => {
    const existing = [shift(doctorId, "2026-05-10", ShiftType.NIGHT)];
    const outcome = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-11"),
      ShiftType.LONG_DAY,
      existing,
    );
    assert.equal(outcome.isValid, false);
    assert.match(outcome.error ?? "", /Night.*Long Day/i);
  });

  it("allows NIGHT followed by NIGHT", () => {
    const existing = [shift(doctorId, "2026-05-10", ShiftType.NIGHT)];
    const outcome = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-11"),
      ShiftType.NIGHT,
      existing,
    );
    assert.equal(outcome.isValid, true);
  });

  it("allows LONG_DAY followed by TWENTY_FOUR", () => {
    const existing = [shift(doctorId, "2026-05-10", ShiftType.LONG_DAY)];
    const outcome = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-11"),
      ShiftType.TWENTY_FOUR,
      existing,
    );
    assert.equal(outcome.isValid, true);
  });

  it("blocks 3rd consecutive LONG_DAY", () => {
    const existing = [
      shift(doctorId, "2026-05-01", ShiftType.LONG_DAY),
      shift(doctorId, "2026-05-02", ShiftType.LONG_DAY),
    ];
    const outcome = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-03"),
      ShiftType.LONG_DAY,
      existing,
    );
    assert.equal(outcome.isValid, false);
    assert.match(outcome.error ?? "", /Long Day/i);
  });

  it("blocks 3rd consecutive NIGHT", () => {
    const existing = [
      shift(doctorId, "2026-05-01", ShiftType.NIGHT),
      shift(doctorId, "2026-05-02", ShiftType.NIGHT),
    ];
    const outcome = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-03"),
      ShiftType.NIGHT,
      existing,
    );
    assert.equal(outcome.isValid, false);
    assert.match(outcome.error ?? "", /Night/i);
  });

  it("blocks 4th consecutive OFF day", () => {
    const existing = [
      shift(doctorId, "2026-05-01", ShiftType.OFF),
      shift(doctorId, "2026-05-02", ShiftType.OFF),
      shift(doctorId, "2026-05-03", ShiftType.OFF),
    ];
    const outcome = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-04"),
      ShiftType.OFF,
      existing,
    );
    assert.equal(outcome.isValid, false);
    assert.match(outcome.error ?? "", /off/i);
  });

  it("blocks work on day after proposing TWENTY_FOUR when next day already staffed", () => {
    const existing = [
      shift(doctorId, "2026-05-12", ShiftType.LONG_DAY),
    ];
    const outcome = validateShiftSequence(
      doctorId,
      parseDateKey("2026-05-11"),
      ShiftType.TWENTY_FOUR,
      existing,
    );
    assert.equal(outcome.isValid, false);
    assert.match(outcome.error ?? "", /off/i);
  });
});

describe("validateDailyManpower", () => {
  const senior: DoctorRecord = {
    id: "s1",
    seniority: "SENIOR",
    targetMonthlyHours: 240,
  };
  const junior: DoctorRecord = {
    id: "j1",
    seniority: "JUNIOR",
    targetMonthlyHours: 240,
  };

  it("fails when only junior/mid staff LONG_DAY", () => {
    const outcome = validateDailyManpower(
      parseDateKey("2026-05-01"),
      ShiftType.LONG_DAY,
      [junior],
    );
    assert.equal(outcome.isValid, false);
    assert.match(outcome.error ?? "", /Senior/i);
  });

  it("passes when at least one senior on band", () => {
    const outcome = validateDailyManpower(
      parseDateKey("2026-05-01"),
      ShiftType.NIGHT,
      [junior, senior],
    );
    assert.equal(outcome.isValid, true);
  });

  it("passes when band is unstaffed", () => {
    const outcome = validateDailyManpower(
      parseDateKey("2026-05-01"),
      ShiftType.LONG_DAY,
      [],
    );
    assert.equal(outcome.isValid, true);
  });
});

describe("calculateMonthlyHours", () => {
  it("sums LONG_DAY, NIGHT, and TWENTY_FOUR hours; OFF is zero", () => {
    const hours = calculateMonthlyHours([
      shift(doctorId, "2026-05-01", ShiftType.LONG_DAY),
      shift(doctorId, "2026-05-02", ShiftType.NIGHT),
      shift(doctorId, "2026-05-03", ShiftType.TWENTY_FOUR),
      shift(doctorId, "2026-05-04", ShiftType.OFF),
    ]);
    assert.equal(hours, 12 + 12 + 24);
  });
});

describe("compareMonthlyHoursToTarget", () => {
  const doctor: DoctorRecord = {
    id: doctorId,
    seniority: "SENIOR",
    targetMonthlyHours: 240,
  };

  it("warns when under full-time target", () => {
    const cmp = compareMonthlyHoursToTarget(doctor, [
      shift(doctorId, "2026-05-01", ShiftType.LONG_DAY),
    ]);
    assert.equal(cmp.isUnder, true);
    assert.equal(cmp.worked, 12);
    assert.ok(cmp.warning?.includes("short"));
  });

  it("warns when over target", () => {
    const shifts: ShiftRecord[] = [];
    for (let d = 1; d <= 21; d++) {
      shifts.push(
        shift(
          doctorId,
          `2026-05-${String(d).padStart(2, "0")}`,
          ShiftType.TWENTY_FOUR,
        ),
      );
    }
    const cmp = compareMonthlyHoursToTarget(doctor, shifts);
    assert.equal(cmp.isOver, true);
    assert.ok(cmp.warning?.includes("exceeds"));
  });
});
