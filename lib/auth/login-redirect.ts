/** Safe post-login destination for admin, doctor, or explicit `next` param. */
export function getLoginRedirectPath(role: string, next: string): string {
  const trimmed = next.trim();
  if (trimmed && trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  if (role === "DOCTOR") return "/my-schedule";
  return "/";
}
