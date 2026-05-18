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
}: {
  templates: TemplateRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateRow | null>(null);

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
    if (editing) {
      await updateRotationTemplate(editing.id, data);
    } else {
      await createRotationTemplate(data);
    }
    loadTemplate(null);
    router.refresh();
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
            <div className="flex flex-wrap gap-2">
              <Button type="submit">{editing ? "Update" : "Create"}</Button>
              {editing && (
                <Button type="button" variant="outline" onClick={() => loadTemplate(null)}>
                  Cancel
                </Button>
              )}
            </div>
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
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => loadTemplate(t)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={async () => {
                    if (!confirm("Delete this template?")) return;
                    try {
                      await deleteRotationTemplate(t.id);
                      router.refresh();
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Cannot delete.");
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-sm text-slate-500">No templates yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
