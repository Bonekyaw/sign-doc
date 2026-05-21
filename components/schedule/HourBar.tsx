import { Progress } from "@/components/ui/progress";

export function HourBar({
  worked,
  target,
}: {
  worked: number;
  target: number;
}) {
  const pct = Math.min(100, Math.round((worked / Math.max(target, 1)) * 100));
  const over = worked > target;
  const atTarget = worked >= target && !over;

  return (
    <div className="min-w-[88px]">
      <div
        className={`mb-1 text-center text-xs font-medium tabular-nums ${
          over
            ? "text-red-700"
            : atTarget
              ? "text-emerald-700"
              : "text-slate-700"
        }`}
      >
        {worked} / {target}
      </div>
      <Progress
        value={pct}
        indicatorClassName={
          over ? "bg-red-600" : atTarget ? "bg-emerald-600" : undefined
        }
      />
    </div>
  );
}
