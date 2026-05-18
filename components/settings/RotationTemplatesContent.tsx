import { getCachedRotationTemplates } from "@/lib/data/cached";
import { RotationTemplateEditor } from "@/components/settings/RotationTemplateEditor";
import { canWrite, getSession } from "@/lib/auth/guards";

export async function RotationTemplatesContent() {
  const session = await getSession();
  const templates = await getCachedRotationTemplates();
  return (
    <RotationTemplateEditor
      templates={templates}
      canWrite={session ? canWrite(session.role) : false}
    />
  );
}
