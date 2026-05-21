import { z } from "zod";

export const draftShiftSchema = z.object({
  doctorId: z.string().min(1),
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftTypeId: z.string().min(1),
  source: z.enum(["MANUAL", "AUTO"]),
});

export const saveScheduleMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  shifts: z.array(draftShiftSchema),
});

export type DraftShiftInput = z.infer<typeof draftShiftSchema>;
