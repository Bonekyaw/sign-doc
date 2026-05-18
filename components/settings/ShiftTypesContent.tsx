import { getCachedShiftTypeConfigs } from "@/lib/data/cached";
import { ShiftTypeEditor } from "@/components/settings/ShiftTypeEditor";
import { canWrite, getSession } from "@/lib/auth/guards";

export async function ShiftTypesContent() {
  const session = await getSession();
  const types = await getCachedShiftTypeConfigs();
  return (
    <ShiftTypeEditor
      types={types}
      canWrite={session ? canWrite(session.role) : false}
    />
  );
}
