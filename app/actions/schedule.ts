"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { scheduleTag } from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";
import { autoAssign } from "@/lib/scheduling/auto-assign";
import {
  getCoverageForDate,
  getDailyCoverageOverrides,
  getMonthCoverageDefaults,
  loadDoctors,
  loadApprovedLeave,
  loadDoctorRotations,
  loadMonthShifts,
  loadShiftTypes,
  shiftCodeFromId,
} from "@/lib/scheduling/context";
import { getMonthDateKeys, parseDateKey } from "@/lib/scheduling/dates";
import { countBandForDate } from "@/lib/scheduling/validate-coverage";
import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import { validateAssignment } from "@/lib/scheduling/validate-assignment";
import type { ShiftCode } from "@/lib/scheduling/types";
import {
  requireAdminRead,
  requireDoctor,
  requireWrite,
} from "@/lib/auth/guards";

async function getMonthScheduleInternal(year: number, month: number) {
  const monthKeys = getMonthDateKeys(year, month);
  const start = parseDateKey(monthKeys[0]);
  const end = parseDateKey(monthKeys[monthKeys.length - 1]);

  const [doctors, shiftTypes, shiftRows, monthDefaults, dailyOverrides] =
    await Promise.all([
      loadDoctors(),
      loadShiftTypes(),
      prisma.shift.findMany({
        where: { date: { gte: start, lte: end } },
        include: { shiftType: true, doctor: true },
      }),
      getMonthCoverageDefaults(year, month),
      getDailyCoverageOverrides(year, month),
    ]);

  const shifts = shiftRows.map((s) => ({
    doctorId: s.doctorId,
    date: s.date,
    shiftCode: s.shiftType.code as ShiftCode,
    durationHours: s.shiftType.durationHours,
  }));

  const dates = monthKeys.map(parseDateKey);

  const coverageByDate = monthKeys.map((key) => {
    const target = dailyOverrides.get(key) ?? monthDefaults;
    const date = parseDateKey(key);
    const lCount = countBandForDate(date, "L", shifts);
    const nCount = countBandForDate(date, "N", shifts);
    return {
      date: key,
      dayShiftTarget: target.dayShiftTarget,
      nightShiftTarget: target.nightShiftTarget,
      lCount,
      nCount,
    };
  });

  const hourSummary = doctors.map((d) => ({
    doctorId: d.id,
    worked: computeMonthlyHours(d.id, monthKeys, shifts),
    target: d.targetHours,
  }));

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
  };
}

export async function getMonthSchedule(year: number, month: number) {
  await requireAdminRead();
  return getMonthScheduleInternal(year, month);
}

export async function getMyMonthSchedule(year: number, month: number) {
  const session = await requireDoctor();
  const data = await getMonthScheduleInternal(year, month);
  const doctor = data.doctors.find((d) => d.id === session.doctorId);
  if (!doctor) {
    throw new Error("Linked doctor record not found.");
  }

  const shiftRows = data.shiftRows.filter((r) => r.doctorId === session.doctorId);
  const shifts = data.shifts.filter((s) => s.doctorId === session.doctorId);

  return {
    ...data,
    doctors: [doctor],
    shiftRows,
    shifts,
    hourSummary: data.hourSummary.filter((h) => h.doctorId === session.doctorId),
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
  const date = parseDateKey(dateStr);
  const [doctors, shiftTypes, existingShifts, coverageTarget] =
    await Promise.all([
      loadDoctors(),
      loadShiftTypes(),
      loadMonthShifts(year, month),
      getCoverageForDate(year, month, date),
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
  });

  if (!result.ok) {
    return { ok: false as const, errors: result.errors, warnings: result.warnings };
  }

  await prisma.shift.upsert({
    where: { doctorId_date: { doctorId, date } },
    create: { doctorId, date, shiftTypeId },
    update: { shiftTypeId },
  });

  revalidatePath(`/schedule/${year}/${month}`);
  revalidatePath("/");
  revalidateTag(scheduleTag(year, month), "max");
  return { ok: true as const, warnings: result.warnings };
}

export async function clearShift(data: {
  doctorId: string;
  dateStr: string;
  year: number;
  month: number;
}) {
  await requireWrite();
  const date = parseDateKey(data.dateStr);
  await prisma.shift.deleteMany({
    where: { doctorId: data.doctorId, date },
  });
  revalidatePath(`/schedule/${data.year}/${data.month}`);
  revalidatePath("/");
  revalidateTag(scheduleTag(data.year, data.month), "max");
  return { ok: true as const };
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
  const [doctors, shiftTypes, existingShifts, coverageTarget] =
    await Promise.all([
      loadDoctors(),
      loadShiftTypes(),
      loadMonthShifts(data.year, data.month),
      getCoverageForDate(data.year, data.month, date),
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
  });
}

export async function suggestSchedule(year: number, month: number) {
  await requireWrite();
  const [
    doctors,
    shiftTypes,
    existingShifts,
    monthDefaults,
    dailyOverrides,
    doctorRotations,
    leaveByDoctor,
  ] = await Promise.all([
    loadDoctors(),
    loadShiftTypes(),
    loadMonthShifts(year, month),
    getMonthCoverageDefaults(year, month),
    getDailyCoverageOverrides(year, month),
    loadDoctorRotations(),
    loadApprovedLeave(year, month),
  ]);

  return autoAssign({
    year,
    month,
    doctors,
    shiftTypes,
    existingShifts,
    monthDefaults,
    dailyOverrides,
    doctorRotations,
    leaveByDoctor,
  });
}

export async function applyAutoAssign(
  year: number,
  month: number,
  proposals: {
    doctorId: string;
    date: string;
    shiftTypeId: string;
  }[],
) {
  await requireWrite();
  for (const p of proposals) {
    await prisma.shift.upsert({
      where: {
        doctorId_date: {
          doctorId: p.doctorId,
          date: parseDateKey(p.date),
        },
      },
      create: {
        doctorId: p.doctorId,
        date: parseDateKey(p.date),
        shiftTypeId: p.shiftTypeId,
      },
      update: { shiftTypeId: p.shiftTypeId },
    });
  }
  revalidatePath(`/schedule/${year}/${month}`);
  revalidatePath("/");
  revalidateTag(scheduleTag(year, month), "max");
  return { ok: true };
}
