import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import { dateKey, parseDateKey } from "@/lib/scheduling/dates";
import type { DraftShiftInput } from "@/lib/schemas/schedule-draft";
import type { ShiftCode } from "@/lib/scheduling/types";

function normalizeDateStr(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return dateKey(parseDateKey(value.slice(0, 10)));
}

export type DraftShiftRow = {
  doctorId: string;
  date: string;
  shiftTypeId: string;
  code: string;
  color: string;
  label: string;
  source?: "MANUAL" | "AUTO";
};

type ShiftTypeLike = {
  id: string;
  code: string;
  label: string;
  color: string;
};

export function draftRowsToInput(rows: DraftShiftRow[]): DraftShiftInput[] {
  return rows.map((row) => ({
    doctorId: row.doctorId,
    dateStr: row.date,
    shiftTypeId: row.shiftTypeId,
    source: row.source ?? "MANUAL",
  }));
}

export function proposalToDraftRow(
  proposal: AutoAssignProposal,
  shiftTypes: ShiftTypeLike[],
): DraftShiftRow {
  const type = shiftTypes.find((t) => t.id === proposal.shiftTypeId);
  return {
    doctorId: proposal.doctorId,
    date: normalizeDateStr(proposal.date),
    shiftTypeId: proposal.shiftTypeId,
    code: proposal.shiftCode,
    color: type?.color ?? "#64748b",
    label: type?.label ?? proposal.shiftCode,
    source: "AUTO",
  };
}

export function upsertManualDraftRow(
  rows: DraftShiftRow[],
  doctorId: string,
  dateStr: string,
  shiftType: ShiftTypeLike & { durationHours?: number },
): DraftShiftRow[] {
  const without = rows.filter(
    (r) => !(r.doctorId === doctorId && r.date === dateStr),
  );
  return [
    ...without,
    {
      doctorId,
      date: dateStr,
      shiftTypeId: shiftType.id,
      code: shiftType.code,
      color: shiftType.color,
      label: shiftType.label,
      source: "MANUAL",
    },
  ];
}

export function removeDraftRow(
  rows: DraftShiftRow[],
  doctorId: string,
  dateStr: string,
): DraftShiftRow[] {
  return rows.filter(
    (r) => !(r.doctorId === doctorId && r.date === dateStr),
  );
}

export function mergeReconcileIntoDraft(
  draft: DraftShiftRow[],
  proposals: AutoAssignProposal[],
  shiftTypes: ShiftTypeLike[],
): DraftShiftRow[] {
  const manual = draft.filter((r) => r.source === "MANUAL");
  const autoRows = proposals.map((p) => proposalToDraftRow(p, shiftTypes));
  return [...manual, ...autoRows];
}

export function manualDraftInputs(draft: DraftShiftRow[]): DraftShiftInput[] {
  return draftRowsToInput(draft.filter((r) => r.source === "MANUAL"));
}

export function proposalsToDraftRows(
  proposals: AutoAssignProposal[],
  shiftTypes: ShiftTypeLike[],
): DraftShiftRow[] {
  return proposals.map((p) => proposalToDraftRow(p, shiftTypes));
}
