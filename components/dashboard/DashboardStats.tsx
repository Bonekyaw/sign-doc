import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Users,
} from "lucide-react";
import { fetchDashboardStats } from "@/lib/data/dashboard-stats";
import { StatCard } from "@/components/dashboard/StatCard";

export async function DashboardStats({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const stats = await fetchDashboardStats(year, month);

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Doctors" value={stats.doctorCount} icon={Users} />
      <StatCard
        label="Under-covered days"
        value={stats.underCoveredDays}
        icon={AlertTriangle}
        valueClassName="text-amber-600"
        iconClassName="from-amber-500 to-amber-600 shadow-amber-500/30"
      />
      <StatCard
        label="Over hour limit"
        value={stats.overHours}
        icon={Clock}
        valueClassName="text-red-600"
        iconClassName="from-red-500 to-red-600 shadow-red-500/30"
      />
      <StatCard
        label="Shifts assigned"
        value={stats.totalShifts}
        icon={CalendarDays}
      />
    </div>
  );
}
