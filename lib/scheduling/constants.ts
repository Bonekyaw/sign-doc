/** Allowed Long Day (L) doctor counts per day. */
export const ALLOWED_DAY_TARGETS = [3, 4] as const;
/** Allowed Night (N) doctor counts per day. */
export const ALLOWED_NIGHT_TARGETS = [2, 3] as const;

export type DayShiftTarget = (typeof ALLOWED_DAY_TARGETS)[number];
export type NightShiftTarget = (typeof ALLOWED_NIGHT_TARGETS)[number];

/** Valid day/night manpower ratios: L3-N3, L3-N2, or L4-N3. */
export const MANPOWER_PRESETS = [
  {
    id: "L3-N3",
    dayShiftTarget: 3,
    nightShiftTarget: 3,
    label: "L3 - N3",
  },
  {
    id: "L3-N2",
    dayShiftTarget: 3,
    nightShiftTarget: 2,
    label: "L3 - N2",
  },
  {
    id: "L4-N3",
    dayShiftTarget: 4,
    nightShiftTarget: 3,
    label: "L4 - N3",
  },
] as const;

export type ManpowerPresetId = (typeof MANPOWER_PRESETS)[number]["id"];

export type ManpowerTargets = {
  dayShiftTarget: DayShiftTarget;
  nightShiftTarget: NightShiftTarget;
};

export function formatManpowerRatio(
  dayShiftTarget: number,
  nightShiftTarget: number,
): string {
  return `L${dayShiftTarget} - N${nightShiftTarget}`;
}

export function isValidDayTarget(value: number): value is DayShiftTarget {
  return (ALLOWED_DAY_TARGETS as readonly number[]).includes(value);
}

export function isValidNightTarget(value: number): value is NightShiftTarget {
  return (ALLOWED_NIGHT_TARGETS as readonly number[]).includes(value);
}

export function isValidManpowerRatio(
  dayShiftTarget: number,
  nightShiftTarget: number,
): boolean {
  return MANPOWER_PRESETS.some(
    (p) =>
      p.dayShiftTarget === dayShiftTarget &&
      p.nightShiftTarget === nightShiftTarget,
  );
}

export function targetsToPresetId(
  dayShiftTarget: number,
  nightShiftTarget: number,
): ManpowerPresetId | null {
  const preset = MANPOWER_PRESETS.find(
    (p) =>
      p.dayShiftTarget === dayShiftTarget &&
      p.nightShiftTarget === nightShiftTarget,
  );
  return preset?.id ?? null;
}

export function presetIdToTargets(id: ManpowerPresetId): ManpowerTargets {
  const preset = MANPOWER_PRESETS.find((p) => p.id === id);
  if (!preset) {
    return { dayShiftTarget: 4, nightShiftTarget: 3 };
  }
  return {
    dayShiftTarget: preset.dayShiftTarget,
    nightShiftTarget: preset.nightShiftTarget,
  };
}

/** Map stored targets to a valid preset (defaults to L4-N3). */
export function normalizeManpowerTargets(
  dayShiftTarget: number,
  nightShiftTarget: number,
): ManpowerTargets {
  const id = targetsToPresetId(dayShiftTarget, nightShiftTarget);
  return id ? presetIdToTargets(id) : presetIdToTargets("L4-N3");
}

export function validateCoverageTargetValues(
  dayShiftTarget: number,
  nightShiftTarget: number,
): string | null {
  if (!isValidManpowerRatio(dayShiftTarget, nightShiftTarget)) {
    return `Manpower must be one of: ${MANPOWER_PRESETS.map((p) => p.label).join(", ")}.`;
  }
  return null;
}
