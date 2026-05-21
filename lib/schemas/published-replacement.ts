import { z } from "zod";

export const publishedReplacementQuerySchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromDoctorId: z.string().min(1),
});

export const reassignPublishedShiftSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromDoctorId: z.string().min(1),
  toDoctorId: z.string().min(1),
  mode: z.enum(["replace", "swap"]),
});

export const clearPublishedShiftSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doctorId: z.string().min(1),
});
