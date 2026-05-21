import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import { validateHours } from "@/lib/scheduling/validate-hours";
import type { DoctorInfo, ShiftAssignment } from "@/lib/scheduling/types";

const monthKeys = ["2026-05-01", "2026-05-02", "2026-05-03"];
const doctor: DoctorInfo = {
  id: "d1",
  name: "Junior A",
  targetHours: 240,
  seniority: "JUNIOR",
  restrictions: [],
};

function shift(dateStr: string, code: ShiftAssignment["shiftCode"]): ShiftAssignment {
  return {
    doctorId: doctor.id,
    date: parseDateKey(dateStr),
    shiftCode: code,
    durationHours: code === "TWENTY_FOUR" ? 24 : 12,
  };
}

describe("validateHours", () => {
  it("allows replacing a shift on a day when the doctor is already at target", () => {
    const existingShifts = [
      shift("2026-05-01", "L"),
      shift("2026-05-02", "L"),
      shift("2026-05-03", "N"),
    ];
    // Draft preview already contains the replacement on 2026-05-03.
    const draftShifts = [
      shift("2026-05-01", "L"),
      shift("2026-05-02", "L"),
      shift("2026-05-03", "L"),
    ];

    assert.equal(
      validateHours(doctor, monthKeys, draftShifts, 12, parseDateKey("2026-05-03")),
      null,
    );
  });

  it("blocks net-new hours that would exceed the monthly target", () => {
    const atTargetDoctor: DoctorInfo = { ...doctor, targetHours: 24 };
    const existingShifts = [shift("2026-05-01", "L"), shift("2026-05-02", "L")];

    assert.match(
      validateHours(atTargetDoctor, monthKeys, existingShifts, 12) ?? "",
      /exceed their monthly hour limit/,
    );
  });
});
