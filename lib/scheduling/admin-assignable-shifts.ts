import type { ShiftTypeInfo } from "@/lib/scheduling/types";

type ShiftTypeLike = Pick<ShiftTypeInfo, "code" | "isActive">;

/** Admin schedule may assign inactive Off; other paths only show active types. */
export function adminAssignableShiftTypes<T extends ShiftTypeLike>(
  shiftTypes: T[],
  options: { adminSchedule: boolean },
): T[] {
  if (!options.adminSchedule) {
    return shiftTypes.filter((t) => t.isActive);
  }
  return shiftTypes.filter((t) => t.isActive || t.code === "OFF");
}

export function isOffDayAssignment(
  assignment: { code: string } | undefined,
): boolean {
  return assignment?.code === "OFF";
}
