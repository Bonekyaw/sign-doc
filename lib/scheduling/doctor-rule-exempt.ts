import type { DoctorInfo } from "@/lib/scheduling/types";
import type { AssignmentPurpose } from "@/lib/scheduling/validate-assignment";

export function doctorBypassesSchedulingRules(
  doctor: Pick<DoctorInfo, "schedulingRuleExempt">,
  purpose: AssignmentPurpose,
): boolean {
  return doctor.schedulingRuleExempt === true && purpose === "manualEdit";
}
