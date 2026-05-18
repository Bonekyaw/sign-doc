import { cn } from "@/lib/utils";

type DayCoverage = {
  date: string;
  dayShiftTarget: number;
  nightShiftTarget: number;
  lCount: number;
  nCount: number;
};

function bandClass(count: number, target: number) {
  if (count > target) return "text-red-700";
  if (count >= target) return "text-green-700";
  return "text-amber-700";
}

export function CoverageStrip({ coverage }: { coverage: DayCoverage[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2">
      {coverage.map((c) => (
        <div
          key={c.date}
          className="shrink-0 rounded-lg border border-sky-100 bg-white px-2 py-1.5 text-[10px] shadow-sm"
        >
          <div className="font-mono text-slate-500">{c.date.slice(8)}</div>
          <div className={cn(bandClass(c.lCount, c.dayShiftTarget))}>
            L {c.lCount}/{c.dayShiftTarget}
          </div>
          <div className={cn(bandClass(c.nCount, c.nightShiftTarget))}>
            N {c.nCount}/{c.nightShiftTarget}
          </div>
        </div>
      ))}
    </div>
  );
}
