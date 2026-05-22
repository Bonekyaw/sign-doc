import { z } from "zod";
import {
  isValidManpowerRatio,
  MAX_DAY_SHIFT_TARGET,
  MAX_NIGHT_SHIFT_TARGET,
  MIN_DAY_SHIFT_TARGET,
  MIN_NIGHT_SHIFT_TARGET,
} from "@/lib/scheduling/constants";

export const coverageTargetSchema = z
  .object({
    dayShiftTarget: z
      .number()
      .int()
      .min(MIN_DAY_SHIFT_TARGET)
      .max(MAX_DAY_SHIFT_TARGET),
    nightShiftTarget: z
      .number()
      .int()
      .min(MIN_NIGHT_SHIFT_TARGET)
      .max(MAX_NIGHT_SHIFT_TARGET),
  })
  .refine((v) => isValidManpowerRatio(v.dayShiftTarget, v.nightShiftTarget), {
    message: `Long day must be ${MIN_DAY_SHIFT_TARGET}–${MAX_DAY_SHIFT_TARGET} and Night must be ${MIN_NIGHT_SHIFT_TARGET}–${MAX_NIGHT_SHIFT_TARGET}.`,
  });

export const monthCoverageSchema = coverageTargetSchema.extend({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const dailyCoverageSchema = coverageTargetSchema.extend({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CoverageTargetInput = z.infer<typeof coverageTargetSchema>;
