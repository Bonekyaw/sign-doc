"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { updateSchedulingRules } from "@/app/actions/scheduling-rules";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import {
  schedulingRulesSchema,
  type SchedulingRulesInput,
} from "@/lib/schemas/scheduling-rules";
import {
  guideEntryForField,
  SCHEDULING_RULE_EFFECT_LABELS,
  SCHEDULING_RULE_FIELD_GUIDE,
  type SchedulingRuleFieldEffect,
} from "@/lib/scheduling/scheduling-rules-field-guide";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  rules: SchedulingRulesConfig;
  updatedAt?: Date | string | null;
  canWrite?: boolean;
};

const EFFECT_BADGE_CLASS: Record<SchedulingRuleFieldEffect, string> = {
  effective: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "warning-only": "border-amber-200 bg-amber-50 text-amber-900",
  ignored: "border-slate-200 bg-slate-100 text-slate-600",
};

function RuleFieldEffectBadge({ field }: { field: string }) {
  const entry = guideEntryForField(field);
  if (!entry) return null;

  return (
    <Badge
      className={cn(
        "ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide",
        EFFECT_BADGE_CLASS[entry.effect],
      )}
    >
      {SCHEDULING_RULE_EFFECT_LABELS[entry.effect].label}
    </Badge>
  );
}

function RuleFieldHelp({ field }: { field: string }) {
  const entry = guideEntryForField(field);
  if (!entry) return null;

  return (
    <p className="mt-1 text-xs text-slate-500">{entry.note}</p>
  );
}

function CheckboxField({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <div>
        <Label htmlFor={id} className="font-medium text-slate-900">
          {label}
          <RuleFieldEffectBadge field={id} />
        </Label>
        <p className="text-sm text-slate-600">{description}</p>
        <RuleFieldHelp field={id} />
      </div>
    </div>
  );
}

