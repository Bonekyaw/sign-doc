import { z } from "zod";

export const schedulingRulesSchema = z.object({
  post24MinRestDays: z.number().int().min(1).max(3),
  blockNightBefore24: z.boolean(),
  blockLongDayBefore24: z.boolean(),
  maxConsecutiveLongDay: z.number().int().min(1).max(7),
  maxConsecutiveNight: z.number().int().min(1).max(7),
  maxConsecutiveOffDays: z.number().int().min(1).max(7),
  minDaysOffPerMonth: z.number().int().min(0).max(15),
  requireSeniorOnDayBand: z.boolean(),
  requireSeniorOnNightBand: z.boolean(),
  ftDefaultTargetHours: z.number().int().min(1).max(400),
  halfTimeDefaultTargetHours: z.number().int().min(1).max(400),
  ptDefaultTargetHours: z.number().int().min(1).max(400),
});

export type SchedulingRulesInput = z.infer<typeof schedulingRulesSchema>;
