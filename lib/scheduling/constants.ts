/** Minimum Long Day (L) doctors per day. */
export const MIN_DAY_SHIFT_TARGET = 1;
/** Maximum Long Day (L) doctors per day. */
export const MAX_DAY_SHIFT_TARGET = 10;
/** Minimum Night (N) doctors per day. */
export const MIN_NIGHT_SHIFT_TARGET = 1;
/** Maximum Night (N) doctors per day. */
export const MAX_NIGHT_SHIFT_TARGET = 10;

/** Built-in manpower ratios (always available). Admins can add more in Settings. */
export const BUILTIN_MANPOWER_PRESETS = [
  {
    id: "L3-N3",
    dayShiftTarget: 3,
    nightShiftTarget: 3,
    label: "L3 - N3",
    builtIn: true as const,
  },
  {
    id: "L3-N2",
    dayShiftTarget: 3,
    nightShiftTarget: 2,
    label: "L3 - N2",
    builtIn: true as const,
  },
  {
    id: "L4-N3",
    dayShiftTarget: 4,
    nightShiftTarget: 3,
    label: "L4 - N3",
    builtIn: true as const,
  },
] as const;

/** @deprecated Use BUILTIN_MANPOWER_PRESETS */
export const MANPOWER_PRESETS = BUILTIN_MANPOWER_PRESETS;

export type BuiltinManpowerPresetId =
  (typeof BUILTIN_MANPOWER_PRESETS)[number]["id"];

export type ManpowerRatioOption = {
  id: string;
  dayShiftTarget: number;
  nightShiftTarget: number;
  label: string;
  builtIn?: boolean;
  dbId?: string;
};

export type ManpowerTargets = {
  dayShiftTarget: number;
  nightShiftTarget: number;
};

export function formatManpowerRatio(
  dayShiftTarget: number,
  nightShiftTarget: number,
): string {
  return `L${dayShiftTarget} - N${nightShiftTarget}`;
}

export function ratioPresetId(dayShiftTarget: number, nightShiftTarget: number) {
  return `L${dayShiftTarget}-N${nightShiftTarget}`;
}

export function parseRatioPresetId(id: string): ManpowerTargets | null {
  const match = /^L(\d+)-N(\d+)$/.exec(id);
  if (!match) return null;
  return {
    dayShiftTarget: Number(match[1]),
    nightShiftTarget: Number(match[2]),
  };
}

export function clampManpowerTarget(
  value: number,
  band: "day" | "night",
): number {
  const min =
    band === "day" ? MIN_DAY_SHIFT_TARGET : MIN_NIGHT_SHIFT_TARGET;
  const max =
    band === "day" ? MAX_DAY_SHIFT_TARGET : MAX_NIGHT_SHIFT_TARGET;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function isValidDayTarget(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_DAY_SHIFT_TARGET &&
    value <= MAX_DAY_SHIFT_TARGET
  );
}

export function isValidNightTarget(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_NIGHT_SHIFT_TARGET &&
    value <= MAX_NIGHT_SHIFT_TARGET
  );
}

export function isValidManpowerRatio(
  dayShiftTarget: number,
  nightShiftTarget: number,
): boolean {
  return isValidDayTarget(dayShiftTarget) && isValidNightTarget(nightShiftTarget);
}

export function targetsToPresetId(
  dayShiftTarget: number,
  nightShiftTarget: number,
): string | null {
  if (!isValidManpowerRatio(dayShiftTarget, nightShiftTarget)) return null;
  return ratioPresetId(dayShiftTarget, nightShiftTarget);
}

export function presetIdToTargets(id: string): ManpowerTargets {
  const parsed = parseRatioPresetId(id);
  if (parsed && isValidManpowerRatio(parsed.dayShiftTarget, parsed.nightShiftTarget)) {
    return parsed;
  }
  return { dayShiftTarget: 4, nightShiftTarget: 3 };
}

/** Clamp stored targets into allowed L/N ranges. */
export function normalizeManpowerTargets(
  dayShiftTarget: number,
  nightShiftTarget: number,
): ManpowerTargets {
  return {
    dayShiftTarget: clampManpowerTarget(dayShiftTarget, "day"),
    nightShiftTarget: clampManpowerTarget(nightShiftTarget, "night"),
  };
}

export function validateCoverageTargetValues(
  dayShiftTarget: number,
  nightShiftTarget: number,
): string | null {
  if (!isValidDayTarget(dayShiftTarget)) {
    return `Long day count must be ${MIN_DAY_SHIFT_TARGET}–${MAX_DAY_SHIFT_TARGET}.`;
  }
  if (!isValidNightTarget(nightShiftTarget)) {
    return `Night count must be ${MIN_NIGHT_SHIFT_TARGET}–${MAX_NIGHT_SHIFT_TARGET}.`;
  }
  return null;
}

export function mergeManpowerPresets(
  custom: ManpowerRatioOption[],
): ManpowerRatioOption[] {
  const seen = new Set<string>();
  const merged: ManpowerRatioOption[] = [];

  for (const preset of [...BUILTIN_MANPOWER_PRESETS, ...custom]) {
    const key = `${preset.dayShiftTarget}-${preset.nightShiftTarget}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      id: preset.id,
      dayShiftTarget: preset.dayShiftTarget,
      nightShiftTarget: preset.nightShiftTarget,
      label: preset.label,
      builtIn: preset.builtIn,
      dbId: "dbId" in preset ? preset.dbId : undefined,
    });
  }

  return merged.sort(
    (a, b) =>
      a.dayShiftTarget - b.dayShiftTarget ||
      a.nightShiftTarget - b.nightShiftTarget,
  );
}

export function findManpowerPreset(
  presets: ManpowerRatioOption[],
  dayShiftTarget: number,
  nightShiftTarget: number,
): ManpowerRatioOption | undefined {
  return presets.find(
    (p) =>
      p.dayShiftTarget === dayShiftTarget &&
      p.nightShiftTarget === nightShiftTarget,
  );
}
