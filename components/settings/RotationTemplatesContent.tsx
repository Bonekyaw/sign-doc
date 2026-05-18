import { getCachedRotationTemplates } from "@/lib/data/cached";
import { RotationTemplateEditor } from "@/components/settings/RotationTemplateEditor";

export async function RotationTemplatesContent() {
  const templates = await getCachedRotationTemplates();
  return <RotationTemplateEditor templates={templates} />;
}
