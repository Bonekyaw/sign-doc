"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { scheduleTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";
import {
  getCoverageForDate,
  getDailyCoverageOverrides,
  getMonthCoverageDefaults,
  loadApprovedLeave,
  loadDoctors,
  loadDoctorRotations,
  loadMainFlowSchedulingRules,
  loadShiftTypes,
  monthDateRange,
  shiftCodeFromId,
} from "@/lib/scheduling/context";
import { dateKey, getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import {
  assertMonthEditable,
  assertMonthPublished,
  getMonthScheduleMeta,
  getMonthScheduleStatus,
  getOrCreateMonthSchedule,
  MonthNotEditableError,
  MonthNotPublishedError,
  publishMonthSchedule,
} from "@/lib/scheduling/month-schedule";
import {
  findSameSeniorityReplacementOptions,
  validatePublishedReassignment,
} from "@/lib/scheduling/published-replacement";
import {
  clearPublishedShiftSchema,
  publishedReplacementQuerySchema,
  reassignPublishedShiftSchema,
} from "@/lib/schemas/published-replacement";
import {
  loadManualShiftsForMonth,
  loadReconcileContext,
  previewReconcileFromManualShifts,
  previewReconcileMonth,
  reconcileMonthSchedule,
  upsertAutoProposals,
} from "@/lib/scheduling/reconcile-month";
import {
  draftToShiftAssignments,
  type DraftAssignmentInput,
} from "@/lib/scheduling/schedule-metrics";
import {
  draftShiftSchema,
  saveScheduleMonthSchema,
  type DraftShiftInput,
} from "@/lib/schemas/schedule-draft";
import type { AutoAssignProposal } from "@/lib/scheduling/auto-assign";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import { coverageSeniorFlags } from "@/lib/scheduling/validate-senior-manpower";
import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import { filterCompliantProposals } from "@/lib/scheduling/filter-compliant-proposals";
import { validateAssignment } from "@/lib/scheduling/validate-assignment";
import { validateShiftsAgainstMainFlow } from "@/lib/scheduling/validate-main-flow";
import type { ShiftAssignment, ShiftCode } from "@/lib/scheduling/types";
import {
  requireAdminRead,
  requireDoctor,
  requireWrite,
} from "@/lib/auth/guards";

function revalidateSchedule(year: number, month: number) {
  revalidatePath(`/schedule/${year}/${month}`);
  revalidatePath("/schedule");
  revalidatePath("/my-schedule");
  revalidatePath("/");
  revalidateTag(scheduleTag(year, month), "max");
}

async function getMonthScheduleInternal(year: number, month: number) {
  const monthKeys = getMonthDateKeys(year, month);
  const { start, end } = monthDateRange(year, month);

  const [doctors, shiftTypes, shiftRows, monthDefaults, dailyOverrides, rules, monthSchedule] =
    await Promise.all([
      loadDoctors(),
      loadShiftTypes(),
      prisma.shift.findMany({
        where: { date: { gte: start, lte: end } },
        include: { shiftType: true, doctor: true },
      }),
      getMonthCoverageDefaults(year, month),
      getDailyCoverageOverrides(year, month),
      loadMainFlowSchedulingRules(),
      getOrCreateMonthSchedule(year, month),
    ]);

  const shifts = shiftRows.map((s) => ({
    doctorId: s.doctorId,
    date: s.date,
    shiftCode: s.shiftType.code as ShiftCode,
    durationHours: s.shiftType.durationHours,
    source: s.source,
  }));

  const dates = monthKeys.map(parseDateKey);
  const doctorsById = new Map(doctors.map((d) => [d.id, d]));

  const coverageByDate = monthKeys.map((key) => {
    const target = dailyOverrides.get(key) ?? monthDefaults;
    const date = parseDateKey(key);
    const lCount = countBandForDate(date, "L", shifts);
    const nCount = countBandForDate(date, "N", shifts);
    const senior = coverageSeniorFlags(date, shifts, doctorsById, rules);
    return {
      date: key,
      dayShiftTarget: target.dayShiftTarget,
      nightShiftTarget: target.nightShiftTarget,
      lCount,
      nCount,
      lHasSenior: senior.lHasSenior,
      nHasSenior: senior.nHasSenior,
    };
  });

  const hourSummary = doctors.map((d) => ({
    doctorId: d.id,
    worked: computeMonthlyHours(d.id, monthKeys, shifts),
    target: d.targetHours,
  }));

  const manualCount = shifts.filter((s) => s.source === "MANUAL").length;
  const autoCount = shifts.filter((s) => s.source === "AUTO").length;

  return {
    year,
    month,
    doctors,
    shiftTypes,
    shifts,
    shiftRows,
    monthKeys,
    dates,
    monthDefaults,
    coverageByDate,
    hourSummary,
    monthStatus: monthSchedule.status,
    publishedAt: monthSchedule.publishedAt,
    manualCount,
    autoCount,
  };
}

export async function getMonthSchedule(year: number, month: number) {
  await requireAdminRead();
  return getMonthScheduleInternal(year, month);
}

export async function getMyMonthSchedule(year: number, month: number) {
  const session = await requireDoctor();
  const meta = await getMonthScheduleMeta(year, month);

  if (meta.status !== "PUBLISHED") {
    const shiftTypes = await loadShiftTypes();
    return {
      year,
      month,
      published: false as const,
      message: "This month's schedule has not been published yet.",
      doctors: [] as Awaited<ReturnType<typeof loadDoctors>>,
      shiftTypes,
      shifts: [],
      shiftRows: [],
      monthKeys: getMonthDateKeys(year, month),
      dates: getMonthDateKeys(year, month).map(parseDateKey),
      monthDefaults: await getMonthCoverageDefaults(year, month),
      coverageByDate: [] as Awaited<
        ReturnType<typeof getMonthScheduleInternal>
      >["coverageByDate"],
      hourSummary: [] as { doctorId: string; worked: number; target: number }[],
      monthStatus: meta.status,
      publishedAt: meta.publishedAt,
      manualCount: 0,
      autoCount: 0,
    };
  }

  const data = await getMonthScheduleInternal(year, month);
  const doctor = data.doctors.find((d) => d.id === session.doctorId);
  if (!doctor) {
    throw new Error("Linked doctor record not found.");
  }

  return {
    ...data,
    published: true as const,
    message: null,
    viewerDoctorId: session.doctorId,
  };
}

export async function assignShift(data: {
  doctorId: string;
  dateStr: string;
  shiftTypeId: string;
  year: number;
  month: number;
}) {
  await requireWrite();
  const { doctorId, dateStr, shiftTypeId, year, month } = data;

  try {
    await assertMonthEditable(year, month);
  } catch (e) {
    if (e instanceof MonthNotEditableError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }

  const date = parseDateKey(dateStr);
  const [doctors, shiftTypes, existingShifts, coverageTarget, rules] =
    await Promise.all([
      loadDoctors(),
      loadShiftTypes(),
      prisma.shift.findMany({
        where: { date: { gte: monthDateRange(year, month).start, lte: monthDateRange(year, month).end } },
        include: { shiftType: true },
      }).then((rows) =>
        rows.map((s) => ({
          doctorId: s.doctorId,
          date: s.date,
          shiftCode: s.shiftType.code as ShiftCode,
          durationHours: s.shiftType.durationHours,
          source: s.source,
        })),
      ),
      getCoverageForDate(year, month, date),
      loadMainFlowSchedulingRules(),
    ]);

  const doctor = doctors.find((d) => d.id === doctorId);
  const shiftCode = shiftCodeFromId(shiftTypes, shiftTypeId);
  if (!doctor || !shiftCode) {
    return { ok: false as const, errors: ["Invalid doctor or shift type."] };
  }

  const monthKeys = getMonthDateKeys(year, month);
  const result = validateAssignment({
    doctor,
    date,
    shiftCode,
    shiftTypes,
    existingShifts,
    monthKeys,
    coverageTarget,
    doctors,
    rules,
    purpose: "manualEdit",
  });

  if (!result.ok) {
    return { ok: false as const, errors: result.errors, warnings: result.warnings };
  }

  await prisma.shift.upsert({
    where: { doctorId_date: { doctorId, date } },
    create: { doctorId, date, shiftTypeId, source: "MANUAL" },
    update: { shiftTypeId, source: "MANUAL" },
  });

  const reconcile = await reconcileMonthSchedule(year, month);
  revalidateSchedule(year, month);

  return {
    ok: true as const,
    warnings: [...(result.warnings ?? []), ...reconcile.warnings],
    reconciled: true,
  };
}

async function loadMonthShiftAssignments(year: number, month: number) {
  const { start, end } = monthDateRange(year, month);
  const rows = await prisma.shift.findMany({
    where: { date: { gte: start, lte: end } },
    include: { shiftType: true },
  });
  return rows.map((s) => ({
    doctorId: s.doctorId,
    date: s.date,
    shiftCode: s.shiftType.code as ShiftCode,
    durationHours: s.shiftType.durationHours,
    source: s.source,
  }));
}

export async function listPublishedReplacementCandidates(
  data: z.infer<typeof publishedReplacementQuerySchema>,
) {
  await requireWrite();
  const parsed = publishedReplacementQuerySchema.parse(data);

  try {
    await assertMonthPublished(parsed.year, parsed.month);
  } catch (e) {
    if (e instanceof MonthNotPublishedError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }

  const date = parseDateKey(parsed.dateStr);
  const [doctors, shiftTypes, shifts, coverageTarget, rules, leaveByDoctor] =
    await Promise.all([
      loadDoctors(),
      loadShiftTypes(),
      loadMonthShiftAssignments(parsed.year, parsed.month),
      getCoverageForDate(parsed.year, parsed.month, date),
      loadMainFlowSchedulingRules(),
      loadApprovedLeave(parsed.year, parsed.month),
    ]);

  const fromDoctor = doctors.find((d) => d.id === parsed.fromDoctorId);
  if (!fromDoctor) {
    return { ok: false as const, errors: ["Doctor not found."] };
  }

  const result = findSameSeniorityReplacementOptions({
    doctors,
    shifts,
    dateStr: parsed.dateStr,
    fromDoctorId: parsed.fromDoctorId,
    shiftTypes,
    monthKeys: getMonthDateKeys(parsed.year, parsed.month),
    coverageTarget,
    leaveByDoctor,
    rules,
  });

  if (!result.ok) {
    return { ok: false as const, errors: [result.error] };
  }

  return {
    ok: true as const,
    fromDoctor: {
      id: fromDoctor.id,
      name: fromDoctor.name,
      seniority: fromDoctor.seniority,
    },
    options: result.options,
  };
}

export async function reassignPublishedShift(
  data: z.infer<typeof reassignPublishedShiftSchema>,
) {
  await requireWrite();
  const parsed = reassignPublishedShiftSchema.parse(data);

  try {
    await assertMonthPublished(parsed.year, parsed.month);
  } catch (e) {
    if (e instanceof MonthNotPublishedError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }

  const date = parseDateKey(parsed.dateStr);
  const [doctors, shiftTypes, shifts, coverageTarget, rules, leaveByDoctor] =
    await Promise.all([
      loadDoctors(),
      loadShiftTypes(),
      loadMonthShiftAssignments(parsed.year, parsed.month),
      getCoverageForDate(parsed.year, parsed.month, date),
      loadMainFlowSchedulingRules(),
      loadApprovedLeave(parsed.year, parsed.month),
    ]);

  const validation = validatePublishedReassignment({
    doctors,
    shifts,
    dateStr: parsed.dateStr,
    fromDoctorId: parsed.fromDoctorId,
    toDoctorId: parsed.toDoctorId,
    mode: parsed.mode,
    shiftTypes,
    monthKeys: getMonthDateKeys(parsed.year, parsed.month),
    coverageTarget,
    leaveByDoctor,
    rules,
  });

  if (!validation.ok) {
    return { ok: false as const, errors: validation.errors };
  }

  const outgoing = shifts.find(
    (s) =>
      s.doctorId === parsed.fromDoctorId && dateKey(s.date) === parsed.dateStr,
  );
  if (!outgoing) {
    return { ok: false as const, errors: ["No shift to reassign on that date."] };
  }

  const outgoingType = shiftTypes.find((t) => t.code === outgoing.shiftCode);
  const toDoctor = doctors.find((d) => d.id === parsed.toDoctorId);
  if (!outgoingType || !toDoctor) {
    return { ok: false as const, errors: ["Invalid doctor or shift type."] };
  }

  if (parsed.mode === "replace") {
    await prisma.$transaction([
      prisma.shift.deleteMany({
        where: { doctorId: parsed.fromDoctorId, date },
      }),
      prisma.shift.upsert({
        where: {
          doctorId_date: { doctorId: parsed.toDoctorId, date },
        },
        create: {
          doctorId: parsed.toDoctorId,
          date,
          shiftTypeId: outgoingType.id,
          source: "MANUAL",
        },
        update: {
          shiftTypeId: outgoingType.id,
          source: "MANUAL",
        },
      }),
    ]);
  } else {
    const theirShift = shifts.find(
      (s) =>
        s.doctorId === parsed.toDoctorId &&
        dateKey(s.date) === parsed.dateStr,
    );
    if (!theirShift) {
      return {
        ok: false as const,
        errors: ["Swap requires the colleague to already have a shift that day."],
      };
    }
    const theirType = shiftTypes.find((t) => t.code === theirShift.shiftCode);
    if (!theirType) {
      return { ok: false as const, errors: ["Invalid shift type for swap."] };
    }

    await prisma.$transaction([
      prisma.shift.update({
        where: {
          doctorId_date: { doctorId: parsed.toDoctorId, date },
        },
        data: { shiftTypeId: outgoingType.id, source: "MANUAL" },
      }),
      prisma.shift.update({
        where: {
          doctorId_date: { doctorId: parsed.fromDoctorId, date },
        },
        data: { shiftTypeId: theirType.id, source: "MANUAL" },
      }),
    ]);
  }

  revalidateSchedule(parsed.year, parsed.month);
  return { ok: true as const, warnings: validation.warnings };
}

export async function clearPublishedShift(
  data: z.infer<typeof clearPublishedShiftSchema>,
) {
  await requireWrite();
  const parsed = clearPublishedShiftSchema.parse(data);

  try {
    await assertMonthPublished(parsed.year, parsed.month);
  } catch (e) {
    if (e instanceof MonthNotPublishedError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }

  const date = parseDateKey(parsed.dateStr);
  const deleted = await prisma.shift.deleteMany({
    where: { doctorId: parsed.doctorId, date },
  });

  if (deleted.count === 0) {
    return { ok: false as const, errors: ["No shift to remove on that date."] };
  }

  revalidateSchedule(parsed.year, parsed.month);
  return {
    ok: true as const,
    warnings: [
      "Shift removed. Coverage may be understaffed until you assign a same-level replacement.",
    ],
  };
}

export async function clearShift(data: {
  doctorId: string;
  dateStr: string;
  year: number;
  month: number;
}) {
  await requireWrite();

  try {
    await assertMonthEditable(data.year, data.month);
  } catch (e) {
    if (e instanceof MonthNotEditableError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }

  const date = parseDateKey(data.dateStr);
  await prisma.shift.deleteMany({
    where: { doctorId: data.doctorId, date },
  });

  const reconcile = await reconcileMonthSchedule(data.year, data.month);
  revalidateSchedule(data.year, data.month);

  return { ok: true as const, warnings: reconcile.warnings };
}

export async function validateShiftPreview(data: {
  doctorId: string;
  dateStr: string;
  shiftTypeId: string;
  year: number;
  month: number;
}) {
  await requireWrite();
  const date = parseDateKey(data.dateStr);
  const { start, end } = monthDateRange(data.year, data.month);
  const [doctors, shiftTypes, existingShifts, coverageTarget, rules] =
    await Promise.all([
      loadDoctors(),
      loadShiftTypes(),
      prisma.shift.findMany({
        where: { date: { gte: start, lte: end } },
        include: { shiftType: true },
      }).then((rows) =>
        rows.map((s) => ({
          doctorId: s.doctorId,
          date: s.date,
          shiftCode: s.shiftType.code as ShiftCode,
          durationHours: s.shiftType.durationHours,
          source: s.source,
        })),
      ),
      getCoverageForDate(data.year, data.month, date),
      loadMainFlowSchedulingRules(),
    ]);

  const doctor = doctors.find((d) => d.id === data.doctorId);
  const shiftCode = shiftCodeFromId(shiftTypes, data.shiftTypeId);
  if (!doctor || !shiftCode) {
    return { ok: false, errors: ["Invalid selection."], warnings: [] };
  }

  return validateAssignment({
    doctor,
    date,
    shiftCode,
    shiftTypes,
    existingShifts,
    monthKeys: getMonthDateKeys(data.year, data.month),
    coverageTarget,
    doctors,
    rules,
    purpose: "manualEdit",
  });
}

export async function previewReconcileSchedule(year: number, month: number) {
  await requireWrite();
  try {
    await assertMonthEditable(year, month);
  } catch (e) {
    if (e instanceof MonthNotEditableError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }
  const preview = await previewReconcileMonth(year, month);
  return { ok: true as const, ...preview };
}

export async function applyReconcileSchedule(
  year: number,
  month: number,
  proposals: AutoAssignProposal[],
) {
  await requireWrite();
  try {
    await assertMonthEditable(year, month);
  } catch (e) {
    if (e instanceof MonthNotEditableError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }

  const ctx = await loadReconcileContext(year, month);
  const manualShifts = await loadManualShiftsForMonth(year, month);
  const monthKeys = getMonthDateKeys(year, month);
  const getCoverageForDateKey = (key: string) =>
    ctx.dailyOverrides.get(key) ?? ctx.monthDefaults;

  const { proposals: compliant, droppedCount } = filterCompliantProposals({
    proposals,
    baseShifts: manualShifts,
    doctors: ctx.doctors,
    shiftTypes: ctx.shiftTypes,
    monthKeys,
    getCoverageForDateKey,
    rules: ctx.rules,
  });

  if (proposals.length > 0 && compliant.length === 0) {
    return {
      ok: false as const,
      errors: [
        "No auto-assign proposals comply with main-flow rules. Adjust coverage, leave, or manual anchors and try again.",
      ],
    };
  }

  const { start, end } = monthDateRange(year, month);
  await prisma.shift.deleteMany({
    where: { date: { gte: start, lte: end }, source: "AUTO" },
  });

  await upsertAutoProposals(compliant);

  revalidateSchedule(year, month);
  return {
    ok: true as const,
    ...(droppedCount > 0
      ? {
          warnings: [
            `Removed ${droppedCount} auto-assign shift(s) that violated main-flow rules.`,
          ],
        }
      : {}),
  };
}

/** Full month auto-assign: delete AUTO, re-fill from MANUAL anchors. */
export async function autoAssignMonth(year: number, month: number) {
  await requireWrite();
  try {
    await assertMonthEditable(year, month);
  } catch (e) {
    if (e instanceof MonthNotEditableError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }
  const result = await reconcileMonthSchedule(year, month);
  revalidateSchedule(year, month);
  return { ok: true as const, ...result };
}

function draftShiftsToAssignments(
  draft: DraftShiftInput[],
  shiftTypes: Awaited<ReturnType<typeof loadShiftTypes>>,
): DraftAssignmentInput[] {
  return draft.map((row) => {
    const shiftCode = shiftCodeFromId(shiftTypes, row.shiftTypeId);
    if (!shiftCode) {
      throw new Error("Invalid shift type in draft.");
    }
    const config = shiftTypes.find((t) => t.id === row.shiftTypeId)!;
    return {
      doctorId: row.doctorId,
      date: row.dateStr,
      shiftCode,
      durationHours: config.durationHours,
      source: row.source,
    };
  });
}

function manualShiftsFromDraft(
  draft: DraftShiftInput[],
  shiftTypes: Awaited<ReturnType<typeof loadShiftTypes>>,
): ShiftAssignment[] {
  const rows = draftShiftsToAssignments(draft, shiftTypes).filter(
    (r) => r.source === "MANUAL",
  );
  return draftToShiftAssignments(rows).map((s) => ({
    ...s,
    source: "MANUAL" as const,
  }));
}

function allShiftsFromDraft(
  draft: DraftShiftInput[],
  shiftTypes: Awaited<ReturnType<typeof loadShiftTypes>>,
): ShiftAssignment[] {
  return draftToShiftAssignments(draftShiftsToAssignments(draft, shiftTypes));
}

export async function validateShiftPreviewWithDraft(data: {
  doctorId: string;
  dateStr: string;
  shiftTypeId: string;
  year: number;
  month: number;
  draft: DraftShiftInput[];
}) {
  await requireWrite();
  const parsed = z.array(draftShiftSchema).parse(data.draft);
  const date = parseDateKey(data.dateStr);
  const [doctors, shiftTypes, coverageTarget, rules] = await Promise.all([
    loadDoctors(),
    loadShiftTypes(),
    getCoverageForDate(data.year, data.month, date),
    loadMainFlowSchedulingRules(),
  ]);

  const existingShifts = allShiftsFromDraft(parsed, shiftTypes);
  const doctor = doctors.find((d) => d.id === data.doctorId);
  const shiftCode = shiftCodeFromId(shiftTypes, data.shiftTypeId);
  if (!doctor || !shiftCode) {
    return { ok: false, errors: ["Invalid selection."], warnings: [] };
  }

  return validateAssignment({
    doctor,
    date,
    shiftCode,
    shiftTypes,
    existingShifts,
    monthKeys: getMonthDateKeys(data.year, data.month),
    coverageTarget,
    doctors,
    rules,
    purpose: "manualEdit",
  });
}

export async function previewReconcileScheduleFromDraft(
  year: number,
  month: number,
  draft: DraftShiftInput[],
) {
  await requireWrite();
  try {
    await assertMonthEditable(year, month);
  } catch (e) {
    if (e instanceof MonthNotEditableError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }

  const parsed = z.array(draftShiftSchema).parse(draft);
  const [ctx, shiftTypes] = await Promise.all([
    loadReconcileContext(year, month),
    loadShiftTypes(),
  ]);
  const manualShifts = manualShiftsFromDraft(parsed, shiftTypes);
  const preview = previewReconcileFromManualShifts(ctx, manualShifts);
  return { ok: true as const, ...preview };
}

export async function saveScheduleMonth(data: {
  year: number;
  month: number;
  shifts: DraftShiftInput[];
  publish: boolean;
}) {
  const session = await requireWrite();
  const parsed = saveScheduleMonthSchema.parse(data);

  try {
    await assertMonthEditable(parsed.year, parsed.month);
  } catch (e) {
    if (e instanceof MonthNotEditableError) {
      return { ok: false as const, errors: [e.message] };
    }
    throw e;
  }

  const { start, end } = monthDateRange(parsed.year, parsed.month);
  const shiftTypes = await loadShiftTypes();

  for (const row of parsed.shifts) {
    if (!shiftCodeFromId(shiftTypes, row.shiftTypeId)) {
      return { ok: false as const, errors: ["Invalid shift type in schedule."] };
    }
  }

  if (data.publish && parsed.shifts.length === 0) {
    return {
      ok: false as const,
      errors: [
        "Cannot publish an empty month. Use Auto-assign month or assign shifts in the grid, then Save month.",
      ],
    };
  }

  const [doctors, rules] = await Promise.all([
    loadDoctors(),
    loadMainFlowSchedulingRules(),
  ]);
  const shifts = allShiftsFromDraft(parsed.shifts, shiftTypes);
  const mainFlowViolations = validateShiftsAgainstMainFlow({
    year: parsed.year,
    month: parsed.month,
    doctors,
    shifts,
    rules,
    requireMonthlyHourTargets: true,
  });
  if (mainFlowViolations.length > 0) {
    const head = data.publish
      ? "Cannot publish until main-flow rules are satisfied:"
      : "Cannot save until main-flow rules are satisfied:";
    return {
      ok: false as const,
      errors: [
        head,
        ...mainFlowViolations.slice(0, 15),
        ...(mainFlowViolations.length > 15
          ? [`…and ${mainFlowViolations.length - 15} more violation(s).`]
          : []),
      ],
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.shift.deleteMany({
      where: { date: { gte: start, lte: end } },
    });
    if (parsed.shifts.length > 0) {
      await tx.shift.createMany({
        data: parsed.shifts.map((row) => ({
          doctorId: row.doctorId,
          date: parseDateKey(row.dateStr),
          shiftTypeId: row.shiftTypeId,
          source: row.source,
        })),
      });
    }
    if (data.publish) {
      await tx.monthSchedule.upsert({
        where: { year_month: { year: parsed.year, month: parsed.month } },
        create: {
          year: parsed.year,
          month: parsed.month,
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedBy: session.id,
        },
        update: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedBy: session.id,
        },
      });
    } else {
      await tx.monthSchedule.upsert({
        where: { year_month: { year: parsed.year, month: parsed.month } },
        create: { year: parsed.year, month: parsed.month, status: "DRAFT" },
        update: {},
      });
    }
  });

  const saved = await getMonthScheduleInternal(parsed.year, parsed.month);
  const understaffed = saved.coverageByDate.filter(
    (c) =>
      c.lCount < c.dayShiftTarget || c.nCount < c.nightShiftTarget,
  );

  revalidateSchedule(parsed.year, parsed.month);

  return {
    ok: true as const,
    warnings:
      data.publish && understaffed.length > 0
        ? [
            `${understaffed.length} day(s) are still understaffed. Schedule published anyway.`,
          ]
        : [],
  };
}

export async function unpublishScheduleMonth(year: number, month: number) {
  await requireWrite();

  const row = await getMonthScheduleStatus(year, month);
  if (row?.status !== "PUBLISHED") {
    return {
      ok: false as const,
      errors: ["Only a published month can be returned to draft."],
    };
  }

  await prisma.monthSchedule.update({
    where: { year_month: { year, month } },
    data: {
      status: "DRAFT",
      publishedAt: null,
      publishedBy: null,
    },
  });

  revalidateSchedule(year, month);
  return { ok: true as const };
}

export async function publishScheduleMonth(year: number, month: number) {
  const session = await requireWrite();
  const data = await getMonthScheduleInternal(year, month);
  const understaffed = data.coverageByDate.filter(
    (c) =>
      c.lCount < c.dayShiftTarget || c.nCount < c.nightShiftTarget,
  );

  await publishMonthSchedule(year, month, session.id);
  revalidateSchedule(year, month);

  return {
    ok: true as const,
    warnings:
      understaffed.length > 0
        ? [
            `${understaffed.length} day(s) are still understaffed. Schedule published anyway.`,
          ]
        : [],
  };
}

/** @deprecated Use previewReconcileSchedule */
export async function suggestSchedule(year: number, month: number) {
  const result = await previewReconcileSchedule(year, month);
  if (!result.ok) return result;
  const { manualShifts: _m, manualCount, ...rest } = result;
  return { ...rest, manualCount };
}

/** @deprecated Use applyReconcileSchedule or autoAssignMonth */
export async function applyAutoAssign(
  year: number,
  month: number,
  proposals: AutoAssignProposal[],
) {
  return applyReconcileSchedule(year, month, proposals);
}
