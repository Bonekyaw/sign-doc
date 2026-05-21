import { z } from "zod";
import {
  isValidManpowerRatio,
  MANPOWER_PRESETS,
} from "@/lib/scheduling/constants";

const manpowerPresetIdSchema = z.enum([
  MANPOWER_PRESETS[0].id,
  MANPOWER_PRESETS[1].id,
  MANPOWER_PRESETS[2].id,
]);

export const coverageTargetSchema = z
  .object({
    dayShiftTarget: z.number().int(),
    nightShiftTarget: z.number().int(),
  })
  .refine(
    (v) => isValidManpowerRatio(v.dayShiftTarget, v.nightShiftTarget),
    {
      message: `Manpower must be one of: ${MANPOWER_PRESETS.map((p) => p.label).join(", ")}.`,
    },
  );

export const manpowerPresetSchema = z.object({
  presetId: manpowerPresetIdSchema,
});

export const monthCoverageSchema = coverageTargetSchema.extend({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const dailyCoverageSchema = coverageTargetSchema.extend({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CoverageTargetInput = z.infer<typeof coverageTargetSchema>;
export type ManpowerPresetInput = z.infer<typeof manpowerPresetSchema>;
