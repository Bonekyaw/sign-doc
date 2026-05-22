"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Star } from "lucide-react";
import {
  clearPublishedShift,
  listPublishedReplacementCandidates,
  previewReconcileScheduleFromDraft,
  reassignPublishedShift,
  saveScheduleMonth,
  unpublishScheduleMonth,
  validateShiftPreviewWithDraft,
} from "@/app/actions/schedule";
import {
  draftRowsToInput,
  proposalsToDraftRows,
  removeDraftRow,
  upsertManualDraftRow,
  manualDraftInputs,
  mergeReconcileIntoDraft,
  type DraftShiftRow,
} from "@/lib/scheduling/draft-helpers";
import { computeScheduleMetrics } from "@/lib/scheduling/schedule-metrics";
import {
  adminAssignableShiftTypes,
  isOffDayAssignment,
} from "@/lib/scheduling/admin-assignable-shifts";
import type { DoctorSeniority, ShiftCode } from "@/lib/scheduling/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { CoverageStrip } from "@/components/schedule/CoverageStrip";
import { HourBar } from "@/components/schedule/HourBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirmDialog } from "@/lib/hooks/use-confirm-dialog";
import { cn, displayShiftCode } from "@/lib/utils";
import { seniorityLabel } from "@/lib/utils/seniority";

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
  seniority?: DoctorSeniority;
};

type ShiftRow = {
  doctorId: string;
  date: string;
  shiftTypeId: string;
  code: string;
  color: string;
  label: string;
  source?: "MANUAL" | "AUTO";
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
    lHasSenior?: boolean;
    nHasSenior?: boolean;
  }[];
  hourSummary: HourRow[];
  readOnly?: boolean;
  publishedEditMode?: boolean;
  scheduleBasePath?: string;
  monthStatus?: "DRAFT" | "PUBLISHED";
  publishedAt?: Date | string | null;
  manualCount?: number;
  autoCount?: number;
  unpublishedMessage?: string;
  doctorPortal?: boolean;
  viewerDoctorId?: string;
  seniorRules?: {
    requireSeniorOnDayBand: boolean;
    requireSeniorOnNightBand: boolean;
  };
};

/** Sticky doctor/hours columns — left-36 on hours matches w-36 doctor width. */
const SCHEDULE_DOCTOR_COL_HEADER =
  "sticky left-0 z-20 w-36 min-w-36 max-w-36 bg-neutral-50 p-2 text-left font-medium text-black shadow-[1px_0_0_0] shadow-neutral-200/90";
const SCHEDULE_DOCTOR_COL_BODY =
  "sticky left-0 z-20 w-36 min-w-36 max-w-36 bg-white p-2 font-medium whitespace-nowrap shadow-[1px_0_0_0] shadow-neutral-200/90";
const SCHEDULE_HOURS_COL_HEADER =
  "sticky left-36 z-20 w-32 min-w-32 max-w-32 border-r border-neutral-200/90 bg-neutral-50 p-2 font-medium text-black shadow-[4px_0_8px_-4px_rgba(15,23,42,0.12)]";
const SCHEDULE_HOURS_COL_BODY =
  "sticky left-36 z-20 w-32 min-w-32 max-w-32 border-r border-neutral-200/90 bg-white p-2 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.12)]";

const SCHEDULE_TABLE_CLASS =
  "min-w-max border-separate border-spacing-x-1 border-spacing-y-0.5 text-xs";

const SCHEDULE_TABLE_WRAPPER =
  "overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white shadow-[var(--shadow-card)]";

const SCHEDULE_DATE_COL_HEADER =
  "min-w-[2rem] border border-neutral-200/80 bg-neutral-50 p-1.5 text-center font-mono text-[10px]";

const SCHEDULE_DATE_COL_BODY =
  "min-w-[2rem] border border-neutral-200/80 bg-white p-1.5 text-center";

function scheduleDateColumnThClass(isFirstDate = false): string {
  return cn(SCHEDULE_DATE_COL_HEADER, isFirstDate && "pl-2");
}

function scheduleDateColumnTdClass(extra?: string): string {
  return cn(SCHEDULE_DATE_COL_BODY, extra);
}

function editableCellTitle(
  assignment: ShiftRow | undefined,
  isSeniorDoctor: boolean,
): string | undefined {
  if (isOffDayAssignment(assignment)) {
    return "Off day — click to edit";
  }
  if (assignment && isSeniorDoctor) {
    return "Senior doctor on duty — click to edit";
  }
  if (assignment) {
    return "Click to edit shift";
  }
  return "Click to assign shift";
}