export function SchedulingRulesEditor({
  rules,
  updatedAt,
  canWrite = true,
}: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<SchedulingRulesInput>({
    resolver: zodResolver(schedulingRulesSchema),
    defaultValues: rules,
  });

  async function onSubmit(data: SchedulingRulesInput) {
    setSubmitError(null);
    setSaved(false);
    setSaving(true);
    const result = await updateSchedulingRules(data);
    setSaving(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString()
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Scheduling rules"
        description="Hospital-wide settings. Main-flow policy caps or overrides some fields — see the checklist below."
      />

      {updatedLabel ? (
        <p className="text-sm text-slate-500">Last updated {updatedLabel}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Field effectiveness checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              Object.entries(SCHEDULING_RULE_EFFECT_LABELS) as [
                SchedulingRuleFieldEffect,
                { label: string; description: string },
              ][]
            ).map(([effect, meta]) => (
              <div
                key={effect}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  EFFECT_BADGE_CLASS[effect],
                )}
              >
                <span className="font-semibold uppercase tracking-wide">
                  {meta.label}
                </span>
                <span className="mx-1.5">—</span>
                <span>{meta.description}</span>
              </div>
            ))}
          </div>

          <ul className="divide-y divide-neutral-200/80 rounded-xl border border-neutral-200/80">
            {SCHEDULING_RULE_FIELD_GUIDE.map((entry) => (
              <li
                key={entry.field}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{entry.label}</p>
                  <p className="text-sm text-slate-600">{entry.note}</p>
                </div>
                <Badge
                  className={cn(
                    "shrink-0 self-start text-[10px] font-semibold uppercase tracking-wide",
                    EFFECT_BADGE_CLASS[entry.effect],
                  )}
                >
                  {SCHEDULING_RULE_EFFECT_LABELS[entry.effect].label}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fatigue</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="post24MinRestDays">
                Rest days after 24h shift
                <RuleFieldEffectBadge field="post24MinRestDays" />
              </Label>
              <Input
                id="post24MinRestDays"
                type="number"
                min={1}
                max={3}
                disabled={!canWrite}
                {...form.register("post24MinRestDays", { valueAsNumber: true })}
              />
              <RuleFieldHelp field="post24MinRestDays" />
            </div>
            <div>
              <Label htmlFor="maxConsecutiveLongDay">
                Max consecutive Long Day
                <RuleFieldEffectBadge field="maxConsecutiveLongDay" />
              </Label>
              <Input
                id="maxConsecutiveLongDay"
                type="number"
                min={1}
                max={7}
                disabled={!canWrite}
                {...form.register("maxConsecutiveLongDay", { valueAsNumber: true })}
              />
              <RuleFieldHelp field="maxConsecutiveLongDay" />
            </div>
            <div>
              <Label htmlFor="maxConsecutiveNight">
                Max consecutive Night
                <RuleFieldEffectBadge field="maxConsecutiveNight" />
              </Label>
              <Input
                id="maxConsecutiveNight"
                type="number"
                min={1}
                max={7}
                disabled={!canWrite}
                {...form.register("maxConsecutiveNight", { valueAsNumber: true })}
              />
              <RuleFieldHelp field="maxConsecutiveNight" />
            </div>
            <div className="sm:col-span-2 space-y-3">
              <CheckboxField
                id="blockNightBefore24"
                label="Block Night → 24h"
                description="Forbid assigning a 24-hour shift the day after a Night shift."
                checked={form.watch("blockNightBefore24")}
                onChange={(v) => form.setValue("blockNightBefore24", v)}
                disabled={!canWrite}
              />
              <CheckboxField
                id="blockLongDayBefore24"
                label="Block Long Day → 24h"
                description="When enabled, Long Day cannot be followed by a 24-hour shift the next day."
                checked={form.watch("blockLongDayBefore24")}
                onChange={(v) => form.setValue("blockLongDayBefore24", v)}
                disabled={!canWrite}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Off days</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="maxConsecutiveOffDays">
                Max consecutive off days
                <RuleFieldEffectBadge field="maxConsecutiveOffDays" />
              </Label>
              <Input
                id="maxConsecutiveOffDays"
                type="number"
                min={1}
                max={7}
                disabled={!canWrite}
                {...form.register("maxConsecutiveOffDays", { valueAsNumber: true })}
              />
              <RuleFieldHelp field="maxConsecutiveOffDays" />
            </div>
            <div>
              <Label htmlFor="minDaysOffPerMonth">
                Min off days per month
                <RuleFieldEffectBadge field="minDaysOffPerMonth" />
              </Label>
              <Input
                id="minDaysOffPerMonth"
                type="number"
                min={0}
                max={15}
                disabled={!canWrite}
                {...form.register("minDaysOffPerMonth", { valueAsNumber: true })}
              />
              <RuleFieldHelp field="minDaysOffPerMonth" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Senior coverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CheckboxField
              id="requireSeniorOnDayBand"
              label="Require Senior on day shift (L)"
              description="When the day band is staffed, at least one assigned doctor must be Senior."
              checked={form.watch("requireSeniorOnDayBand")}
              onChange={(v) => form.setValue("requireSeniorOnDayBand", v)}
              disabled={!canWrite}
            />
            <CheckboxField
              id="requireSeniorOnNightBand"
              label="Require Senior on night shift (N)"
              description="When the night band is staffed, at least one assigned doctor must be Senior."
              checked={form.watch("requireSeniorOnNightBand")}
              onChange={(v) => form.setValue("requireSeniorOnNightBand", v)}
              disabled={!canWrite}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New doctor defaults</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ftDefaultTargetHours">
                Full-time monthly hours
                <RuleFieldEffectBadge field="ftDefaultTargetHours" />
              </Label>
              <Input
                id="ftDefaultTargetHours"
                type="number"
                min={1}
                max={400}
                disabled={!canWrite}
                {...form.register("ftDefaultTargetHours", { valueAsNumber: true })}
              />
              <RuleFieldHelp field="ftDefaultTargetHours" />
            </div>
            <div>
              <Label htmlFor="halfTimeDefaultTargetHours">
                Half-time monthly hours
                <RuleFieldEffectBadge field="halfTimeDefaultTargetHours" />
              </Label>
              <Input
                id="halfTimeDefaultTargetHours"
                type="number"
                min={1}
                max={400}
                disabled={!canWrite}
                {...form.register("halfTimeDefaultTargetHours", {
                  valueAsNumber: true,
                })}
              />
              <RuleFieldHelp field="halfTimeDefaultTargetHours" />
            </div>
            <div>
              <Label htmlFor="ptDefaultTargetHours">
                Part-time default hours
                <RuleFieldEffectBadge field="ptDefaultTargetHours" />
              </Label>
              <Input
                id="ptDefaultTargetHours"
                type="number"
                min={1}
                max={400}
                disabled={!canWrite}
                {...form.register("ptDefaultTargetHours", { valueAsNumber: true })}
              />
              <RuleFieldHelp field="ptDefaultTargetHours" />
            </div>
          </CardContent>
        </Card>

        {submitError ? (
          <p className="text-sm text-red-600">{submitError}</p>
        ) : null}
        {saved ? (
          <p className="text-sm text-emerald-700">Rules saved.</p>
        ) : null}

        {canWrite ? (
          <Button type="submit" disabled={saving}>
            {saving ? "Loading…" : "Save rules"}
          </Button>
        ) : (
          <p className="text-sm text-slate-500">You have read-only access.</p>
        )}
      </form>
    </div>
  );
}
