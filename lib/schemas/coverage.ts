import { z } from "zod";
import {
  ALLOWED_DAY_TARGETS,
  ALLOWED_NIGHT_TARGETS,
} from "@/lib/scheduling/constants";

const dayTargetSchema = z.union([
  z.literal(ALLOWED_DAY_TARGETS[0]),
  z.literal(ALLOWED_DAY_TARGETS[1]),
]);

const nightTargetSchema = z.union([
  z.literal(ALLOWED_NIGHT_TARGETS[0]),
  z.literal(ALLOWED_NIGHT_TARGETS[1]),
]);

export const coverageTargetSchema = z.object({
  dayShiftTarget: dayTargetSchema,
  nightShiftTarget: nightTargetSchema,
});

export const monthCoverageSchema = coverageTargetSchema.extend({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const dailyCoverageSchema = coverageTargetSchema.extend({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CoverageTargetInput = z.infer<typeof coverageTargetSchema>;
