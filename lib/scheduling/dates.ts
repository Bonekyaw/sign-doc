export function toUtcDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function dateKey(date: Date): string {
  return toUtcDate(date).toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const result = toUtcDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function getMonthDateKeys(year: number, month: number): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  while (cursor.getUTCMonth() === month - 1) {
    keys.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";

export function defaultTargetHours(
  type: "FT" | "HALF_TIME" | "PT",
  rules: Pick<
    SchedulingRulesConfig,
    | "ftDefaultTargetHours"
    | "halfTimeDefaultTargetHours"
    | "ptDefaultTargetHours"
  > = DEFAULT_SCHEDULING_RULES,
): number {
  if (type === "FT") return rules.ftDefaultTargetHours;
  if (type === "HALF_TIME") return rules.halfTimeDefaultTargetHours;
  return rules.ptDefaultTargetHours;
}
