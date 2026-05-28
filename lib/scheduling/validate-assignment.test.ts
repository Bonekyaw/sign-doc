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
  {
    id: "off",
    code: "OFF",
    label: "Off",
    durationHours: 0,
    color: "#94a3b8",
    isActive: false,
  },
];

const doctors: DoctorInfo[] = [
  {
    id: "s1",
    name: "Senior",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "j1",
    name: "Junior 1",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "j2",
    name: "Junior 2",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "j3",
    name: "Junior 3",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "j4",
    name: "Junior 4",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: false,
  },
  {
    id: "j5",
    name: "Junior 5",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: false,
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

  it("allows inactive OFF for admin manual edits", () => {
    const result = validateAssignment({
      doctor: doctors[0]!,
      date,
      shiftCode: "OFF",
      shiftTypes,
      existingShifts: [],
      monthKeys,
      coverageTarget,
      doctors,
      purpose: "manualEdit",
    });

    assert.equal(result.ok, true);
  });
});

describe("validateAssignment rule-exempt doctors", () => {
  const exemptDoctor: DoctorInfo = {
    id: "exempt-1",
    name: "Exempt",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
    schedulingRuleExempt: true,
  };

  it("allows forbidden fatigue patterns for exempt doctors on manualEdit", () => {
    const existingShifts: ShiftAssignment[] = [
      {
        doctorId: exemptDoctor.id,
        date: parseDateKey("2026-05-01"),
        shiftCode: "N",
        durationHours: 12,
      },
      {
        doctorId: exemptDoctor.id,
        date: parseDateKey("2026-05-02"),
        shiftCode: "N",
        durationHours: 12,
      },
      {
        doctorId: exemptDoctor.id,
        date: parseDateKey("2026-05-03"),
        shiftCode: "N",
        durationHours: 12,
      },
    ];
    const monthKeys = ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04"];

    const result = validateAssignment({
      doctor: exemptDoctor,
      date: parseDateKey("2026-05-04"),
      shiftCode: "N",
      shiftTypes,
      existingShifts,
      monthKeys,
      coverageTarget,
      doctors: [exemptDoctor],
      purpose: "manualEdit",
    });

    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
  });

  it("still enforces rules for exempt doctors on coverage purpose", () => {
    const existingShifts: ShiftAssignment[] = [
      {
        doctorId: exemptDoctor.id,
        date: parseDateKey("2026-05-01"),
        shiftCode: "N",
        durationHours: 12,
      },
      {
        doctorId: exemptDoctor.id,
        date: parseDateKey("2026-05-02"),
        shiftCode: "N",
        durationHours: 12,
      },
      {
        doctorId: exemptDoctor.id,
        date: parseDateKey("2026-05-03"),
        shiftCode: "N",
        durationHours: 12,
      },
    ];
    const monthKeys = ["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04"];

    const result = validateAssignment({
      doctor: exemptDoctor,
      date: parseDateKey("2026-05-04"),
      shiftCode: "N",
      shiftTypes,
      existingShifts,
      monthKeys,
      coverageTarget,
      doctors: [exemptDoctor],
      purpose: "coverage",
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /consecutive Night/i);
  });
});
