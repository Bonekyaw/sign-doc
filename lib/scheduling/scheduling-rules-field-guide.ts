export type SchedulingRuleFieldEffect =
  | "effective"
  | "ignored"
  | "warning-only";

export type SchedulingRuleFieldGuideEntry = {
  field: string;
  label: string;
  effect: SchedulingRuleFieldEffect;
  note: string;
};

/** How each Settings → Scheduling rules field affects the app today. */
export const SCHEDULING_RULE_FIELD_GUIDE: SchedulingRuleFieldGuideEntry[] = [
  {
    field: "post24MinRestDays",
    label: "Rest days after 24h shift",
    effect: "effective",
    note: "Blocks assignments and save/publish. Values above 2 are treated as 2.",
  },
  {
    field: "maxConsecutiveLongDay",
    label: "Max consecutive Long Day",
    effect: "effective",
    note: "Enforced on assign, save, and publish. Cannot exceed 2 (main-flow cap). Lower values tighten the rule.",
  },
  {
    field: "maxConsecutiveNight",
    label: "Max consecutive Night",
    effect: "effective",
    note: "Enforced on assign, save, and publish. Cannot exceed 2 (main-flow cap). Lower values tighten the rule.",
  },
  {
    field: "blockNightBefore24",
    label: "Block Night → 24h",
    effect: "ignored",
    note: "Always enforced by main-flow policy. Turning this off has no effect on scheduling.",
  },
  {
    field: "blockLongDayBefore24",
    label: "Block Long Day → 24h",
    effect: "ignored",
    note: "Main-flow always allows Long Day → 24h. Enabling this toggle has no effect on scheduling.",
  },
  {
    field: "maxConsecutiveOffDays",
    label: "Max consecutive off days",
    effect: "effective",
    note: "Enforced on assign, save, and publish. Cannot exceed 3 (main-flow cap). Lower values tighten the rule.",
  },
  {
    field: "minDaysOffPerMonth",
    label: "Min off days per month",
    effect: "warning-only",
    note: "Shows a warning during grid edits only. Does not block save or publish. Values below 4 are treated as 4.",
  },
  {
    field: "requireSeniorOnDayBand",
    label: "Require Senior on day shift (L)",
    effect: "ignored",
    note: "Always required by main-flow when the day band is staffed. Disabling has no effect.",
  },
  {
    field: "requireSeniorOnNightBand",
    label: "Require Senior on night shift (N)",
    effect: "ignored",
    note: "Always required by main-flow when the night band is staffed. Disabling has no effect.",
  },
  {
    field: "ftDefaultTargetHours",
    label: "Full-time monthly hours",
    effect: "effective",
    note: "Prefills monthly hours when creating a full-time doctor. Save/publish still uses each doctor’s profile target (240h for FT).",
  },
  {
    field: "halfTimeDefaultTargetHours",
    label: "Half-time monthly hours",
    effect: "effective",
    note: "Prefills monthly hours when creating a half-time doctor. Save/publish uses each doctor’s profile target (120h for half-time).",
  },
  {
    field: "ptDefaultTargetHours",
    label: "Part-time default hours",
    effect: "effective",
    note: "Prefills monthly hours when creating a part-time doctor. Save/publish uses each doctor’s stored target.",
  },
];

export const SCHEDULING_RULE_EFFECT_LABELS: Record<
  SchedulingRuleFieldEffect,
  { label: string; description: string }
> = {
  effective: {
    label: "Effective",
    description: "Applied when assigning shifts and enforced on save/publish (or doctor form defaults).",
  },
  "warning-only": {
    label: "Warning only",
    description: "Shown during grid edits. Save and publish are still allowed.",
  },
  ignored: {
    label: "Ignored",
    description: "Saved to settings but overridden by main-flow hospital policy.",
  },
};

export function guideEntryForField(
  field: string,
): SchedulingRuleFieldGuideEntry | undefined {
  return SCHEDULING_RULE_FIELD_GUIDE.find((entry) => entry.field === field);
}
