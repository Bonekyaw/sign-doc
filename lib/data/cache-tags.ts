export function doctorsTag() {
  return "doctors";
}

export function shiftTypesTag() {
  return "shift-types";
}

export function scheduleTag(year: number, month: number) {
  return `schedule-${year}-${month}`;
}

export function coverageTag(year: number, month: number) {
  return `coverage-${year}-${month}`;
}

export function rotationTemplatesTag() {
  return "rotation-templates";
}
