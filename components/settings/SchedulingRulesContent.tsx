import { SchedulingRulesEditor } from "@/components/settings/SchedulingRulesEditor";
import { canWrite, getSession } from "@/lib/auth/guards";
import { loadSchedulingRulesRow } from "@/lib/scheduling/context";
import { mapSchedulingRulesRow } from "@/lib/scheduling/rules-types";

export async function SchedulingRulesContent() {
  const session = await getSession();
  const row = await loadSchedulingRulesRow();

  return (
    <SchedulingRulesEditor
      rules={mapSchedulingRulesRow(row)}
      updatedAt={row.updatedAt}
      canWrite={session ? canWrite(session.role) : false}
    />
  );
}
