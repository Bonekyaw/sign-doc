import { z } from "zod";
import {
  MAX_DAY_SHIFT_TARGET,
  MAX_NIGHT_SHIFT_TARGET,
  MIN_DAY_SHIFT_TARGET,
  MIN_NIGHT_SHIFT_TARGET,
} from "@/lib/scheduling/constants";

export const manpowerRatioInputSchema = z.object({
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
  label: z.string().trim().max(40).optional(),
});

export type ManpowerRatioInput = z.infer<typeof manpowerRatioInputSchema>;
