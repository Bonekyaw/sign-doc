"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  createDoctor,
  deleteDoctor,
  updateDoctor,
} from "@/app/actions/doctors";
import { dateKey, defaultTargetHours } from "@/lib/scheduling/dates";
import type { SchedulingRulesConfig } from "@/lib/scheduling/rules-types";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { doctorSchema, type DoctorFormInput } from "@/lib/schemas/doctor";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Doctor,
  DoctorRestriction,
  DoctorRotation,
  DoctorSeniority,
  RotationTemplate,
} from "@/app/generated/prisma/client";
import { useConfirmDialog } from "@/lib/hooks/use-confirm-dialog";
import { AlertMessageDialog } from "@/components/ui/alert-message-dialog";
import { cn } from "@/lib/utils";
import { seniorityBadgeClass, seniorityLabel } from "@/lib/utils/seniority";

type DoctorRow = Doctor & {
  restrictions: DoctorRestriction[];
  rotation:
    | (DoctorRotation & {
        template: RotationTemplate & {
          steps: { stepType: string; sortOrder: number }[];
        };
      })
    | null;
};

type TemplateOption = { id: string; name: string };

export function DoctorManager({
  doctors,
  rotationTemplates,
  schedulingRules = DEFAULT_SCHEDULING_RULES,
  canWrite = true,
}: {
  doctors: DoctorRow[];
  rotationTemplates: TemplateOption[];
  schedulingRules?: SchedulingRulesConfig;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorRow | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<{
    title: string;
    description: string;
    tone?: "error" | "success" | "info";
  } | null>(null);
  const { requestConfirm, confirmDialog, confirmLoading } = useConfirmDialog();

  const form = useForm<DoctorFormInput>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      name: "",
      type: "FT",
      seniority: "MID_LEVEL" as DoctorSeniority,
      monthlyHourLimit: schedulingRules.ftDefaultTargetHours,
      girlsOff24h: false,
      rotationTemplateId: null,
      rotationStartDate: null,
    },
  });

  function resetForm(d?: DoctorRow) {
    setEditing(d ?? null);
    setSubmitError(null);
    const type = (d?.type as "FT" | "HALF_TIME" | "PT") ?? "FT";
    form.reset({
      name: d?.name ?? "",
      type,
      seniority: (d?.seniority as DoctorSeniority) ?? "MID_LEVEL",
      monthlyHourLimit:
        d?.targetMonthlyHours ?? defaultTargetHours(type, schedulingRules),
      girlsOff24h:
        d?.restrictions.some((r) => r.type === "NO_TWENTY_FOUR") ?? false,
      rotationTemplateId: d?.rotation?.templateId ?? null,
      rotationStartDate: d?.rotation?.startDate
        ? dateKey(d.rotation.startDate)
        : null,
    });
  }

  async function onSubmit(data: DoctorFormInput) {
    setSubmitError(null);
    setSaving(true);
    try {
      const payload = {
        name: data.name,
        type: data.type,
        seniority: data.seniority,
        monthlyHourLimit: data.monthlyHourLimit,
        girlsOff24h: data.girlsOff24h,
        rotationTemplateId: data.rotationTemplateId || null,
        rotationStartDate: data.rotationStartDate || null,
      };
      if (editing) {
        await updateDoctor(editing.id, payload);
      } else {
        await createDoctor(payload);
      }
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to save doctor.");
    } finally {
      setSaving(false);
    }
  }

  async function runDeleteDoctor(id: string) {
    setDeletingId(id);
    try {
      await deleteDoctor(id);
      router.refresh();
    } catch (e) {
      setAlertMessage({
        title: "Could not delete doctor",
        description:
          e instanceof Error ? e.message : "An unexpected error occurred.",
        tone: "error",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function handleDelete(id: string, name: string) {
    requestConfirm(
      {
        title: "Delete doctor?",
        description: (
          <>
            Delete <strong>{name}</strong> and all of their shifts? This cannot
            be undone.
          </>
        ),
        confirmLabel: "Delete",
        variant: "destructive",
      },
      () => runDeleteDoctor(id),
    );
  }

  const watchType = form.watch("type");
  const watchTemplate = form.watch("rotationTemplateId");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Roster"
        title="Doctors"
        description={`${doctors.length} doctor${doctors.length === 1 ? "" : "s"} on roster — manage hour limits and rotations.`}
        actions={
          canWrite ? (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" onClick={() => resetForm()}>
                Add doctor
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit doctor" : "Add doctor"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update roster details, hour limits, and rotation."
                  : "Add a doctor to the roster with type and optional rotation."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Seniority</Label>
                <Select
                  value={form.watch("seniority")}
                  onValueChange={(v) =>
                    form.setValue("seniority", v as DoctorSeniority)
                  }
                >
                  <SelectTrigger className="text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SENIOR">Senior</SelectItem>
                    <SelectItem value="MID_LEVEL">Mid-Level</SelectItem>
                    <SelectItem value="JUNIOR">Junior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Employment type</Label>
                <Select
                  value={watchType}
                  onValueChange={(v) => {
                    const t = v as "FT" | "HALF_TIME" | "PT";
                    form.setValue("type", t);
                    if (!editing) {
                      form.setValue(
                        "monthlyHourLimit",
                        defaultTargetHours(t, schedulingRules),
                      );
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FT">Full-time (240h default)</SelectItem>
                    <SelectItem value="HALF_TIME">
                      Half-time / 2-in-1 (120h default)
                    </SelectItem>
                    <SelectItem value="PT">Part-time (custom limit)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="hours">Monthly hour target</Label>
                <p className="mb-1 text-xs text-slate-600">
                  Hours this doctor must complete each month (240 FT, 120
                  half-time, or custom for part-time). Save and publish require
                  meeting this target.
                </p>
                <Input
                  id="hours"
                  type="number"
                  min={1}
                  {...form.register("monthlyHourLimit", { valueAsNumber: true })}
                />
                {form.formState.errors.monthlyHourLimit && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.monthlyHourLimit.message}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.watch("girlsOff24h")}
                  onChange={(e) => form.setValue("girlsOff24h", e.target.checked)}
                />
                Girls off 24h (cannot work 24-hour shifts)
              </label>
              <div>
                <Label>Rotation template (optional)</Label>
                <Select
                  value={watchTemplate ?? "none"}
                  onValueChange={(v) =>
                    form.setValue(
                      "rotationTemplateId",
                      v === "none" ? null : v,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {rotationTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {watchTemplate && (
                <div>
                  <Label htmlFor="rotationStart">Rotation start date</Label>
                  <Input
                    id="rotationStart"
                    type="date"
                    {...form.register("rotationStartDate")}
                  />
                  {form.formState.errors.rotationStartDate && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.rotationStartDate.message}
                    </p>
                  )}
                </div>
              )}
              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={saving || confirmLoading}
              >
                {saving ? "Loading…" : "Save"}
              </Button>
            </form>
            </DialogContent>
          </Dialog>
          ) : undefined
        }
      />

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {doctors.map((d) => (
          <Card key={d.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{d.name}</p>
                  <p className="text-sm text-slate-600">
                    {d.type} · {d.targetMonthlyHours}h / month
                  </p>
                  <Badge
                    className={cn(
                      "mt-1",
                      seniorityBadgeClass(d.seniority as DoctorSeniority),
                    )}
                  >
                    {seniorityLabel(d.seniority as DoctorSeniority)}
                  </Badge>
                </div>
                {canWrite ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      resetForm(d);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    disabled={deletingId === d.id || confirmLoading}
                    onClick={() => handleDelete(d.id, d.name)}
                  >
                    {deletingId === d.id ? "Loading…" : "Delete"}
                  </Button>
                </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {d.restrictions.some((r) => r.type === "NO_TWENTY_FOUR") && (
                  <Badge className="bg-pink-100 text-pink-800">Girls off 24h</Badge>
                )}
                {d.rotation && (
                  <Badge className="bg-violet-100 text-violet-800">
                    {d.rotation.template.name}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {doctors.length === 0 && (
          <p className="rounded-xl border border-dashed border-sky-200 bg-white p-8 text-center text-sm text-slate-500">
            No doctors yet. Add your first doctor.
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-[var(--shadow-card)] md:block">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="p-3 text-xs font-medium uppercase tracking-wide text-sky-800/70">
                Name
              </th>
              <th className="p-3 text-xs font-medium uppercase tracking-wide text-sky-800/70">
                Type
              </th>
              <th className="p-3 text-xs font-medium uppercase tracking-wide text-sky-800/70">
                Monthly limit
              </th>
              <th className="p-3 text-xs font-medium uppercase tracking-wide text-sky-800/70">
                Tags
              </th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id} className="border-t border-sky-50">
                <td className="p-3 font-medium text-slate-900">{d.name}</td>
                <td className="p-3 text-slate-600">{d.type}</td>
                <td className="p-3 text-slate-600">{d.targetMonthlyHours}h</td>
                <td className="space-x-1 p-3">
                  <Badge
                    className={seniorityBadgeClass(
                      d.seniority as DoctorSeniority,
                    )}
                  >
                    {seniorityLabel(d.seniority as DoctorSeniority)}
                  </Badge>
                  {d.restrictions.some((r) => r.type === "NO_TWENTY_FOUR") && (
                    <Badge className="bg-pink-100 text-pink-800">
                      Girls off 24h
                    </Badge>
                  )}
                  {d.rotation && (
                    <Badge className="bg-violet-100 text-violet-800">
                      {d.rotation.template.name}
                    </Badge>
                  )}
                </td>
                <td className="p-3 text-right">
                  {canWrite ? (
                  <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      resetForm(d);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    disabled={deletingId === d.id || confirmLoading}
                    onClick={() => handleDelete(d.id, d.name)}
                  >
                    {deletingId === d.id ? "Loading…" : "Delete"}
                  </Button>
                  </>
                  ) : null}
                </td>
              </tr>
            ))}
            {doctors.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No doctors yet. Add your first doctor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

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

