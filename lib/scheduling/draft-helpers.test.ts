import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeReconcileIntoDraft } from "@/lib/scheduling/draft-helpers";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import type { DraftShiftRow } from "@/lib/scheduling/draft-helpers";

const shiftTypes = [
  { id: "l1", code: "L", label: "Long Day", color: "#0284c7" },
  { id: "off1", code: "OFF", label: "Off", color: "#94a3b8" },
];

describe("mergeReconcileIntoDraft", () => {
  it("keeps MANUAL OFF and drops auto proposals on the same doctor-day", () => {
    const draft: DraftShiftRow[] = [
      {
        doctorId: "d1",
        date: "2026-05-01",
        shiftTypeId: "off1",
        code: "OFF",
        color: "#94a3b8",
        label: "Off",
        source: "MANUAL",
      },
    ];
    const proposals: AutoAssignProposal[] = [
      {
        doctorId: "d1",
        date: "2026-05-01",
        shiftCode: "L",
        shiftTypeId: "l1",
        durationHours: 12,
      },
      {
        doctorId: "d2",
        date: "2026-05-01",
        shiftCode: "L",
        shiftTypeId: "l1",
        durationHours: 12,
      },
    ];

    const merged = mergeReconcileIntoDraft(draft, proposals, shiftTypes);
    assert.equal(merged.length, 2);
    assert.equal(
      merged.filter((r) => r.doctorId === "d1" && r.date === "2026-05-01").length,
      1,
    );
    assert.equal(
      merged.find((r) => r.doctorId === "d1" && r.date === "2026-05-01")?.code,
      "OFF",
    );
    assert.equal(
      merged.find((r) => r.doctorId === "d2")?.code,
      "L",
    );
  });
});
