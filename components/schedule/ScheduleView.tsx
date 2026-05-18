"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import {
  applyAutoAssign,
  assignShift,
  clearShift,
  suggestSchedule,
  validateShiftPreview,
} from "@/app/actions/schedule";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoverageStrip } from "@/components/schedule/CoverageStrip";
import { HourBar } from "@/components/schedule/HourBar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayShiftCode } from "@/lib/utils";

type ShiftTypeRow = {
  id: string;
  code: string;
  label: string;
  color: string;
  durationHours: number;
  isActive: boolean;
};

type DoctorRow = {
  id: string;
  name: string;
  targetHours: number;
};

type ShiftRow = {
  doctorId: string;
  date: string;
  shiftTypeId: string;
  code: string;
  color: string;
  label: string;
};

type HourRow = { doctorId: string; worked: number; target: number };

type Props = {
  year: number;
  month: number;
  doctors: DoctorRow[];
  shiftTypes: ShiftTypeRow[];
  assignments: ShiftRow[];
  monthKeys: string[];
  coverageByDate: {
    date: string;
    dayShiftTarget: number;
    nightShiftTarget: number;
    lCount: number;
    nCount: number;
  }[];
  hourSummary: HourRow[];
  readOnly?: boolean;
  scheduleBasePath?: string;
};

function DraggableShift({
  id,
  label,
  color,
}: {
  id: string;
  label: string;
  color: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${id}`,
    data: { shiftTypeId: id },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="cursor-grab rounded px-3 py-1.5 text-xs font-semibold text-white shadow-sm active:cursor-grabbing"
      style={{
        backgroundColor: color,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  );
}

function ReadOnlyScheduleCell({
  assignment,
}: {
  assignment?: ShiftRow;
}) {
  return (
    <td className="border border-sky-50 p-1 text-center">
      {assignment ? (
        <span
          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: assignment.color }}
        >
          {displayShiftCode(assignment.code)}
        </span>
      ) : (
        <span className="text-slate-300">·</span>
      )}
    </td>
  );
}

function ScheduleCell({
  doctorId,
  dateStr,
  assignment,
  onClick,
}: {
  doctorId: string;
  dateStr: string;
  assignment?: ShiftRow;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${doctorId}__${dateStr}`,
    data: { doctorId, dateStr },
  });

  return (
    <td
      ref={setNodeRef}
      onClick={onClick}
      className={`cursor-pointer border border-sky-50 p-1 text-center ${
        isOver ? "bg-sky-100 ring-2 ring-sky-400" : ""
      }`}
    >
      {assignment ? (
        <span
          className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: assignment.color }}
        >
          {displayShiftCode(assignment.code)}
        </span>
      ) : (
        <span className="text-slate-300">·</span>
      )}
    </td>
  );
}

