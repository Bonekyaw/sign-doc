import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adminAssignableShiftTypes,
  isOffDayAssignment,
} from "@/lib/scheduling/admin-assignable-shifts";

const shiftTypes = [
  { id: "l1", code: "L", isActive: true },
  { id: "off1", code: "OFF", isActive: false },
];

describe("adminAssignableShiftTypes", () => {
  it("includes inactive OFF for admin schedule only", () => {
    const admin = adminAssignableShiftTypes(shiftTypes, { adminSchedule: true });
    assert.equal(admin.length, 2);
    assert.ok(admin.some((t) => t.code === "OFF"));

    const portal = adminAssignableShiftTypes(shiftTypes, {
      adminSchedule: false,
    });
    assert.equal(portal.length, 1);
    assert.equal(portal[0]?.code, "L");
  });
});

describe("isOffDayAssignment", () => {
  it("detects OFF assignments", () => {
    assert.equal(isOffDayAssignment({ code: "OFF" }), true);
    assert.equal(isOffDayAssignment({ code: "L" }), false);
    assert.equal(isOffDayAssignment(undefined), false);
  });
});
