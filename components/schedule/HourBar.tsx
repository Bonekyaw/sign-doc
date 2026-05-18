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

  return (
    <div className="min-w-[100px]">
      <div className="mb-1 flex justify-between text-xs text-slate-600">
        <span>{worked}h</span>
        <span>/ {target}h</span>
      </div>
      <Progress
        value={pct}
        indicatorClassName={over ? "bg-red-600" : undefined}
      />
    </div>
  );
}
