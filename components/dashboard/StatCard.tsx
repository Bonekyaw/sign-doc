import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  valueClassName?: string;
  iconClassName?: string;
};

export function StatCard({
  label,
  value,
  icon: Icon,
  valueClassName,
  iconClassName,
}: StatCardProps) {
  return (
    <Card className="group hover:shadow-[var(--shadow-card-hover)]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {label}
            </p>
            <p
              className={cn(
                "text-3xl font-bold tracking-tight text-black tabular-nums",
                valueClassName,
              )}
            >
              {value}
            </p>
          </div>
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-500/30 transition-transform duration-200 group-hover:scale-105",
              iconClassName,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
