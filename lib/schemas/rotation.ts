import { z } from "zod";

export const rotationStepSchema = z.object({
  stepType: z.enum(["L", "N", "TWENTY_FOUR", "OFF"]),
});

export const rotationTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  steps: z
    .array(rotationStepSchema)
    .min(1, "At least one step is required")
    .max(14),
});

export type RotationTemplateInput = z.infer<typeof rotationTemplateSchema>;
