"use client";

import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  clearDailyCoverage,
  setDailyCoverage,
  setMonthDefaults,
} from "@/app/actions/coverage";
import {
  ALLOWED_DAY_TARGETS,
  ALLOWED_NIGHT_TARGETS,
} from "@/lib/scheduling/constants";
import {
  coverageTargetSchema,
  type CoverageTargetInput,
} from "@/lib/schemas/coverage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  year: number;
  month: number;
  dayTarget: number;
  nightTarget: number;
  monthKeys: string[];
  canWrite?: boolean;
};

export function CoverageEditor({
  year,
  month,
  dayTarget,
  nightTarget,
  monthKeys,
  canWrite = true,
}: Props) {
  const router = useRouter();
  const form = useForm<CoverageTargetInput>({
    resolver: zodResolver(coverageTargetSchema),
    defaultValues: {
      dayShiftTarget: (ALLOWED_DAY_TARGETS.includes(
        dayTarget as (typeof ALLOWED_DAY_TARGETS)[number],
      )
        ? dayTarget
        : 4) as CoverageTargetInput["dayShiftTarget"],
      nightShiftTarget: (ALLOWED_NIGHT_TARGETS.includes(
        nightTarget as (typeof ALLOWED_NIGHT_TARGETS)[number],
      )
        ? nightTarget
        : 3) as CoverageTargetInput["nightShiftTarget"],
    },
  });

  async function onSubmit(data: CoverageTargetInput) {
    await setMonthDefaults(
      year,
      month,
      data.dayShiftTarget,
      data.nightShiftTarget,
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Coverage requirements"
        description="Day shift: 3 or 4 doctors. Night shift: 2 or 3 doctors."
      />

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>
            Month defaults ({year}-{String(month).padStart(2, "0")})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Day shift doctors (Long Day)</Label>
              <Select
                value={String(form.watch("dayShiftTarget"))}
                onValueChange={(v) =>
                  form.setValue(
                    "dayShiftTarget",
                    Number(v) as CoverageTargetInput["dayShiftTarget"],
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_DAY_TARGETS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} doctors
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Night shift doctors</Label>
              <Select
                value={String(form.watch("nightShiftTarget"))}
                onValueChange={(v) =>
                  form.setValue(
                    "nightShiftTarget",
                    Number(v) as CoverageTargetInput["nightShiftTarget"],
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOWED_NIGHT_TARGETS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} doctors
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.formState.errors.dayShiftTarget && (
              <p className="text-sm text-red-600">
                {form.formState.errors.dayShiftTarget.message}
              </p>
            )}
            {canWrite ? <Button type="submit">Save defaults</Button> : null}
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
                defaults={{ dayTarget, nightTarget }}
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
  canWrite,
  onSaved,
}: {
  dateKey: string;
  defaults: { dayTarget: number; nightTarget: number };
  canWrite: boolean;
  onSaved: () => void;
}) {
  const form = useForm<CoverageTargetInput>({
    resolver: zodResolver(coverageTargetSchema),
    defaultValues: {
      dayShiftTarget: 4 as CoverageTargetInput["dayShiftTarget"],
      nightShiftTarget: 3 as CoverageTargetInput["nightShiftTarget"],
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit(async (data) => {
        await setDailyCoverage(
          dateKey,
          data.dayShiftTarget,
          data.nightShiftTarget,
        );
        onSaved();
      })}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/30 p-3 text-sm"
    >
      <span className="w-28 font-mono text-slate-700">{dateKey}</span>
      <Select
        value={String(form.watch("dayShiftTarget"))}
        onValueChange={(v) =>
          form.setValue(
            "dayShiftTarget",
            Number(v) as CoverageTargetInput["dayShiftTarget"],
          )
        }
      >
        <SelectTrigger className="h-10 w-24">
          <SelectValue placeholder={`D:${defaults.dayTarget}`} />
        </SelectTrigger>
        <SelectContent>
          {ALLOWED_DAY_TARGETS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(form.watch("nightShiftTarget"))}
        onValueChange={(v) =>
          form.setValue(
            "nightShiftTarget",
            Number(v) as CoverageTargetInput["nightShiftTarget"],
          )
        }
      >
        <SelectTrigger className="h-10 w-24">
          <SelectValue placeholder={`N:${defaults.nightTarget}`} />
        </SelectTrigger>
        <SelectContent>
          {ALLOWED_NIGHT_TARGETS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canWrite ? (
      <>
      <Button type="submit" size="sm" variant="outline">
        Override
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={async () => {
          await clearDailyCoverage(dateKey);
          onSaved();
        }}
      >
        Clear
      </Button>
      </>
      ) : null}
    </form>
  );
}
