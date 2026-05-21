import type { DoctorSeniority } from "@/lib/scheduling/types";

export function seniorityLabel(s: DoctorSeniority): string {
  switch (s) {
    case "SENIOR":
      return "Senior";
    case "MID_LEVEL":
      return "Mid-Level";
    case "JUNIOR":
      return "Junior";
  }
}

export function seniorityBadgeClass(s: DoctorSeniority): string {
  switch (s) {
    case "SENIOR":
      return "bg-sky-100 text-sky-800";
    case "MID_LEVEL":
      return "bg-violet-100 text-violet-800";
    case "JUNIOR":
      return "bg-amber-100 text-amber-800";
  }
}
