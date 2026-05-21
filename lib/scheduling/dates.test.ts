import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultTargetHours } from "@/lib/scheduling/dates";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";

describe("defaultTargetHours", () => {
  it("returns FT, half-time, and PT defaults from scheduling rules", () => {
    const rules = {
      ...DEFAULT_SCHEDULING_RULES,
      ftDefaultTargetHours: 240,
      halfTimeDefaultTargetHours: 120,
      ptDefaultTargetHours: 80,
    };
    assert.equal(defaultTargetHours("FT", rules), 240);
    assert.equal(defaultTargetHours("HALF_TIME", rules), 120);
    assert.equal(defaultTargetHours("PT", rules), 80);
  });
});