function scheduleCellTdClass(
  base: string,
  assignment: ShiftRow | undefined,
  isSeniorDoctor: boolean,
): string {
  if (isOffDayAssignment(assignment)) {
    return cn(base, "relative ring-2 ring-inset ring-slate-400 bg-white");
  }
  const seniorHighlight =
    isSeniorDoctor && assignment
      ? "bg-amber-50 ring-1 ring-inset ring-amber-200/80"
      : "";
  return cn(base, "relative", seniorHighlight);
}

function ScheduleCellContent({
  assignment,
  isSeniorDoctor = false,
  showSeniorStar = true,
}: {
  assignment?: ShiftRow;
  isSeniorDoctor?: boolean;
  showSeniorStar?: boolean;
}) {
  if (isOffDayAssignment(assignment)) {
    return null;
  }
  const showStar = showSeniorStar && isSeniorDoctor && !!assignment;
  return (
    <>
      {showStar ? (
        <Star
          className="pointer-events-none absolute top-0.5 right-0.5 size-3 fill-amber-400 text-amber-500"
          aria-hidden
        />
      ) : null}
      {assignment ? (
        <ShiftCellBadge assignment={assignment} />
      ) : (
        <span className="text-slate-300">·</span>
      )}
    </>
  );
}

function ShiftCellBadge({
  assignment,
}: {
  assignment: ShiftRow;
}) {
  const label = displayShiftCode(assignment.code);
  return (
    <span
      className={`inline-flex min-h-[1.375rem] min-w-[1.75rem] items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold leading-none text-white shadow-sm ${
        assignment.source === "MANUAL" ? "ring-2 ring-amber-400 ring-offset-1" : ""
      }`}
      style={{ backgroundColor: assignment.color }}
      title={
        assignment.source === "MANUAL"
          ? `${label} (manual)`
          : `${label} (auto)`
      }
    >
      {label}
    </span>
  );
}

function ReadOnlyScheduleCell({
  assignment,
  isSeniorDoctor = false,
  showSeniorStar = true,
  onClick,
}: {
  assignment?: ShiftRow;
  isSeniorDoctor?: boolean;
  showSeniorStar?: boolean;
  onClick?: () => void;
}) {
  return (
    <td
      onClick={onClick}
      title={
        onClick
          ? editableCellTitle(assignment, isSeniorDoctor)
          : isOffDayAssignment(assignment)
            ? "Off day"
            : isSeniorDoctor && assignment
              ? "Senior doctor on duty"
              : undefined
      }
      className={scheduleCellTdClass(
        scheduleDateColumnTdClass(
          onClick ? "cursor-pointer hover:bg-sky-50" : undefined,
        ),
        assignment,
        isSeniorDoctor,
      )}
    >
      <ScheduleCellContent
        assignment={assignment}
        isSeniorDoctor={isSeniorDoctor}
        showSeniorStar={showSeniorStar}
      />
    </td>
  );
}

function StaticEditableCell({
  assignment,
  isSeniorDoctor = false,
  onClick,
}: {
  assignment?: ShiftRow;
  isSeniorDoctor?: boolean;
  onClick: () => void;
}) {
  return (
    <td
      onClick={onClick}
      title={editableCellTitle(assignment, isSeniorDoctor)}
      className={scheduleCellTdClass(
        scheduleDateColumnTdClass("cursor-pointer"),
        assignment,
        isSeniorDoctor,
      )}
    >
      <ScheduleCellContent
        assignment={assignment}
        isSeniorDoctor={isSeniorDoctor}
      />
    </td>
  );
}

function DroppableScheduleCell({
  doctorId,
  dateStr,
  assignment,
  isSeniorDoctor = false,
  onClick,
}: {
  doctorId: string;
  dateStr: string;
  assignment?: ShiftRow;
  isSeniorDoctor?: boolean;
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
      title={editableCellTitle(assignment, isSeniorDoctor)}
      className={scheduleCellTdClass(
        cn(
          scheduleDateColumnTdClass("cursor-pointer"),
          isOver && "bg-sky-100 ring-2 ring-sky-400",
        ),
        assignment,
        isSeniorDoctor,
      )}
    >
      <ScheduleCellContent
        assignment={assignment}
        isSeniorDoctor={isSeniorDoctor}
      />
    </td>
  );
}

const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } };

