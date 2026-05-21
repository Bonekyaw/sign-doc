import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import { validateAssignment } from "@/lib/scheduling/validate-assignment";
import type {
  DoctorInfo,
  ShiftAssignment,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

const date = parseDateKey("2026-05-01");
const monthKeys = ["2026-05-01"];
const coverageTarget = { dayShiftTarget: 4, nightShiftTarget: 3 };

const shiftTypes: ShiftTypeInfo[] = [
  {
    id: "l",
    code: "L",
    label: "Long Day",
    durationHours: 12,
    color: "#0284c7",
    isActive: true,
  },
  {
    id: "n",
    code: "N",
    label: "Night",
    durationHours: 12,
    color: "#6366f1",
    isActive: true,
  },
];

const doctors: DoctorInfo[] = [
  {
    id: "s1",
    name: "Senior",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
  },
  {
    id: "j1",
    name: "Junior 1",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
  },
  {
    id: "j2",
    name: "Junior 2",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
  },
  {
    id: "j3",
    name: "Junior 3",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
  },
  {
    id: "j4",
    name: "Junior 4",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
  },
  {
    id: "j5",
    name: "Junior 5",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
  },
];

function bandShift(
  doctorId: string,
  code: ShiftAssignment["shiftCode"],
): ShiftAssignment {
  return {
    doctorId,
    date,
    shiftCode: code,
    durationHours: 12,
  };
}

describe("validateAssignment over-coverage", () => {
  it("blocks auto coverage fills above the configured target", () => {
    const existingShifts = [
      bandShift("s1", "L"),
      bandShift("j1", "L"),
      bandShift("j2", "L"),
      bandShift("j3", "L"),
    ];

    const result = validateAssignment({
      doctor: doctors[4]!,
      date,
      shiftCode: "L",
      shiftTypes,
      existingShifts,
      monthKeys,
      coverageTarget,
      doctors,
      purpose: "coverage",
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /maximum day shift coverage/i);
  });

  it("allows admin manual edits above the configured target with warnings", () => {
    const existingShifts = [
      bandShift("s1", "L"),
      bandShift("j1", "L"),
      bandShift("j2", "L"),
      bandShift("j3", "L"),
    ];

    const result = validateAssignment({
      doctor: doctors[4]!,
      date,
      shiftCode: "L",
      shiftTypes,
      existingShifts,
      monthKeys,
      coverageTarget,
      doctors,
      purpose: "manualEdit",
    });

    assert.equal(result.ok, true);
    assert.match(result.warnings.join(" "), /Over target day coverage \(5\/4\)/);
  });
});
