export type SchedulingRulesConfig = {
  post24MinRestDays: number;
  blockNightBefore24: boolean;
  blockLongDayBefore24: boolean;
  maxConsecutiveLongDay: number;
  maxConsecutiveNight: number;
  maxConsecutiveOffDays: number;
  minDaysOffPerMonth: number;
  requireSeniorOnDayBand: boolean;
  requireSeniorOnNightBand: boolean;
  ftDefaultTargetHours: number;
  halfTimeDefaultTargetHours: number;
  ptDefaultTargetHours: number;
};

export const SCHEDULING_RULES_ID = "default" as const;

export const DEFAULT_SCHEDULING_RULES: SchedulingRulesConfig = {
  post24MinRestDays: 1,
  blockNightBefore24: true,
  blockLongDayBefore24: false,
  maxConsecutiveLongDay: 3,
  maxConsecutiveNight: 3,
  maxConsecutiveOffDays: 3,
  minDaysOffPerMonth: 4,
  requireSeniorOnDayBand: true,
  requireSeniorOnNightBand: true,
  ftDefaultTargetHours: 240,
  halfTimeDefaultTargetHours: 120,
  ptDefaultTargetHours: 80,
};

export function mapSchedulingRulesRow(row: {
  post24MinRestDays: number;
  blockNightBefore24: boolean;
  blockLongDayBefore24: boolean;
  maxConsecutiveLongDay: number;
  maxConsecutiveNight: number;
  maxConsecutiveOffDays: number;
  minDaysOffPerMonth: number;
  requireSeniorOnDayBand: boolean;
  requireSeniorOnNightBand: boolean;
  ftDefaultTargetHours: number;
  halfTimeDefaultTargetHours: number;
  ptDefaultTargetHours: number;
}): SchedulingRulesConfig {
  return {
    post24MinRestDays: row.post24MinRestDays,
    blockNightBefore24: row.blockNightBefore24,
    blockLongDayBefore24: row.blockLongDayBefore24,
    maxConsecutiveLongDay: row.maxConsecutiveLongDay,
    maxConsecutiveNight: row.maxConsecutiveNight,
    maxConsecutiveOffDays: row.maxConsecutiveOffDays,
    minDaysOffPerMonth: row.minDaysOffPerMonth,
    requireSeniorOnDayBand: row.requireSeniorOnDayBand,
    requireSeniorOnNightBand: row.requireSeniorOnNightBand,
    ftDefaultTargetHours: row.ftDefaultTargetHours,
    halfTimeDefaultTargetHours: row.halfTimeDefaultTargetHours,
    ptDefaultTargetHours:
      row.ptDefaultTargetHours ?? DEFAULT_SCHEDULING_RULES.ptDefaultTargetHours,
  };
}
