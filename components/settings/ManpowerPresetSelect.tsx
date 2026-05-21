"use client";

import {
  MANPOWER_PRESETS,
  normalizeManpowerTargets,
  presetIdToTargets,
  targetsToPresetId,
  type ManpowerPresetId,
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
  onChange: (day: number, night: number) => void;
  label?: string;
  className?: string;
  showHint?: boolean;
};

export function ManpowerPresetSelect({
  dayTarget,
  nightTarget,
  onChange,
  label = "Manpower (Long day – Night)",
  className,
  showHint = true,
}: Props) {
  const normalized = normalizeManpowerTargets(dayTarget, nightTarget);
  const presetId =
    targetsToPresetId(
      normalized.dayShiftTarget,
      normalized.nightShiftTarget,
    ) ?? "L4-N3";

  return (
    <div className={className}>
      {label ? <Label>{label}</Label> : null}
      <Select
        value={presetId}
        onValueChange={(v) => {
          const { dayShiftTarget, nightShiftTarget } = presetIdToTargets(
            v as ManpowerPresetId,
          );
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
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MANPOWER_PRESETS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showHint ? (
        <p className="mt-1 text-xs text-slate-500">
          L = Long day doctors, N = Night doctors. Schedule is correct when each
          day matches the selected ratio.
        </p>
      ) : null}
    </div>
  );
}
