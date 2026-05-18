"use client";

import { useRouter } from "next/navigation";
import { updateShiftType } from "@/app/actions/shift-types";
import { PageHeader } from "@/components/layout/PageHeader";
import { displayShiftCode } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShiftTypeConfig } from "@/app/generated/prisma/client";

export function ShiftTypeEditor({
  types,
  canWrite = true,
}: {
  types: ShiftTypeConfig[];
  canWrite?: boolean;
}) {
  const router = useRouter();

  async function save(id: string, form: FormData, isActive: boolean) {
    await updateShiftType(id, {
      label: String(form.get("label")),
      startTime: String(form.get("startTime")),
      endTime: String(form.get("endTime")),
      durationHours: Number(form.get("durationHours")),
      color: String(form.get("color")),
      isActive,
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Shift types"
        description="Configure labels, times, and colors for each shift band."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t) => (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span
                  className="inline-block h-4 w-4 rounded"
                  style={{ backgroundColor: t.color }}
                />
                {displayShiftCode(t.code)} — {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={(fd) => save(t.id, fd, fd.get("isActive") === "on")}
                className="space-y-3"
              >
                <div>
                  <Label>Label</Label>
                  <Input name="label" defaultValue={t.label} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Start</Label>
                    <Input name="startTime" defaultValue={t.startTime} />
                  </div>
                  <div>
                    <Label>End</Label>
                    <Input name="endTime" defaultValue={t.endTime} />
                  </div>
                </div>
                <div>
                  <Label>Duration (hours)</Label>
                  <Input
                    name="durationHours"
                    type="number"
                    defaultValue={t.durationHours}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    name="color"
                    type="color"
                    defaultValue={t.color}
                    className="h-10"
                  />
                </div>
                <label className="flex min-h-10 items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={t.isActive}
                  />
                  Active
                </label>
                {canWrite ? (
                <Button type="submit" size="sm" className="w-full sm:w-auto">
                  Save
                </Button>
                ) : null}
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
