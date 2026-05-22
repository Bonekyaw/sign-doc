"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  clearDailyCoverage,
  setDailyCoverage,
  setMonthDefaults,
} from "@/app/actions/coverage";
import {
  normalizeManpowerTargets,
  type ManpowerRatioOption,
} from "@/lib/scheduling/constants";
import {
  coverageTargetSchema,
  type CoverageTargetInput,
} from "@/lib/schemas/coverage";
import { ManpowerPresetsManager } from "@/components/settings/ManpowerPresetsManager";
import { ManpowerPresetSelect } from "@/components/settings/ManpowerPresetSelect";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  year: number;
  month: number;
  dayTarget: number;
  nightTarget: number;
  monthKeys: string[];
  presets: ManpowerRatioOption[];
  dailyOverrides: Record<string, { dayShiftTarget: number; nightShiftTarget: number }>;
  canWrite?: boolean;
};

export function CoverageEditor({
  year,
  month,
  dayTarget,
  nightTarget,
  monthKeys,
  presets,
  dailyOverrides,
  canWrite = true,
}: Props) {
  const router = useRouter();
  const [savingDefaults, setSavingDefaults] = useState(false);
  const normalized = normalizeManpowerTargets(dayTarget, nightTarget);

  const form = useForm<CoverageTargetInput>({
    resolver: zodResolver(coverageTargetSchema),
    defaultValues: normalized,
  });

  async function onSubmit(data: CoverageTargetInput) {
    setSavingDefaults(true);
    try {
      await setMonthDefaults(
        year,
        month,
        data.dayShiftTarget,
        data.nightShiftTarget,
      );
      router.refresh();
    } finally {
      setSavingDefaults(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Coverage requirements"
        description="Choose a Long day / Night ratio for the month, add custom presets, or override individual dates."
      />

      <ManpowerPresetsManager presets={presets} canWrite={canWrite} />

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>
            Month defaults ({year}-{String(month).padStart(2, "0")})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ManpowerPresetSelect
              presets={presets}
              dayTarget={form.watch("dayShiftTarget")}
              nightTarget={form.watch("nightShiftTarget")}
              onChange={(day, night) => {
                form.setValue("dayShiftTarget", day, { shouldDirty: true });
                form.setValue("nightShiftTarget", night, {
                  shouldDirty: true,
                });
              }}
            />
            {form.formState.errors.dayShiftTarget && (
              <p className="text-sm text-red-600">
                {form.formState.errors.dayShiftTarget.message}
              </p>
            )}
            {form.formState.errors.root && (
              <p className="text-sm text-red-600">
                {form.formState.errors.root.message}
              </p>
            )}
            {canWrite ? (
              <Button type="submit" disabled={savingDefaults}>
                {savingDefaults ? "Loading…" : "Save defaults"}
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-day overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {monthKeys.map((key) => (
              <DailyOverrideRow
                key={key}
                dateKey={key}
                defaults={{
                  dayTarget: normalized.dayShiftTarget,
                  nightTarget: normalized.nightShiftTarget,
                }}
                initialOverride={dailyOverrides[key]}
                presets={presets}
                canWrite={canWrite}
                onSaved={() => router.refresh()}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DailyOverrideRow({
  dateKey,
  defaults,
  initialOverride,
  presets,
  canWrite,
  onSaved,
}: {
  dateKey: string;
  defaults: { dayTarget: number; nightTarget: number };
  initialOverride?: { dayShiftTarget: number; nightShiftTarget: number };
  presets: ManpowerRatioOption[];
  canWrite: boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState<"override" | "clear" | null>(null);
  const initialTargets = initialOverride
    ? normalizeManpowerTargets(
        initialOverride.dayShiftTarget,
        initialOverride.nightShiftTarget,
      )
    : normalizeManpowerTargets(defaults.dayTarget, defaults.nightTarget);
  const [dayTarget, setDayTarget] = useState(initialTargets.dayShiftTarget);
  const [nightTarget, setNightTarget] = useState(initialTargets.nightShiftTarget);
  const hasOverride = !!initialOverride;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy("override");
        try {
          await setDailyCoverage(dateKey, dayTarget, nightTarget);
          onSaved();
        } finally {
          setBusy(null);
        }
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/30 p-3 text-sm"
    >
      <span className="w-28 font-mono text-slate-700">{dateKey}</span>
      {hasOverride ? (
        <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
          Override
        </span>
      ) : null}
      <ManpowerPresetSelect
        presets={presets}
        dayTarget={dayTarget}
        nightTarget={nightTarget}
        showHint={false}
        className="min-w-[10rem] flex-1"
        onChange={(day, night) => {
          setDayTarget(day);
          setNightTarget(night);
        }}
      />
      {canWrite ? (
        <>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={busy !== null}
          >
            {busy === "override" ? "Loading…" : "Override"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy !== null || !hasOverride}
            onClick={async () => {
              setBusy("clear");
              try {
                await clearDailyCoverage(dateKey);
                setDayTarget(defaults.dayTarget);
                setNightTarget(defaults.nightTarget);
                onSaved();
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === "clear" ? "Loading…" : "Clear"}
          </Button>
        </>
      ) : null}
    </form>
  );
}
