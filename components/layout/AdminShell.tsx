"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AdminNav } from "@/components/layout/AdminNav";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-neutral-200/80 bg-white/90 px-4 shadow-sm backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-sm font-bold text-white shadow-md shadow-sky-500/30">
            DS
          </span>
          <span className="text-sm font-semibold text-black">Duty Schedule</span>
        </div>
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="rounded-xl p-2.5 text-black transition-colors hover:bg-neutral-100"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] transform border-r border-neutral-200/80 bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-b border-neutral-200/80 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-sm font-bold text-white shadow-md shadow-sky-500/30">
              DS
            </span>
            <div>
              <p className="text-sm font-semibold text-black">Duty Schedule</p>
              <p className="text-xs text-neutral-500">Admin</p>
            </div>
          </div>
        </div>
        <AdminNav onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="flex min-h-screen pt-14 lg:pt-0">
        <aside className="hidden w-[260px] shrink-0 border-r border-neutral-200/80 bg-white lg:block">
          <div className="sticky top-0 border-b border-neutral-200/80 px-5 py-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-sm font-bold text-white shadow-lg shadow-sky-500/25">
                DS
              </span>
              <div>
                <p className="text-sm font-semibold text-black">Duty Schedule</p>
                <p className="text-xs text-neutral-500">Admin portal</p>
              </div>
            </div>
          </div>
          <AdminNav />
        </aside>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
