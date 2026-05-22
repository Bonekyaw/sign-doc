import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SCHEDULING_RULE_FIELD_GUIDE,
  guideEntryForField,
} from "@/lib/scheduling/scheduling-rules-field-guide";

describe("scheduling rules field guide", () => {
  it("documents every editable scheduling rules field", () => {
    const fields = new Set(SCHEDULING_RULE_FIELD_GUIDE.map((e) => e.field));
    assert.equal(fields.size, SCHEDULING_RULE_FIELD_GUIDE.length);
    for (const name of [
      "post24MinRestDays",
      "maxConsecutiveLongDay",
      "maxConsecutiveNight",
      "blockNightBefore24",
      "blockLongDayBefore24",
      "maxConsecutiveOffDays",
      "minDaysOffPerMonth",
      "requireSeniorOnDayBand",
      "requireSeniorOnNightBand",
      "ftDefaultTargetHours",
      "halfTimeDefaultTargetHours",
      "ptDefaultTargetHours",
    ]) {
      assert.ok(fields.has(name), `missing guide entry for ${name}`);
    }
  });

  it("marks main-flow-locked toggles as ignored", () => {
    assert.equal(
      guideEntryForField("blockNightBefore24")?.effect,
      "ignored",
    );
    assert.equal(
      guideEntryForField("requireSeniorOnDayBand")?.effect,
      "ignored",
    );
  });

  it("marks min off days as warning-only", () => {
    assert.equal(
      guideEntryForField("minDaysOffPerMonth")?.effect,
      "warning-only",
    );
  });
});