export function ScheduleView({
  year,
  month,
  doctors,
  shiftTypes,
  assignments,
  monthKeys,
  coverageByDate,
  hourSummary,
  readOnly = false,
  scheduleBasePath = "/schedule",
}: Props) {
  const router = useRouter();
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "warning" | "success";
    text: string;
  } | null>(null);
  const [picker, setPicker] = useState<{
    doctorId: string;
    dateStr: string;
  } | null>(null);
  const [autoPreview, setAutoPreview] = useState<{
    proposals: { doctorId: string; date: string; shiftCode: string }[];
    unfilled: {
      date: string;
      band: string;
      needed: number;
      assigned: number;
    }[];
    warnings: string[];
    swapCount: number;
    raw: { doctorId: string; date: string; shiftTypeId: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const assignmentMap = new Map(
    assignments.map((a) => [`${a.doctorId}__${a.date}`, a]),
  );

  const hoursMap = new Map(hourSummary.map((h) => [h.doctorId, h]));

  const prevMonth =
    month === 1
      ? { year: year - 1, month: 12 }
      : { year, month: month - 1 };
  const nextMonth =
    month === 12
      ? { year: year + 1, month: 1 }
      : { year, month: month + 1 };
  const prevHref =
    scheduleBasePath === "/my-schedule"
      ? `/my-schedule?year=${prevMonth.year}&month=${prevMonth.month}`
      : `${scheduleBasePath}/${prevMonth.year}/${prevMonth.month}`;
  const nextHref =
    scheduleBasePath === "/my-schedule"
      ? `/my-schedule?year=${nextMonth.year}&month=${nextMonth.month}`
      : `${scheduleBasePath}/${nextMonth.year}/${nextMonth.month}`;

  const showMessage = useCallback(
    (type: "error" | "warning" | "success", texts: string[]) => {
      if (texts.length === 0) return;
      setMessage({ type, text: texts.join(" ") });
    },
    [],
  );

  async function handleAssign(
    doctorId: string,
    dateStr: string,
    shiftTypeId: string,
  ) {
    setLoading(true);
    const preview = await validateShiftPreview({
      doctorId,
      dateStr,
      shiftTypeId,
      year,
      month,
    });
    if (!preview.ok) {
      showMessage("error", preview.errors);
      setLoading(false);
      return;
    }
    const result = await assignShift({
      doctorId,
      dateStr,
      shiftTypeId,
      year,
      month,
    });
    if (!result.ok) {
      showMessage("error", result.errors);
    } else {
      if (result.warnings?.length) showMessage("warning", result.warnings);
      else setMessage({ type: "success", text: "Shift assigned." });
      router.refresh();
    }
    setLoading(false);
    setPicker(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveShiftId(null);
    const { active, over } = event;
    if (!over) return;

    const shiftTypeId = active.data.current?.shiftTypeId as string | undefined;
    const doctorId = over.data.current?.doctorId as string | undefined;
    const dateStr = over.data.current?.dateStr as string | undefined;
    if (!shiftTypeId || !doctorId || !dateStr) return;

    await handleAssign(doctorId, dateStr, shiftTypeId);
  }

  async function handleAutoAssign() {
    setLoading(true);
    const result = await suggestSchedule(year, month);
    setAutoPreview({
      proposals: result.proposals.map((p) => ({
        doctorId: p.doctorId,
        date: p.date,
        shiftCode: p.shiftCode,
      })),
      unfilled: result.unfilled,
      warnings: result.warnings,
      swapCount: result.swapCount,
      raw: result.proposals.map((p) => ({
        doctorId: p.doctorId,
        date: p.date,
        shiftTypeId: p.shiftTypeId,
      })),
    });
    setLoading(false);
    if (result.proposals.length === 0 && result.unfilled.length > 0) {
      showMessage("warning", ["No assignments could be suggested."]);
    }
  }

  async function applySuggestions() {
    if (!autoPreview) return;
    setLoading(true);
    await applyAutoAssign(year, month, autoPreview.raw);
    setAutoPreview(null);
    setMessage({ type: "success", text: "Auto-assign applied." });
    router.refresh();
    setLoading(false);
  }

  const activeType = shiftTypes.find(
    (t) => t.id === activeShiftId?.replace("palette-", ""),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={format(new Date(Date.UTC(year, month - 1, 1)), "MMMM yyyy")}
        description={
          readOnly
            ? "Your assigned shifts for this month"
            : "Drag shifts onto cells or click to pick"
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={prevHref}>Previous</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={nextHref}>Next</Link>
            </Button>
            {!readOnly ? (
              <Button onClick={handleAutoAssign} disabled={loading}>
                Auto-assign
              </Button>
            ) : null}
          </>
        }
      />

      {message && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            message.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : message.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {!readOnly ? <CoverageStrip coverage={coverageByDate} /> : null}

      {readOnly ? (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white shadow-[var(--shadow-card)]">
          <table className="min-w-max text-xs">
            <thead>
              <tr className="bg-neutral-50">
                <th className="sticky left-0 z-10 bg-neutral-50 p-2 text-left font-medium text-black">
                  Doctor
                </th>
                <th className="sticky left-24 z-10 bg-neutral-50 p-2 font-medium text-black">
                  Hours
                </th>
                {monthKeys.map((k) => (
                  <th key={k} className="p-1 font-mono text-[10px]">
                    {k.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => {
                const hours = hoursMap.get(doc.id);
                return (
                  <tr key={doc.id}>
                    <td className="sticky left-0 z-10 bg-white p-2 font-medium whitespace-nowrap">
                      {doc.name}
                    </td>
                    <td className="sticky left-24 z-10 bg-white p-2">
                      <HourBar
                        worked={hours?.worked ?? 0}
                        target={hours?.target ?? doc.targetHours}
                      />
                    </td>
                    {monthKeys.map((dateStr) => (
                      <ReadOnlyScheduleCell
                        key={dateStr}
                        assignment={assignmentMap.get(`${doc.id}__${dateStr}`)}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => {
          const id = String(e.active.id);
          if (id.startsWith("palette-")) setActiveShiftId(id);
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="sticky top-0 z-10 flex flex-wrap gap-2 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[var(--shadow-card)]">
          <span className="self-center text-xs font-medium text-slate-500">
            Drag onto grid:
          </span>
          {shiftTypes
            .filter((t) => t.isActive)
            .map((t) => (
              <DraggableShift
                key={t.id}
                id={t.id}
                label={displayShiftCode(t.code)}
                color={t.color}
              />
            ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMessage({
                type: "warning",
                text: "Click a cell, then choose Clear to remove a shift.",
              })
            }
          >
            Clear (via cell menu)
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white shadow-[var(--shadow-card)]">
          <table className="min-w-max text-xs">
            <thead>
              <tr className="bg-neutral-50">
                <th className="sticky left-0 z-10 bg-neutral-50 p-2 text-left font-medium text-black">
                  Doctor
                </th>
                <th className="sticky left-24 z-10 bg-neutral-50 p-2 font-medium text-black">
                  Hours
                </th>
                {monthKeys.map((k) => (
                  <th key={k} className="p-1 font-mono text-[10px]">
                    {k.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => {
                const hours = hoursMap.get(doc.id);
                return (
                  <tr key={doc.id}>
                    <td className="sticky left-0 z-10 bg-white p-2 font-medium whitespace-nowrap">
                      {doc.name}
                    </td>
                    <td className="sticky left-24 z-10 bg-white p-2">
                      <HourBar
                        worked={hours?.worked ?? 0}
                        target={hours?.target ?? doc.targetHours}
                      />
                    </td>
                    {monthKeys.map((dateStr) => (
                      <ScheduleCell
                        key={dateStr}
                        doctorId={doc.id}
                        dateStr={dateStr}
                        assignment={assignmentMap.get(
                          `${doc.id}__${dateStr}`,
                        )}
                        onClick={() =>
                          setPicker({ doctorId: doc.id, dateStr })
                        }
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DragOverlay>
          {activeType ? (
            <span
              className="rounded px-3 py-1.5 text-xs font-bold text-white"
              style={{ backgroundColor: activeType.color }}
            >
              {displayShiftCode(activeType.code)}
            </span>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {!readOnly ? (
      <>
      <Dialog open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign shift</DialogTitle>
            <DialogDescription>
              Choose a shift type or clear the assignment for this day.
            </DialogDescription>
          </DialogHeader>
          {picker && (
            <div className="flex flex-wrap gap-2">
              {shiftTypes
                .filter((t) => t.isActive)
                .map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    style={{ backgroundColor: t.color }}
                    onClick={() =>
                      handleAssign(picker.doctorId, picker.dateStr, t.id)
                    }
                  >
                    {displayShiftCode(t.code)}
                  </Button>
                ))}
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await clearShift({
                    doctorId: picker.doctorId,
                    dateStr: picker.dateStr,
                    year,
                    month,
                  });
                  setPicker(null);
                  router.refresh();
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!autoPreview} onOpenChange={(o) => !o && setAutoPreview(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auto-assign preview</DialogTitle>
            <DialogDescription>
              Review suggested assignments before applying them to the schedule.
            </DialogDescription>
          </DialogHeader>
          {autoPreview && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                {autoPreview.proposals.length} shift(s) suggested
                {autoPreview.swapCount > 0 &&
                  ` (${autoPreview.swapCount} rotation swap(s))`}
                {autoPreview.unfilled.length > 0 &&
                  ` · ${autoPreview.unfilled.length} understaffed slot(s)`}
              </p>
              {autoPreview.unfilled.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-red-800">
                    Understaffed
                  </p>
                  <ul className="space-y-1 text-sm text-red-700">
                    {autoPreview.unfilled.map((u, i) => (
                      <li key={i}>
                        {u.date} — {u.band === "L" ? "Day" : "Night"}: need{" "}
                        {u.needed}, have {u.assigned} (
                        {u.needed - u.assigned} short)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {autoPreview.proposals.slice(0, 50).map((p, i) => (
                  <li key={i}>
                    {doctors.find((d) => d.id === p.doctorId)?.name ?? p.doctorId}{" "}
                    — {p.date} — {displayShiftCode(p.shiftCode)}
                  </li>
                ))}
                {autoPreview.proposals.length > 50 && (
                  <li className="text-slate-500">…and more</li>
                )}
              </ul>
              {autoPreview.warnings.length > 0 && (
                <div className="max-h-24 overflow-y-auto text-xs text-amber-700">
                  {autoPreview.warnings.slice(0, 8).map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                  {autoPreview.warnings.length > 8 && (
                    <p>…and {autoPreview.warnings.length - 8} more</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={applySuggestions} disabled={loading}>
                  Apply suggestions
                </Button>
                <Button variant="outline" onClick={() => setAutoPreview(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </>
      ) : null}
    </div>
  );
}
