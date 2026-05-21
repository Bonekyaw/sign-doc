import { formatManpowerRatio } from "@/lib/scheduling/constants";
import { cn } from "@/lib/utils";

type DayCoverage = {
  date: string;
  dayShiftTarget: number;
  nightShiftTarget: number;
  lCount: number;
  nCount: number;
  lHasSenior?: boolean;
  nHasSenior?: boolean;
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
          <div className="text-[9px] text-slate-400">
            {formatManpowerRatio(c.dayShiftTarget, c.nightShiftTarget)}
          </div>
          <div className={cn(bandClass(c.lCount, c.dayShiftTarget))}>
            L{c.lCount}/L{c.dayShiftTarget}
            {c.lCount > 0 && c.lHasSenior === false ? (
              <span className="ml-0.5 text-red-600" title="No Senior on day shift">
                ·!
              </span>
            ) : null}
          </div>
          <div className={cn(bandClass(c.nCount, c.nightShiftTarget))}>
            N{c.nCount}/N{c.nightShiftTarget}
            {c.nCount > 0 && c.nHasSenior === false ? (
              <span className="ml-0.5 text-red-600" title="No Senior on night shift">
                ·!
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
