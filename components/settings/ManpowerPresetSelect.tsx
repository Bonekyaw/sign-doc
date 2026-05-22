"use client";

import { useMemo } from "react";
import {
  findManpowerPreset,
  formatManpowerRatio,
  normalizeManpowerTargets,
  presetIdToTargets,
  targetsToPresetId,
  type ManpowerRatioOption,
} from "@/lib/scheduling/constants";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  dayTarget: number;
  nightTarget: number;
  presets: ManpowerRatioOption[];
  onChange: (day: number, night: number) => void;
  label?: string;
  className?: string;
  showHint?: boolean;
};

export function ManpowerPresetSelect({
  dayTarget,
  nightTarget,
  presets,
  onChange,
  label = "Manpower (Long day – Night)",
  className,
  showHint = true,
}: Props) {
  const normalized = normalizeManpowerTargets(dayTarget, nightTarget);
  const presetId =
    targetsToPresetId(normalized.dayShiftTarget, normalized.nightShiftTarget) ??
    "L4-N3";
  const options = useMemo(() => {
    if (
      findManpowerPreset(
        presets,
        normalized.dayShiftTarget,
        normalized.nightShiftTarget,
      )
    ) {
      return presets;
    }
    return [
      ...presets,
      {
        id: presetId,
        dayShiftTarget: normalized.dayShiftTarget,
        nightShiftTarget: normalized.nightShiftTarget,
        label: formatManpowerRatio(
          normalized.dayShiftTarget,
          normalized.nightShiftTarget,
        ),
      },
    ];
  }, [presets, normalized.dayShiftTarget, normalized.nightShiftTarget, presetId]);
  const currentLabel =
    findManpowerPreset(
      options,
      normalized.dayShiftTarget,
      normalized.nightShiftTarget,
    )?.label ?? formatManpowerRatio(normalized.dayShiftTarget, normalized.nightShiftTarget);

  return (
    <div className={className}>
      {label ? <Label>{label}</Label> : null}
      <Select
        value={presetId}
        onValueChange={(v) => {
          const { dayShiftTarget, nightShiftTarget } = presetIdToTargets(v);
          if (
            dayShiftTarget === normalized.dayShiftTarget &&
            nightShiftTarget === normalized.nightShiftTarget
          ) {
            return;
          }
          onChange(dayShiftTarget, nightShiftTarget);
        }}
      >
        <SelectTrigger>
          <SelectValue>{currentLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.builtIn ? p.label : `${p.label}${p.dbId ? " (custom)" : ""}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showHint ? (
        <p className="mt-1 text-xs text-slate-500">
          L = Long day doctors, N = Night doctors. Add more ratios below the
          month defaults.
        </p>
      ) : null}
    </div>
  );
}
