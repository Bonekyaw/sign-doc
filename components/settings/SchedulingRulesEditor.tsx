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
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  rules: SchedulingRulesConfig;
  updatedAt?: Date | string | null;
  canWrite?: boolean;
};

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
        </Label>
        <p className="text-sm text-slate-600">{description}</p>
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
        description="Hospital-wide constraints applied when assigning shifts. Changes affect validation and auto-assign immediately."
      />

      {updatedLabel ? (
        <p className="text-sm text-slate-500">Last updated {updatedLabel}</p>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fatigue</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="post24MinRestDays">Rest days after 24h shift</Label>
              <Input
                id="post24MinRestDays"
                type="number"
                min={1}
                max={3}
                disabled={!canWrite}
                {...form.register("post24MinRestDays", { valueAsNumber: true })}
              />
              <p className="mt-1 text-xs text-slate-500">
                Minimum calendar days off after a 24-hour duty (1–3).
              </p>
            </div>
            <div>
              <Label htmlFor="maxConsecutiveLongDay">Max consecutive Long Day</Label>
              <Input
                id="maxConsecutiveLongDay"
                type="number"
                min={1}
                max={7}
                disabled={!canWrite}
                {...form.register("maxConsecutiveLongDay", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="maxConsecutiveNight">Max consecutive Night</Label>
              <Input
                id="maxConsecutiveNight"
                type="number"
                min={1}
                max={7}
                disabled={!canWrite}
                {...form.register("maxConsecutiveNight", { valueAsNumber: true })}
              />
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
              <Label htmlFor="maxConsecutiveOffDays">Max consecutive off days</Label>
              <Input
                id="maxConsecutiveOffDays"
                type="number"
                min={1}
                max={7}
                disabled={!canWrite}
                {...form.register("maxConsecutiveOffDays", { valueAsNumber: true })}
              />
              <p className="mt-1 text-xs text-slate-500">
                Longest allowed streak without any assigned shift.
              </p>
            </div>
            <div>
              <Label htmlFor="minDaysOffPerMonth">Min off days per month (warning)</Label>
              <Input
                id="minDaysOffPerMonth"
                type="number"
                min={0}
                max={15}
                disabled={!canWrite}
                {...form.register("minDaysOffPerMonth", { valueAsNumber: true })}
              />
              <p className="mt-1 text-xs text-slate-500">
                Shows a warning when a doctor has fewer off days than this.
              </p>
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
              <Label htmlFor="ftDefaultTargetHours">Full-time monthly hours</Label>
              <Input
                id="ftDefaultTargetHours"
                type="number"
                min={1}
                max={400}
                disabled={!canWrite}
                {...form.register("ftDefaultTargetHours", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="halfTimeDefaultTargetHours">Half-time monthly hours</Label>
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
            </div>
            <div>
              <Label htmlFor="ptDefaultTargetHours">Part-time default hours</Label>
              <Input
                id="ptDefaultTargetHours"
                type="number"
                min={1}
                max={400}
                disabled={!canWrite}
                {...form.register("ptDefaultTargetHours", { valueAsNumber: true })}
              />
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
