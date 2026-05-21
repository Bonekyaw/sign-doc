import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import { AutoScheduler } from "@/lib/scheduling/auto-scheduler";
import { rulesForMainFlow } from "@/lib/scheduling/main-flow-rules";
import { hasNightBeforeTwentyFour } from "@/lib/scheduling/validate-main-flow";
import type { DoctorInfo, ShiftTypeInfo } from "@/lib/scheduling/types";

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
  {
    id: "h24",
    code: "TWENTY_FOUR",
    label: "24 Hours",
    durationHours: 24,
    color: "#000",
    isActive: true,
  },
];

const doctors: DoctorInfo[] = [
  {
    id: "senior-1",
    name: "Senior One",
    targetHours: 240,
    seniority: "SENIOR",
    restrictions: [],
  },
  {
    id: "junior-1",
    name: "Junior One",
    targetHours: 240,
    seniority: "JUNIOR",
    restrictions: [],
  },
];

describe("AutoScheduler", () => {
  it("fills day/night bands and never assigns Night followed by 24h", () => {
    const monthKeys = ["2026-05-01", "2026-05-02", "2026-05-03"];
    const scheduler = new AutoScheduler({
      doctors,
      shiftTypes,
      monthKeys,
      existingShifts: [],
      getCoverageForDateKey: () => ({
        dayShiftTarget: 1,
        nightShiftTarget: 1,
      }),
      rules: rulesForMainFlow(),
    });

    const { proposals } = scheduler.generateSchedule(false);
    assert.ok(proposals.length > 0);

    const shifts = proposals.map((p) => ({
      doctorId: p.doctorId,
      date: parseDateKey(p.date),
      shiftCode: p.shiftCode,
      durationHours: p.durationHours,
    }));
    assert.equal(hasNightBeforeTwentyFour(shifts), false);

    for (const key of monthKeys) {
      const date = parseDateKey(key);
      const day = shifts.filter(
        (s) => s.shiftCode === "L" && dateKey(s.date) === key,
      );
      const night = shifts.filter(
        (s) => s.shiftCode === "N" && dateKey(s.date) === key,
      );
      if (day.length > 0) {
        assert.ok(
          day.some((s) => s.doctorId === "senior-1"),
          `${key} day band needs a senior`,
        );
      }
      if (night.length > 0) {
        assert.ok(
          night.some((s) => s.doctorId === "senior-1"),
          `${key} night band needs a senior`,
        );
      }
    }
  });

  it("does not replace manual anchors", () => {
    const scheduler = new AutoScheduler({
      doctors,
      shiftTypes,
      monthKeys: ["2026-05-01"],
      existingShifts: [
        {
          doctorId: "junior-1",
          date: parseDateKey("2026-05-01"),
          shiftCode: "L",
          durationHours: 12,
        },
      ],
      getCoverageForDateKey: () => ({
        dayShiftTarget: 2,
        nightShiftTarget: 0,
      }),
      rules: rulesForMainFlow(),
    });

    const { proposals } = scheduler.generateSchedule(false);
    assert.ok(
      !proposals.some(
        (p) => p.date === "2026-05-01" && p.doctorId === "junior-1",
      ),
    );
  });
});
