import ExcelJS from "exceljs";
import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import { getMonthDateKeys } from "@/lib/scheduling/dates";
import { displayShiftCode } from "@/lib/utils";
import type { ShiftCode } from "@/lib/scheduling/types";

export type ExportDoctor = {
  id: string;
  name: string;
  seniority: string;
  targetHours: number;
};

export type ExportAssignment = {
  doctorId: string;
  dateKey: string;
  shiftCode: ShiftCode;
  source: "MANUAL" | "AUTO";
};

export async function buildScheduleWorkbook(params: {
  year: number;
  month: number;
  doctors: ExportDoctor[];
  assignments: ExportAssignment[];
}): Promise<ExcelJS.Buffer> {
  const { year, month, doctors, assignments } = params;
  const monthKeys = getMonthDateKeys(year, month);
  const byCell = new Map<string, ExportAssignment>();
  for (const a of assignments) {
    byCell.set(`${a.doctorId}__${a.dateKey}`, a);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "sign-doc";
  const sheet = workbook.addWorksheet(`Schedule ${year}-${String(month).padStart(2, "0")}`);

  const header = [
    "Doctor",
    "Seniority",
    "Hours worked",
    "Target hours",
    ...monthKeys.map((k) => k.slice(8)),
  ];
  sheet.addRow(header);
  sheet.getRow(1).font = { bold: true };

  const shiftRows = assignments.map((a) => ({
    doctorId: a.doctorId,
    date: new Date(`${a.dateKey}T00:00:00.000Z`),
    shiftCode: a.shiftCode,
    durationHours: a.shiftCode === "TWENTY_FOUR" ? 24 : 12,
  }));

  for (const doc of doctors) {
    const worked = computeMonthlyHours(doc.id, monthKeys, shiftRows);
    const row = [
      doc.name,
      doc.seniority,
      worked,
      doc.targetHours,
      ...monthKeys.map((k) => {
        const cell = byCell.get(`${doc.id}__${k}`);
        if (!cell) return "";
        const code = displayShiftCode(cell.shiftCode);
        return cell.source === "MANUAL" ? `${code}*` : code;
      }),
    ];
    sheet.addRow(row);
  }

  sheet.columns.forEach((col, i) => {
    col.width = i < 4 ? 16 : 6;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ExcelJS.Buffer;
}
