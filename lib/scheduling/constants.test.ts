import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatManpowerRatio,
  isValidManpowerRatio,
  mergeManpowerPresets,
  normalizeManpowerTargets,
  parseRatioPresetId,
  presetIdToTargets,
  ratioPresetId,
  targetsToPresetId,
  validateCoverageTargetValues,
} from "@/lib/scheduling/constants";

describe("manpower presets", () => {
  it("accepts any L/N counts within configured ranges", () => {
    assert.equal(isValidManpowerRatio(3, 3), true);
    assert.equal(isValidManpowerRatio(3, 2), true);
    assert.equal(isValidManpowerRatio(4, 3), true);
    assert.equal(isValidManpowerRatio(4, 2), true);
    assert.equal(isValidManpowerRatio(5, 1), true);
  });

  it("rejects out-of-range counts", () => {
    assert.equal(isValidManpowerRatio(0, 2), false);
    assert.equal(isValidManpowerRatio(4, 11), false);
    const err = validateCoverageTargetValues(0, 2);
    assert.ok(err);
  });

  it("formats ratios as L# - N#", () => {
    assert.equal(formatManpowerRatio(3, 2), "L3 - N2");
  });

  it("maps ratio ids to targets and back", () => {
    assert.equal(targetsToPresetId(3, 3), "L3-N3");
    assert.deepEqual(presetIdToTargets("L4-N3"), {
      dayShiftTarget: 4,
      nightShiftTarget: 3,
    });
    assert.deepEqual(parseRatioPresetId("L5-N2"), {
      dayShiftTarget: 5,
      nightShiftTarget: 2,
    });
    assert.equal(ratioPresetId(4, 2), "L4-N2");
  });

  it("clamps stored values into allowed ranges", () => {
    assert.deepEqual(normalizeManpowerTargets(99, -1), {
      dayShiftTarget: 10,
      nightShiftTarget: 1,
    });
  });

  it("merges built-in and custom presets without duplicates", () => {
    const merged = mergeManpowerPresets([
      {
        id: "L4-N2",
        dayShiftTarget: 4,
        nightShiftTarget: 2,
        label: "L4 - N2",
      },
      {
        id: "L3-N3",
        dayShiftTarget: 3,
        nightShiftTarget: 3,
        label: "Duplicate built-in",
      },
    ]);
    assert.equal(merged.length, 4);
    assert.ok(merged.some((p) => p.id === "L4-N2"));
  });
});
