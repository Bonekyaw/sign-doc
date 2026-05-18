"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/skeletons/Skeleton";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/doctors", label: "Doctors", icon: Users },
  { href: "/settings/shift-types", label: "Shift types", icon: Settings2 },
  { href: "/settings/coverage", label: "Coverage", icon: SlidersHorizontal },
  {
    href: "/settings/rotation-templates",
    label: "Rotations",
    icon: RefreshCw,
  },
];

function AdminNavFallback() {
  return (
    <nav className="flex flex-col gap-1 p-4">
      <Skeleton className="mb-2 h-3 w-12" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-xl" />
      ))}
    </nav>
  );
}

function AdminNavInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        Menu
      </p>
      {links.map((link) => {
        const Icon = link.icon;
        const active =
          link.label === "Schedule"
            ? pathname.startsWith("/schedule")
            : pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.label}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                : "text-black hover:bg-neutral-100",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-white" : "text-neutral-500 group-hover:text-black",
              )}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<AdminNavFallback />}>
      <AdminNavInner onNavigate={onNavigate} />
    </Suspense>
  );
}
