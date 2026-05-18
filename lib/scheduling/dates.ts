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

export function defaultTargetHours(type: "FT" | "HALF_TIME" | "PT"): number {
  if (type === "FT") return 240;
  if (type === "HALF_TIME") return 120;
  return 120;
}
