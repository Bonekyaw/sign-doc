import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { format } from "date-fns";
import { ArrowRight, CalendarDays, SlidersHorizontal, Users } from "lucide-react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCardsSkeleton } from "@/components/skeletons/StatCardsSkeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function getQuickLinks(year: number, month: number) {
  return [
    {
      href: `/schedule/${year}/${month}`,
      label: "Schedule",
      description: "Assign and review shifts",
      icon: CalendarDays,
    },
    {
      href: "/doctors",
      label: "Doctors",
      description: "Manage roster and rotations",
      icon: Users,
    },
    {
      href: "/settings/coverage",
      label: "Coverage",
      description: "Day and night targets",
      icon: SlidersHorizontal,
    },
  ];
}

export default async function DashboardPage() {
  await connection();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthLabel = format(new Date(Date.UTC(year, month - 1, 1)), "MMMM yyyy");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description={`${monthLabel} — staffing snapshot and quick actions.`}
        actions={
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/schedule/${year}/${month}`}>
              Open schedule
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <Suspense fallback={<StatCardsSkeleton />}>
        <DashboardStats year={year} month={month} />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
          <CardDescription>Jump to common admin tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {getQuickLinks(year, month).map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="group flex items-center gap-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:border-sky-200 hover:shadow-[var(--shadow-card-hover)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 transition-colors group-hover:bg-sky-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-black">
                      {link.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-600">
                      {link.description}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
