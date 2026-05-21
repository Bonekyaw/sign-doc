import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";

/**
 * Scheduling rules from `.cursor/rules/main-flow.mdc` (always applied to scheduling).
 *
 * - Senior on Day (L) and Night (N) when a band is staffed
 * - After 24h: at least 1 day off (admin may configure 2)
 * - Long Day may be followed by 24h; Night may not
 * - At most 2 consecutive L or N (cannot work 3 in a row)
 * - At most 3 consecutive off days (not 4)
 * - Full-time target 240h / half-time 120h (per-doctor targets from profile)
 */
export const MAIN_FLOW_SCHEDULING_RULES: SchedulingRulesConfig = {
  post24MinRestDays: 1,
  blockNightBefore24: true,
  blockLongDayBefore24: false,
  maxConsecutiveLongDay: 2,
  maxConsecutiveNight: 2,
  maxConsecutiveOffDays: 3,
  minDaysOffPerMonth: 4,
  requireSeniorOnDayBand: true,
  requireSeniorOnNightBand: true,
  ftDefaultTargetHours: 240,
  halfTimeDefaultTargetHours: 120,
  ptDefaultTargetHours: 80,
};

/** Rules used by auto-assign / reconcile — never weaker than main-flow. */
export function rulesForAutoAssign(
  stored: SchedulingRulesConfig = DEFAULT_SCHEDULING_RULES,
): SchedulingRulesConfig {
  const post24 = Math.min(
    2,
    Math.max(1, stored.post24MinRestDays),
  );

  return {
    ...stored,
    post24MinRestDays: post24,
    blockNightBefore24: true,
    blockLongDayBefore24: false,
    maxConsecutiveLongDay: Math.min(stored.maxConsecutiveLongDay, 2),
    maxConsecutiveNight: Math.min(stored.maxConsecutiveNight, 2),
    maxConsecutiveOffDays: Math.min(stored.maxConsecutiveOffDays, 3),
    minDaysOffPerMonth: Math.max(stored.minDaysOffPerMonth, 4),
    requireSeniorOnDayBand: true,
    requireSeniorOnNightBand: true,
    ftDefaultTargetHours: MAIN_FLOW_SCHEDULING_RULES.ftDefaultTargetHours,
    halfTimeDefaultTargetHours:
      MAIN_FLOW_SCHEDULING_RULES.halfTimeDefaultTargetHours,
    ptDefaultTargetHours: stored.ptDefaultTargetHours,
  };
}

/** Main-flow rules for all scheduling validation (auto-assign, manual, save, publish). */
export const rulesForMainFlow = rulesForAutoAssign;
