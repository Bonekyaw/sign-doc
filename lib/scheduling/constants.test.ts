import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatManpowerRatio,
  isValidManpowerRatio,
  normalizeManpowerTargets,
  presetIdToTargets,
  targetsToPresetId,
  validateCoverageTargetValues,
} from "@/lib/scheduling/constants";

describe("manpower presets", () => {
  it("accepts L3-N3, L3-N2, and L4-N3", () => {
    assert.equal(isValidManpowerRatio(3, 3), true);
    assert.equal(isValidManpowerRatio(3, 2), true);
    assert.equal(isValidManpowerRatio(4, 3), true);
  });

  it("rejects invalid pairs such as L4-N2", () => {
    assert.equal(isValidManpowerRatio(4, 2), false);
    const err = validateCoverageTargetValues(4, 2);
    assert.ok(err);
    assert.match(err, /L3 - N3/);
  });

  it("formats ratios as L# - N#", () => {
    assert.equal(formatManpowerRatio(3, 2), "L3 - N2");
  });

  it("maps preset ids to targets and back", () => {
    assert.equal(targetsToPresetId(3, 3), "L3-N3");
    assert.deepEqual(presetIdToTargets("L4-N3"), {
      dayShiftTarget: 4,
      nightShiftTarget: 3,
    });
  });

  it("normalizes invalid stored values to L4-N3", () => {
    assert.deepEqual(normalizeManpowerTargets(4, 2), {
      dayShiftTarget: 4,
      nightShiftTarget: 3,
    });
  });
});