function ScheduleRosterTable({
  doctorColumnLabel,
  monthKeys,
  doctors,
  hoursMap,
  viewerDoctorId,
  renderDateCell,
}: {
  doctorColumnLabel: string;
  monthKeys: string[];
  doctors: DoctorRow[];
  hoursMap: Map<string, HourRow>;
  viewerDoctorId?: string;
  renderDateCell: (doc: DoctorRow, dateStr: string) => React.ReactNode;
}) {
  return (
    <div className={SCHEDULE_TABLE_WRAPPER}>
      <table className={SCHEDULE_TABLE_CLASS}>
        <thead>
          <tr>
            <th className={SCHEDULE_DOCTOR_COL_HEADER}>{doctorColumnLabel}</th>
            <th className={SCHEDULE_HOURS_COL_HEADER}>Hours</th>
            {monthKeys.map((k, dateIndex) => (
              <th
                key={k}
                className={scheduleDateColumnThClass(dateIndex === 0)}
              >
                {k.slice(8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doctors.map((doc) => {
            const hours = hoursMap.get(doc.id);
            const isViewerRow = viewerDoctorId === doc.id;
            return (
              <tr
                key={doc.id}
                className={cn(isViewerRow && "bg-sky-50/70")}
              >
                <td
                  className={cn(
                    SCHEDULE_DOCTOR_COL_BODY,
                    isViewerRow && "font-semibold text-sky-950",
                  )}
                >
                  {doc.name}
                  {isViewerRow ? (
                    <span className="ml-1 text-[10px] font-normal text-sky-700">
                      (You)
                    </span>
                  ) : null}
                </td>
                <td className={SCHEDULE_HOURS_COL_BODY}>
                  <HourBar
                    worked={hours?.worked ?? 0}
                    target={hours?.target ?? doc.targetHours}
                  />
                </td>
                {monthKeys.map((dateStr) => (
                  <Fragment key={dateStr}>
                    {renderDateCell(doc, dateStr)}
                  </Fragment>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function draftAssignmentsMatch(
  a: DraftShiftRow[],
  b: ShiftRow[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.doctorId !== right.doctorId ||
      left.date !== right.date ||
      left.shiftTypeId !== right.shiftTypeId ||
      left.source !== right.source
    ) {
      return false;
    }
  }
  return true;
}

function DraggableShift({
  id,
  label,
  color,
  variant = "filled",
}: {
  id: string;
  label: string;
  color: string;
  variant?: "filled" | "outline";
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${id}`,
    data: { shiftTypeId: id },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "cursor-grab rounded px-3 py-1.5 text-xs font-semibold shadow-sm active:cursor-grabbing",
        variant === "outline"
          ? "border-2 border-slate-400 bg-white text-slate-700"
          : "text-white",
      )}
      style={
        variant === "filled"
          ? {
              backgroundColor: color,
              opacity: isDragging ? 0.5 : 1,
            }
          : { opacity: isDragging ? 0.5 : 1 }
      }
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
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
  publishedEditMode = false,
  scheduleBasePath = "/schedule",
  monthStatus = "DRAFT",
  publishedAt = null,
  manualCount = 0,
  autoCount = 0,
  unpublishedMessage,
  doctorPortal = false,
  viewerDoctorId,
  seniorRules = {
    requireSeniorOnDayBand: true,
    requireSeniorOnNightBand: true,
  },
}: Props) {
  const router = useRouter();
  const isPublished = monthStatus === "PUBLISHED";
  const isAdminSchedule = scheduleBasePath === "/schedule";
  const editable = !readOnly && isAdminSchedule && !publishedEditMode;
  const assignableShiftTypes = useMemo(
    () =>
      adminAssignableShiftTypes(shiftTypes, { adminSchedule: isAdminSchedule }),
    [shiftTypes, isAdminSchedule],
  );
  const useDraft = editable;
  const canEditPublished = publishedEditMode && isAdminSchedule;
  const [draftAssignments, setDraftAssignments] =
    useState<DraftShiftRow[]>(assignments);
  const [isDirty, setIsDirty] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState("");
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "error" | "warning" | "success";
    text: string;
  } | null>(null);
  const [picker, setPicker] = useState<{
    doctorId: string;
    dateStr: string;
  } | null>(null);
  const [autoAssignSummary, setAutoAssignSummary] = useState<{
    shiftCount: number;
    hourShortfalls: {
      doctorId: string;
      name: string;
      targetHours: number;
      worked: number;
      remaining: number;
    }[];
    warnings: string[];
    unfilledCount: number;
    removedViolationCount: number;
  } | null>(null);
  const [showAutoDetails, setShowAutoDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [replacementPicker, setReplacementPicker] = useState<{
    doctorId: string;
    doctorName: string;
    seniority: DoctorSeniority;
    dateStr: string;
    shiftTypeId: string;
    code: string;
  } | null>(null);
  const [replacementOptions, setReplacementOptions] = useState<
    {
      doctorId: string;
      name: string;
      mode: "replace" | "swap";
      theirShiftCode?: ShiftCode;
      warnings: string[];
    }[]
  >([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const { requestConfirm, confirmDialog, confirmLoading } = useConfirmDialog();

  const busy = loading || publishing || confirmLoading;

  useEffect(() => {
    setDndEnabled(true);
  }, []);

  const assignmentsRef = useRef(assignments);
  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  useEffect(() => {
    if (isDirty) return;
    setDraftAssignments((prev) => {
      const next = assignmentsRef.current;
      if (draftAssignmentsMatch(prev, next)) return prev;
      return next;
    });
  }, [assignments, isDirty]);

  const filteredDoctors = doctorFilter.trim()
    ? doctors.filter((d) =>
        d.name.toLowerCase().includes(doctorFilter.trim().toLowerCase()),
      )
    : doctors;

  const rosterDoctorColumnLabel =
    doctorFilter.trim() && filteredDoctors.length !== doctors.length
      ? `Doctor (${filteredDoctors.length}/${doctors.length})`
      : `Doctor (${filteredDoctors.length})`;

  const pointerSensor = useSensor(PointerSensor, POINTER_SENSOR_OPTIONS);
  const sensors = useSensors(pointerSensor);

  const displayAssignments = useDraft ? draftAssignments : assignments;

  const stableSeniorRules = useMemo(
    () => seniorRules,
    [seniorRules.requireSeniorOnDayBand, seniorRules.requireSeniorOnNightBand],
  );

  const liveMetrics = useMemo(() => {
    if (!useDraft) {
      return {
        coverageByDate,
        hourSummary,
        manualCount,
        autoCount,
      };
    }
    return computeScheduleMetrics({
      monthKeys,
      assignments: displayAssignments.map((a) => ({
        doctorId: a.doctorId,
        date: a.date,
        shiftCode: a.code as ShiftCode,
        durationHours:
          shiftTypes.find((t) => t.id === a.shiftTypeId)?.durationHours ?? 12,
        source: a.source,
      })),
      doctors: doctors.map((d) => ({
        id: d.id,
        name: d.name,
        seniority: d.seniority ?? "MID_LEVEL",
        targetHours: d.targetHours,
        restrictions: [],
      })),
      coverageTemplate: coverageByDate.map((c) => ({
        date: c.date,
        dayShiftTarget: c.dayShiftTarget,
        nightShiftTarget: c.nightShiftTarget,
      })),
      rules: stableSeniorRules,
    });
  }, [
    useDraft,
    displayAssignments,
    doctors,
    monthKeys,
    shiftTypes,
    coverageByDate,
    hourSummary,
    manualCount,
    autoCount,
    stableSeniorRules,
  ]);

  const assignmentMap = new Map(
    displayAssignments.map((a) => [`${a.doctorId}__${a.date}`, a]),
  );

  const hoursMap = new Map(
    liveMetrics.hourSummary.map((h) => [h.doctorId, h]),
  );

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

  useEffect(() => {
    if (!replacementPicker) {
      setReplacementOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingCandidates(true);
    listPublishedReplacementCandidates({
      year,
      month,
      dateStr: replacementPicker.dateStr,
      fromDoctorId: replacementPicker.doctorId,
    }).then((result) => {
      if (cancelled) return;
      setLoadingCandidates(false);
      if (!result.ok) {
        showMessage("error", result.errors ?? ["Could not load replacements."]);
        setReplacementOptions([]);
        return;
      }
      setReplacementOptions(result.options);
    });
    return () => {
      cancelled = true;
    };
  }, [replacementPicker, year, month, showMessage]);

  async function openReplacementPicker(
    doctorId: string,
    dateStr: string,
    assignment: ShiftRow,
  ) {
    const doc = doctors.find((d) => d.id === doctorId);
    setReplacementPicker({
      doctorId,
      doctorName: doc?.name ?? doctorId,
      seniority: doc?.seniority ?? "MID_LEVEL",
      dateStr,
      shiftTypeId: assignment.shiftTypeId,
      code: assignment.code,
    });
  }

  async function handlePublishedReassign(
    toDoctorId: string,
    mode: "replace" | "swap",
  ) {
    if (!replacementPicker) return;
    setLoading(true);
    const result = await reassignPublishedShift({
      year,
      month,
      dateStr: replacementPicker.dateStr,
      fromDoctorId: replacementPicker.doctorId,
      toDoctorId,
      mode,
    });
    setLoading(false);
    if (!result.ok) {
      showMessage("error", result.errors ?? ["Could not reassign shift."]);
      return;
    }
    setReplacementPicker(null);
    if (result.warnings?.length) showMessage("warning", result.warnings);
    else
      setMessage({ type: "success", text: "Shift updated. Doctors will see the change on My Schedule." });
    router.refresh();
  }

  async function runPublishedClear() {
    if (!replacementPicker) return;
    setLoading(true);
    const result = await clearPublishedShift({
      year,
      month,
      dateStr: replacementPicker.dateStr,
      doctorId: replacementPicker.doctorId,
    });
    setLoading(false);
    if (!result.ok) {
      showMessage("error", result.errors ?? ["Could not remove shift."]);
      return;
    }
    setReplacementPicker(null);
    if (result.warnings?.length) showMessage("warning", result.warnings);
    else setMessage({ type: "success", text: "Shift removed." });
    router.refresh();
  }

  function handlePublishedClear() {
    if (!replacementPicker) return;
    requestConfirm(
      {
        title: "Remove shift?",
        description: (
          <>
            Remove <strong>{replacementPicker.doctorName}</strong>&apos;s shift
            on <strong>{replacementPicker.dateStr}</strong>?
          </>
        ),
        confirmLabel: "Remove shift",
        variant: "destructive",
      },
      runPublishedClear,
    );
  }

  async function handleAssign(
    doctorId: string,
    dateStr: string,
    shiftTypeId: string,
  ) {
    const shiftType = shiftTypes.find((t) => t.id === shiftTypeId);
    if (!shiftType) return;

    setLoading(true);
    const nextDraft = upsertManualDraftRow(
      draftAssignments,
      doctorId,
      dateStr,
      shiftType,
    );
    const preview = await validateShiftPreviewWithDraft({
      doctorId,
      dateStr,
      shiftTypeId,
      year,
      month,
      draft: draftRowsToInput(nextDraft),
    });
    setLoading(false);
    if (!preview.ok) {
      showMessage("error", preview.errors);
      return;
    }
    setDraftAssignments(nextDraft);
    setIsDirty(true);
    if (preview.warnings?.length) showMessage("warning", preview.warnings);
    else
      setMessage({
        type: "success",
        text: "Shift updated in draft. Save month to persist.",
      });
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

  async function runAutoAssign() {
    setLoading(true);
    setAutoAssignSummary(null);
    const manualInputs = manualDraftInputs(draftAssignments);
    const result = await previewReconcileScheduleFromDraft(year, month, manualInputs);
    setLoading(false);
    if (!result.ok) {
      showMessage("error", result.errors ?? ["Cannot auto-assign."]);
      return;
    }
    const rows = mergeReconcileIntoDraft(draftAssignments, result.proposals, shiftTypes);
    if (rows.length === 0) {
      showMessage("error", [
        "Auto-assign could not place any shifts. Check scheduling rules, coverage targets, and doctor leave.",
      ]);
      return;
    }
    setDraftAssignments(rows);
    setIsDirty(true);
    setAutoAssignSummary({
      shiftCount: rows.length,
      hourShortfalls: result.hourShortfalls ?? [],
      warnings: result.warnings,
      unfilledCount: result.unfilled.length,
      removedViolationCount: result.removedViolationCount ?? 0,
    });
    setShowAutoDetails(false);
    if ((result.removedViolationCount ?? 0) > 0) {
      showMessage("warning", [
        `Removed ${result.removedViolationCount} shift(s) that violated main-flow rules.`,
      ]);
    } else if (result.hourShortfalls?.length) {
      showMessage("warning", [
        `${result.hourShortfalls.length} doctor(s) could not reach their monthly hour target. Save month will fail until all targets are met. See summary below.`,
      ]);
    } else {
      setMessage({
        type: "success",
        text: `Auto-assign complete: ${rows.length} total shifts. Save month to persist.`,
      });
    }
  }

  function handleResetDates() {
    requestConfirm(
      {
        title: "Clear all draft dates?",
        description:
          "This will remove all draft shifts from the grid. You can then assign manual anchors or auto-assign a fresh month.",
        confirmLabel: "Clear all",
        variant: "destructive",
      },
      async () => {
        setDraftAssignments([]);
        setIsDirty(true);
        setAutoAssignSummary(null);
        setMessage({
          type: "success",
          text: "Grid cleared. Assign manual shifts or auto-assign, then Save month to persist.",
        });
      }
    );
  }

  function handleAutoAssign() {
    requestConfirm(
      {
        title: "Auto-assign month?",
        description:
          "Rebuild the full month schedule toward each doctor's monthly hour target (240h / 120h / custom). Current draft shifts will be replaced.",
        confirmLabel: "Auto-assign",
      },
      runAutoAssign,
    );
  }

  async function runUnpublishToDraft() {
    setPublishing(true);
    const result = await unpublishScheduleMonth(year, month);
    setPublishing(false);
    if (!result.ok) {
      showMessage("error", result.errors ?? ["Could not return to draft."]);
      return;
    }
    setMessage({
      type: "success",
      text: "Month is draft again. Use Auto-assign month, edit, then Save month.",
    });
    router.refresh();
  }

  function handleUnpublishToDraft() {
    requestConfirm(
      {
        title: "Return to draft?",
        description:
          "Doctors will no longer see this month on My Schedule until you publish again.",
        confirmLabel: "Return to draft",
      },
      runUnpublishToDraft,
    );
  }

  async function runSaveMonth() {
    setPublishing(true);
    const result = await saveScheduleMonth({
      year,
      month,
      shifts: draftRowsToInput(draftAssignments),
      publish: true,
    });
    setPublishing(false);
    if (!result.ok) {
      showMessage("error", result.errors ?? ["Failed to save schedule."]);
      return;
    }
    setIsDirty(false);
    if (result.warnings?.length) showMessage("warning", result.warnings);
    else setMessage({ type: "success", text: "Schedule saved and published." });
    router.refresh();
  }

  function handleSaveMonth() {
    if (draftAssignments.length === 0) {
      showMessage("error", [
        "Nothing to publish — run Auto-assign month or assign shifts first.",
      ]);
      return;
    }
    requestConfirm(
      {
        title: "Save and publish?",
        description:
          "This month will be saved and published. Doctors will see it on My Schedule.",
        confirmLabel: "Save and publish",
      },
      runSaveMonth,
    );
  }

  const activeType = shiftTypes.find(
    (t) => t.id === activeShiftId?.replace("palette-", ""),
  );

  const monthTitle = format(new Date(Date.UTC(year, month - 1, 1)), "MMMM yyyy");

  if (doctorPortal && unpublishedMessage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={monthTitle}
          description="Published monthly duty roster"
        />
        <nav className="flex items-center gap-3 text-sm text-sky-700">
          <Link href={prevHref} className="hover:underline">
            ← Previous month
          </Link>
          <span className="text-neutral-300">|</span>
          <Link href={nextHref} className="hover:underline">
            Next month →
          </Link>
        </nav>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-10 text-center">
          <p className="text-base font-medium text-amber-950">
            {unpublishedMessage}
          </p>
          <p className="mt-2 text-sm text-amber-800">
            Check back after your administrator publishes this month&apos;s schedule.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={monthTitle}
        description={
          doctorPortal
            ? "Published monthly duty roster"
            : unpublishedMessage
              ? unpublishedMessage
              : readOnly
                ? "Your assigned shifts for this month"
                : canEditPublished
                  ? "Published — replace shifts with same-level colleagues only"
                  : isPublished
                    ? "Published — view only"
                    : "Edit in draft — nothing is saved until you click Save month"
        }
        actions={
          doctorPortal ? undefined : (
          <>
            {isAdminSchedule ? (
              <Badge
                className={
                  isPublished
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-700"
                }
              >
                {isPublished ? "Published" : "Draft"}
                {isPublished && publishedAt
                  ? ` · ${format(new Date(publishedAt), "MMM d")}`
                  : null}
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href={prevHref}>Previous</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={nextHref}>Next</Link>
            </Button>
            {isAdminSchedule ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/schedule/${year}/${month}/export`}>
                  Export Excel
                </a>
              </Button>
            ) : null}
            {editable ? (
              <>
                <Button variant="outline" size="sm" onClick={handleResetDates} disabled={busy}>
                  Reset dates
                </Button>
                <Button onClick={handleAutoAssign} disabled={busy}>
                  {loading ? "Loading…" : "Auto-assign month"}
                </Button>
                <Button
                  onClick={handleSaveMonth}
                  disabled={busy || isPublished}
                >
                  {publishing ? "Loading…" : "Save month"}
                </Button>
              </>
            ) : null}
            {canEditPublished ? (
              <Button
                variant="outline"
                onClick={handleUnpublishToDraft}
                disabled={busy}
              >
                {publishing ? "Loading…" : "Return to draft"}
              </Button>
            ) : null}
          </>
          )
        }
      />

      {doctorPortal ? (
        <nav className="flex items-center gap-3 text-sm text-sky-700">
          <Link href={prevHref} className="hover:underline">
            ← Previous month
          </Link>
          <span className="text-neutral-300">|</span>
          <Link href={nextHref} className="hover:underline">
            Next month →
          </Link>
        </nav>
      ) : null}

      {!doctorPortal && unpublishedMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unpublishedMessage}
        </div>
      ) : null}

      {canEditPublished && assignments.length === 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">This published month has no shifts saved.</p>
          <p className="mt-1">
            That usually happens after Save month with an empty grid. Click{" "}
            <strong>Return to draft</strong>, then <strong>Auto-assign month</strong>{" "}
            and <strong>Save month</strong> to fill the full roster.
          </p>
        </div>
      ) : null}

      {canEditPublished && assignments.length > 0 ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          Published schedule — click a doctor&apos;s assigned shift to hand it to
          another doctor of the same level (Senior / Mid-Level / Junior), or swap
          if they already work that day.
        </div>
      ) : null}

      {editable && isDirty ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          Unsaved draft — use Auto-assign month, edit cells, then Save month to
          write to the database and publish.
        </div>
      ) : null}

      {editable && (liveMetrics.manualCount > 0 || liveMetrics.autoCount > 0) ? (
        <p className="text-xs text-slate-500">
          {liveMetrics.manualCount} manual · {liveMetrics.autoCount} auto
          assignments (draft)
        </p>
      ) : null}

      {editable || canEditPublished ? (
        <Input
          placeholder="Filter doctors by name…"
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="max-w-xs"
        />
      ) : null}

      {!doctorPortal && (
      <p className="flex items-center gap-1.5 text-xs text-slate-600">
        <Star className="size-3 fill-amber-400 text-amber-500" aria-hidden />
        <span>Senior doctor on duty (assigned day cell)</span>
      </p>
      )}

      {loading && editable ? (
        <p className="text-sm font-medium text-sky-700">Auto-assigning…</p>
      ) : null}

      {editable && autoAssignSummary ? (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm">
          <p className="font-medium text-emerald-900">
            Auto-assign placed {autoAssignSummary.shiftCount} shifts (L / N /
            24) toward monthly hour targets.
            {autoAssignSummary.unfilledCount > 0
              ? ` ${autoAssignSummary.unfilledCount} day-band slot(s) still understaffed.`
              : null}
          </p>
          {autoAssignSummary.removedViolationCount > 0 ? (
            <p className="text-amber-800">
              Removed {autoAssignSummary.removedViolationCount} shift(s) that
              violated main-flow rules (fatigue, senior coverage, or off-day
              limits).
            </p>
          ) : null}
          {autoAssignSummary.hourShortfalls.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 font-semibold text-amber-900">
                Below monthly hour targets
              </p>
              <ul className="space-y-1 text-amber-800">
                {autoAssignSummary.hourShortfalls.map((s) => (
                  <li key={s.doctorId}>
                    {s.name}: {s.worked}h / {s.targetHours}h ({s.remaining}h
                    short)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {autoAssignSummary.warnings.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowAutoDetails((v) => !v)}
            >
              {showAutoDetails ? "Hide" : "Show"} warnings (
              {autoAssignSummary.warnings.length})
            </Button>
          ) : null}
          {showAutoDetails && autoAssignSummary.warnings.length > 0 ? (
            <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-amber-800">
              {autoAssignSummary.warnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {autoAssignSummary.warnings.length > 20 ? (
                <li>…and {autoAssignSummary.warnings.length - 20} more</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

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

      {editable || canEditPublished || doctorPortal ? (
        <CoverageStrip coverage={liveMetrics.coverageByDate} />
      ) : null}

      {readOnly && !canEditPublished ? (
        <ScheduleRosterTable
          doctorColumnLabel={rosterDoctorColumnLabel}
          monthKeys={monthKeys}
          doctors={filteredDoctors}
          hoursMap={hoursMap}
          viewerDoctorId={doctorPortal ? viewerDoctorId : undefined}
          renderDateCell={(doc, dateStr) => (
            <ReadOnlyScheduleCell
              assignment={assignmentMap.get(`${doc.id}__${dateStr}`)}
              isSeniorDoctor={doc.seniority === "SENIOR"}
              showSeniorStar={!doctorPortal}
            />
          )}
        />
      ) : canEditPublished ? (
        <ScheduleRosterTable
          doctorColumnLabel={rosterDoctorColumnLabel}
          monthKeys={monthKeys}
          doctors={filteredDoctors}
          hoursMap={hoursMap}
          renderDateCell={(doc, dateStr) => {
            const assignment = assignmentMap.get(`${doc.id}__${dateStr}`);
            return (
              <ReadOnlyScheduleCell
                assignment={assignment}
                isSeniorDoctor={doc.seniority === "SENIOR"}
                onClick={
                  assignment
                    ? () =>
                        openReplacementPicker(doc.id, dateStr, assignment)
                    : undefined
                }
              />
            );
          }}
        />
      ) : editable ? (
        dndEnabled ? (
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
              {assignableShiftTypes.map((t) => (
                  <DraggableShift
                    key={t.id}
                    id={t.id}
                    label={t.code === "OFF" ? "Off" : displayShiftCode(t.code)}
                    color={t.color}
                    variant={t.code === "OFF" ? "outline" : "filled"}
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

            <ScheduleRosterTable
              doctorColumnLabel={rosterDoctorColumnLabel}
              monthKeys={monthKeys}
              doctors={filteredDoctors}
              hoursMap={hoursMap}
              renderDateCell={(doc, dateStr) => (
                <DroppableScheduleCell
                  doctorId={doc.id}
                  dateStr={dateStr}
                  assignment={assignmentMap.get(`${doc.id}__${dateStr}`)}
                  isSeniorDoctor={doc.seniority === "SENIOR"}
                  onClick={() => setPicker({ doctorId: doc.id, dateStr })}
                />
              )}
            />

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
        ) : (
          <>
            <div className="sticky top-0 z-10 flex flex-wrap gap-2 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[var(--shadow-card)]">
              <span className="self-center text-xs font-medium text-slate-500">
                Drag onto grid:
              </span>
              {shiftTypes
                .filter((t) => t.isActive)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="rounded px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: t.color }}
                  >
                    {displayShiftCode(t.code)}
                  </button>
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

            <ScheduleRosterTable
              doctorColumnLabel={rosterDoctorColumnLabel}
              monthKeys={monthKeys}
              doctors={filteredDoctors}
              hoursMap={hoursMap}
              renderDateCell={(doc, dateStr) => (
                <StaticEditableCell
                  assignment={assignmentMap.get(`${doc.id}__${dateStr}`)}
                  isSeniorDoctor={doc.seniority === "SENIOR"}
                  onClick={() => setPicker({ doctorId: doc.id, dateStr })}
                />
              )}
            />
          </>
        )
      ) : null}

      {canEditPublished ? (
        <Dialog
          open={!!replacementPicker}
          onOpenChange={(o) => !o && setReplacementPicker(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Replace shift</DialogTitle>
              <DialogDescription>
                {replacementPicker
                  ? `${replacementPicker.doctorName} (${seniorityLabel(replacementPicker.seniority)}) — ${replacementPicker.dateStr} — ${displayShiftCode(replacementPicker.code)}`
                  : null}
              </DialogDescription>
            </DialogHeader>
            {replacementPicker ? (
              <div className="space-y-4">
                {loadingCandidates ? (
                  <p className="text-sm text-slate-500">
                    Finding same-level colleagues…
                  </p>
                ) : replacementOptions.length === 0 ? (
                  <p className="text-sm text-amber-800">
                    No eligible same-level colleague for this shift. Try removing
                    the shift or adjust leave/rules.
                  </p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto">
                    {replacementOptions.map((opt) => (
                      <li key={`${opt.doctorId}-${opt.mode}`}>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-auto w-full justify-start py-2 text-left"
                          disabled={busy}
                          onClick={() =>
                            handlePublishedReassign(opt.doctorId, opt.mode)
                          }
                        >
                          <span className="font-medium">
                            {loading ? "Loading…" : opt.name}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">
                            {opt.mode === "replace"
                              ? "Take this shift"
                              : `Swap (${displayShiftCode(opt.theirShiftCode ?? "L")} ↔ ${displayShiftCode(replacementPicker.code)})`}
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={handlePublishedClear}
                  >
                    {loading || confirmLoading ? "Loading…" : "Remove shift"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setReplacementPicker(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {editable && !doctorPortal ? (
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
              {assignableShiftTypes.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={t.code === "OFF" ? "outline" : "default"}
                    className={
                      t.code === "OFF"
                        ? "border-2 border-slate-400 bg-white text-slate-700 hover:bg-slate-50"
                        : undefined
                    }
                    style={
                      t.code === "OFF" ? undefined : { backgroundColor: t.color }
                    }
                    disabled={busy}
                    onClick={() =>
                      handleAssign(picker.doctorId, picker.dateStr, t.id)
                    }
                  >
                    {loading
                      ? "Loading…"
                      : t.code === "OFF"
                        ? "Off"
                        : displayShiftCode(t.code)}
                  </Button>
                ))}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDraftAssignments(
                    removeDraftRow(
                      draftAssignments,
                      picker.doctorId,
                      picker.dateStr,
                    ),
                  );
                  setIsDirty(true);
                  setPicker(null);
                  setMessage({
                    type: "success",
                    text: "Shift cleared in draft. Save month to persist.",
                  });
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      </>
      ) : null}

      {confirmDialog}
    </div>
  );
}
