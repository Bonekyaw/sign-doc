"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  createManpowerPreset,
  deleteManpowerPreset,
} from "@/app/actions/manpower-presets";
import type { ManpowerRatioOption } from "@/lib/scheduling/constants";
import {
  MAX_DAY_SHIFT_TARGET,
  MAX_NIGHT_SHIFT_TARGET,
  MIN_DAY_SHIFT_TARGET,
  MIN_NIGHT_SHIFT_TARGET,
} from "@/lib/scheduling/constants";
import {
  manpowerRatioInputSchema,
  type ManpowerRatioInput,
} from "@/lib/schemas/manpower-preset";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  presets: ManpowerRatioOption[];
  canWrite?: boolean;
};

export function ManpowerPresetsManager({ presets, canWrite = true }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const form = useForm<ManpowerRatioInput>({
    resolver: zodResolver(manpowerRatioInputSchema),
    defaultValues: {
      dayShiftTarget: 4,
      nightShiftTarget: 2,
      label: "",
    },
  });

  const customPresets = presets.filter((p) => !p.builtIn);

  async function onSubmit(data: ManpowerRatioInput) {
    setError(null);
    const result = await createManpowerPreset({
      ...data,
      label: data.label?.trim() || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    form.reset({
      dayShiftTarget: 4,
      nightShiftTarget: 2,
      label: "",
    });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Manpower ratio presets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-slate-600">
          Built-in ratios (L3-N3, L3-N2, L4-N3) are always available. Add custom
          Long day / Night counts for use in month defaults and per-day
          overrides.
        </p>

        <ul className="divide-y divide-neutral-200/80 rounded-xl border border-neutral-200/80">
          {presets.map((preset) => (
            <li
              key={preset.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium text-slate-900">{preset.label}</span>
                <span className="ml-2 text-slate-500">
                  {preset.builtIn ? "Built-in" : "Custom"}
                </span>
              </div>
              {canWrite && !preset.builtIn && preset.dbId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busyId === preset.dbId}
                  onClick={async () => {
                    setError(null);
                    setBusyId(preset.dbId!);
                    const result = await deleteManpowerPreset(preset.dbId!);
                    setBusyId(null);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    router.refresh();
                  }}
                >
                  {busyId === preset.dbId ? "Removing…" : "Remove"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {canWrite ? (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 rounded-xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor="preset-day">Long day (L)</Label>
              <Input
                id="preset-day"
                type="number"
                min={MIN_DAY_SHIFT_TARGET}
                max={MAX_DAY_SHIFT_TARGET}
                {...form.register("dayShiftTarget", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="preset-night">Night (N)</Label>
              <Input
                id="preset-night"
                type="number"
                min={MIN_NIGHT_SHIFT_TARGET}
                max={MAX_NIGHT_SHIFT_TARGET}
                {...form.register("nightShiftTarget", { valueAsNumber: true })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="preset-label">Label (optional)</Label>
              <Input
                id="preset-label"
                placeholder="e.g. Weekend L4 - N2"
                {...form.register("label")}
              />
            </div>
            {error ? (
              <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit">Add ratio preset</Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
