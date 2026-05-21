import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDateKey } from "@/lib/scheduling/dates";
import { suggestReconcileMonth } from "@/lib/scheduling/reconcile-suggest";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import type {
  DoctorInfo,
  ShiftAssignment,
  ShiftTypeInfo,
} from "@/lib/scheduling/types";

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

const doctors: DoctorInfo[] = [
  {
    id: "d1",
    name: "Alice",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
  },
  {
    id: "d2",
    name: "Bob",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
  },
  {
    id: "d3",
    name: "Carol",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
  },
];

const reconcileCtx = {
  year: 2026,
  month: 5,
  doctors,
  shiftTypes,
  monthDefaults: { dayShiftTarget: 2, nightShiftTarget: 1 },
  dailyOverrides: new Map<string, { dayShiftTarget: number; nightShiftTarget: number }>(),
  doctorRotations: new Map(),
  leaveByDoctor: new Map<string, Set<string>>(),
  rules: {
    ...DEFAULT_SCHEDULING_RULES,
    maxConsecutiveOffDays: 31,
  },
};

describe("suggestReconcileMonth", () => {
  it("does not propose shifts on manual doctor-day anchors", () => {
    const manualShifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
        source: "MANUAL",
      },
    ];

    const result = suggestReconcileMonth(reconcileCtx, manualShifts);
    const conflict = result.proposals.find(
      (p) => p.doctorId === "d1" && p.date === "2026-05-01",
    );
    assert.equal(conflict, undefined);
  });

  it("proposes auto fills without replacing manual anchors", () => {
    const manualShifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-01"),
        shiftCode: "L",
        durationHours: 12,
        source: "MANUAL",
      },
    ];

    const result = suggestReconcileMonth(reconcileCtx, manualShifts);
    assert.ok(result.proposals.length > 0, "should propose auto gap-fills");
    assert.ok(
      !result.proposals.some(
        (p) => p.doctorId === "d1" && p.date === "2026-05-01",
      ),
      "manual anchor must not be replaced",
    );
  });

  it("does not warn about missing senior when manual shift is senior on day band", () => {
    const manualShifts: ShiftAssignment[] = [
      {
        doctorId: "d1",
        date: parseDateKey("2026-05-10"),
        shiftCode: "L",
        durationHours: 12,
        source: "MANUAL",
      },
    ];

    const result = suggestReconcileMonth(reconcileCtx, manualShifts);
    const seniorWarnings = result.warnings.filter((w) =>
      /senior/i.test(w) && w.includes("2026-05-10"),
    );
    assert.equal(
      seniorWarnings.length,
      0,
      "manual senior on L should satisfy senior coverage for that date",
    );
  });
});
