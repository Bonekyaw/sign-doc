import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm text-black shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/20",
        className,
      )}
      {...props}
    />
  );
}
