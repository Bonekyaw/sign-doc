"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import {
  createRotationTemplate,
  deleteRotationTemplate,
  updateRotationTemplate,
} from "@/app/actions/rotation-templates";
import {
  rotationTemplateSchema,
  type RotationTemplateInput,
} from "@/lib/schemas/rotation";
import type { RotationStepType } from "@/lib/scheduling/rotation";
import { useConfirmDialog } from "@/lib/hooks/use-confirm-dialog";
import { AlertMessageDialog } from "@/components/ui/alert-message-dialog";
import { displayShiftCode } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RotationTemplate, RotationTemplateStep } from "@/app/generated/prisma/client";

type TemplateRow = RotationTemplate & { steps: RotationTemplateStep[] };

const STEP_OPTIONS: { value: RotationStepType; label: string }[] = [
  { value: "TWENTY_FOUR", label: "24 Hours" },
  { value: "L", label: "Long Day" },
  { value: "N", label: "Night" },
  { value: "OFF", label: "Off" },
];

export function RotationTemplateEditor({
  templates,
  canWrite = true,
}: {
  templates: TemplateRow[];
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<{
    title: string;
    description: string;
    tone?: "error" | "success" | "info";
  } | null>(null);
  const { requestConfirm, confirmDialog, confirmLoading } = useConfirmDialog();

  const form = useForm<RotationTemplateInput>({
    resolver: zodResolver(rotationTemplateSchema),
    defaultValues: {
      name: "",
      steps: [{ stepType: "TWENTY_FOUR" }, { stepType: "L" }, { stepType: "N" }, { stepType: "OFF" }],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  function loadTemplate(t: TemplateRow | null) {
    setEditing(t);
    if (t) {
      form.reset({
        name: t.name,
        steps: t.steps
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({ stepType: s.stepType as RotationStepType })),
      });
    } else {
      form.reset({
        name: "",
        steps: [
          { stepType: "TWENTY_FOUR" },
          { stepType: "L" },
          { stepType: "N" },
          { stepType: "OFF" },
        ],
      });
    }
  }

  async function onSubmit(data: RotationTemplateInput) {
    setSaving(true);
    try {
      if (editing) {
        await updateRotationTemplate(editing.id, data);
      } else {
        await createRotationTemplate(data);
      }
      loadTemplate(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function runDeleteTemplate(id: string) {
    setDeletingId(id);
    try {
      await deleteRotationTemplate(id);
      router.refresh();
    } catch (e) {
      setAlertMessage({
        title: "Could not delete template",
        description:
          e instanceof Error ? e.message : "An unexpected error occurred.",
        tone: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function handleDeleteTemplate(id: string, name: string) {
    requestConfirm(
      {
        title: "Delete template?",
        description: (
          <>
            Delete rotation template <strong>{name}</strong>? This cannot be
            undone.
          </>
        ),
        confirmLabel: "Delete",
        variant: "destructive",
      },
      () => runDeleteTemplate(id),
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Rotation templates"
        description="Define repeating shift patterns (e.g. 24h → Long day → Night → Off). Auto-assign prefers doctors on-pattern when possible."
      />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{editing ? `Edit: ${editing.name}` : "New template"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label>Steps</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-6 text-xs text-slate-500">{index + 1}.</span>
                  <Select
                    value={form.watch(`steps.${index}.stepType`)}
                    onValueChange={(v) =>
                      form.setValue(
                        `steps.${index}.stepType`,
                        v as RotationStepType,
                      )
                    }
                  >
                    <SelectTrigger className="min-h-10 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEP_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ stepType: "OFF" })}
              >
                Add step
              </Button>
            </div>
            {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || confirmLoading}>
                {saving ? "Loading…" : editing ? "Update" : "Create"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={() => loadTemplate(null)}>
                  Cancel
                </Button>
              )}
            </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-lg border border-sky-100 bg-sky-50/30 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-600">
                  {t.steps
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((s) =>
                      s.stepType === "OFF"
                        ? "Off"
                        : displayShiftCode(s.stepType),
                    )
                    .join(" → ")}
                </p>
              </div>
              {canWrite ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => loadTemplate(t)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  disabled={deletingId === t.id || confirmLoading}
                  onClick={() => handleDeleteTemplate(t.id, t.name)}
                >
                  {deletingId === t.id ? "Loading…" : "Delete"}
                </Button>
              </div>
              ) : null}
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-slate-500">No templates yet.</p>
          )}
        </CardContent>
      </Card>

      {confirmDialog}
      <AlertMessageDialog
        open={!!alertMessage}
        onOpenChange={(open) => !open && setAlertMessage(null)}
        title={alertMessage?.title ?? ""}
        description={alertMessage?.description ?? ""}
        tone={alertMessage?.tone}
      />
    </div>
  );
}
