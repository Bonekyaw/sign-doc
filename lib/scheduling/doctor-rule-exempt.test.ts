import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { doctorBypassesSchedulingRules } from "@/lib/scheduling/doctor-rule-exempt";

describe("doctorBypassesSchedulingRules", () => {
  const exemptDoctor = { schedulingRuleExempt: true };
  const normalDoctor = { schedulingRuleExempt: false };

  it("returns true only for manualEdit when doctor is exempt", () => {
    assert.equal(
      doctorBypassesSchedulingRules(exemptDoctor, "manualEdit"),
      true,
    );
  });

  it("returns false for exempt doctors on non-manual purposes", () => {
    assert.equal(doctorBypassesSchedulingRules(exemptDoctor, "coverage"), false);
    assert.equal(
      doctorBypassesSchedulingRules(exemptDoctor, "hoursFill"),
      false,
    );
  });

  it("returns false for non-exempt doctors on manualEdit", () => {
    assert.equal(
      doctorBypassesSchedulingRules(normalDoctor, "manualEdit"),
      false,
    );
  });
});
