"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { schedulingRulesTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";
import {
  loadSchedulingRules,
  type SchedulingRulesConfig,
} from "@/lib/scheduling/context";
import { SCHEDULING_RULES_ID } from "@/lib/scheduling/rules-types";
import { schedulingRulesSchema } from "@/lib/schemas/scheduling-rules";
import { requireAdminRead, requireWrite } from "@/lib/auth/guards";

export async function getSchedulingRules(): Promise<SchedulingRulesConfig> {
  await requireAdminRead();
  return loadSchedulingRules();
}

export async function updateSchedulingRules(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireWrite();
  const parsed = schedulingRulesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.schedulingRules.update({
    where: { id: SCHEDULING_RULES_ID },
    data: parsed.data,
  });

  revalidateTag(schedulingRulesTag(), "max");
  revalidatePath("/doctors");
  revalidatePath("/schedule");
  return { ok: true };
}
