import { z } from "zod";

export const doctorSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(120),
    type: z.enum(["FT", "HALF_TIME", "PT"]),
    seniority: z.enum(["SENIOR", "MID_LEVEL", "JUNIOR"]),
    monthlyHourLimit: z.number().int().min(1).max(300),
    girlsOff24h: z.boolean(),
    rotationTemplateId: z.string().optional().nullable(),
    rotationStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
  })
  .refine(
    (data) =>
      !data.rotationTemplateId ||
      (data.rotationStartDate && data.rotationStartDate.length > 0),
    {
      message: "Rotation start date is required when a template is selected.",
      path: ["rotationStartDate"],
    },
  );

export type DoctorFormInput = z.infer<typeof doctorSchema>;
