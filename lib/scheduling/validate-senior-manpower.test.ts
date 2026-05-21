import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import {
  validateSeniorManpowerForBand,
  validateSeniorManpowerForDate,
} from "@/lib/scheduling/validate-senior-manpower";
import type { DoctorInfo, ShiftAssignment } from "@/lib/scheduling/types";

const date = parseDateKey("2026-05-10");
const doctorsById = new Map<string, Pick<DoctorInfo, "seniority">>([
  ["senior", { seniority: "SENIOR" }],
  ["junior", { seniority: "JUNIOR" }],
]);

describe("validateSeniorManpowerForBand", () => {
  it("skips when band is unstaffed", () => {
    assert.equal(
      validateSeniorManpowerForBand(date, "L", [], doctorsById),
      null,
    );
  });

  it("fails when only Junior doctors staff day band", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "junior",
        date,
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    assert.match(
      validateSeniorManpowerForBand(date, "L", shifts, doctorsById) ?? "",
      /Senior/,
    );
  });

  it("passes when at least one Senior is on the band", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "junior",
        date,
        shiftCode: "L",
        durationHours: 12,
      },
      {
        doctorId: "senior",
        date,
        shiftCode: "L",
        durationHours: 12,
      },
    ];
    assert.equal(
      validateSeniorManpowerForBand(date, "L", shifts, doctorsById),
      null,
    );
  });
});

describe("validateSeniorManpowerForDate", () => {
  it("checks L and N independently", () => {
    const shifts: ShiftAssignment[] = [
      {
        doctorId: "senior",
        date,
        shiftCode: "L",
        durationHours: 12,
      },
      {
        doctorId: "junior",
        date,
        shiftCode: "N",
        durationHours: 12,
      },
    ];
    const doctors: Pick<DoctorInfo, "id" | "seniority">[] = [
      { id: "senior", seniority: "SENIOR" },
      { id: "junior", seniority: "JUNIOR" },
    ];
    const errors = validateSeniorManpowerForDate(
      date,
      shifts,
      doctors,
      DEFAULT_SCHEDULING_RULES,
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0] ?? "", /Night/);
  });
});
