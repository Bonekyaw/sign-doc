import { cacheLife, cacheTag } from "next/cache";
import {
  getMonthCoverageDefaults,
  loadDoctors,
  loadShiftTypes,
} from "@/lib/scheduling/context";
import {
  coverageTag,
  doctorsTag,
  rotationTemplatesTag,
  shiftTypesTag,
} from "@/lib/data/cache-tags";
import { prisma } from "@/lib/db";

export async function getCachedDoctors() {
  "use cache";
  cacheTag(doctorsTag());
  cacheLife("hours");
  return loadDoctors();
}

export async function getCachedShiftTypes() {
  "use cache";
  cacheTag(shiftTypesTag());
  cacheLife("hours");
  return loadShiftTypes();
}

export async function getCachedShiftTypeConfigs() {
  "use cache";
  cacheTag(shiftTypesTag());
  cacheLife("hours");
  return prisma.shiftTypeConfig.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getCachedDoctorList() {
  "use cache";
  cacheTag(doctorsTag());
  cacheLife("hours");
  return prisma.doctor.findMany({
    include: {
      restrictions: true,
      rotation: {
        include: {
          template: { include: { steps: { orderBy: { sortOrder: "asc" } } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getCachedMonthCoverageDefaults(
  year: number,
  month: number,
) {
  "use cache";
  cacheTag(coverageTag(year, month));
  cacheLife("hours");
  return getMonthCoverageDefaults(year, month);
}

export async function getCachedRotationTemplates() {
  "use cache";
  cacheTag(rotationTemplatesTag());
  cacheLife("hours");
  return prisma.rotationTemplate.findMany({
    include: { steps: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" },
  });
}
