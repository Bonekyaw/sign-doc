import { getCachedShiftTypeConfigs } from "@/lib/data/cached";
import { ShiftTypeEditor } from "@/components/settings/ShiftTypeEditor";

export async function ShiftTypesContent() {
  const types = await getCachedShiftTypeConfigs();
  return <ShiftTypeEditor types={types} />;
}
