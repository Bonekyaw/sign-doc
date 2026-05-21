/**
 * Demo seed data for sign-doc.
 * Minimum on-duty per day = dayShiftTarget + nightShiftTarget (5–7 with allowed ratios).
 * Comfortable roster for 4:3 coverage ≈ 10–12 doctors (we seed 12).
 */

import type { DoctorSeniority, DoctorType } from "../app/generated/prisma/client";
import { DEFAULT_SCHEDULING_RULES } from "../lib/scheduling/rules-types";

export const SEED_DOCTOR_PREFIX = "Seed: ";

export type SeedDoctorSpec = {
  name: string;
  seniority: DoctorSeniority;
  type: DoctorType;
  targetHours?: number;
  noTwentyFour?: boolean;
  rotationStartOffsetDays?: number;
};

export const DOCTOR_ROSTER: SeedDoctorSpec[] = [
  { name: `${SEED_DOCTOR_PREFIX}Dr. Anya Sen`, seniority: "SENIOR", type: "FT" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Hassan Wai`, seniority: "SENIOR", type: "FT" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Mei Lin`, seniority: "SENIOR", type: "FT" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. James Ko`, seniority: "MID_LEVEL", type: "FT" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Sarah Ng`, seniority: "MID_LEVEL", type: "FT" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Tom Yu`, seniority: "MID_LEVEL", type: "HALF_TIME" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Lily Chan`, seniority: "MID_LEVEL", type: "FT" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Raj Patel`, seniority: "MID_LEVEL", type: "HALF_TIME" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Emma So`, seniority: "JUNIOR", type: "FT" },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Noah Tay`, seniority: "JUNIOR", type: "FT" },
  {
    name: `${SEED_DOCTOR_PREFIX}Dr. Zoe Hsu`,
    seniority: "JUNIOR",
    type: "PT",
    targetHours: 80,
    noTwentyFour: true,
  },
  { name: `${SEED_DOCTOR_PREFIX}Dr. Ian Low`, seniority: "JUNIOR", type: "PT", targetHours: 72 },
];

/** First 14 days of month: 4 L + 3 N per day; unique doctors per day; ≥1 senior per band. */
const DEMO_DAY_PATTERNS: { l: number[]; n: number[] }[] = [
  { l: [0, 3, 4, 8], n: [1, 5, 9] },
  { l: [2, 6, 7, 10], n: [0, 4, 11] },
  { l: [1, 3, 5, 9], n: [2, 6, 8] },
  { l: [0, 7, 4, 11], n: [1, 5, 10] },
  { l: [2, 3, 6, 8], n: [0, 4, 9] },
  { l: [1, 4, 7, 10], n: [2, 5, 11] },
  { l: [0, 6, 5, 9], n: [1, 3, 8] },
  { l: [2, 4, 7, 11], n: [0, 6, 10] },
  { l: [1, 3, 5, 8], n: [2, 4, 9] },
  { l: [0, 6, 4, 10], n: [1, 7, 11] },
  { l: [2, 5, 7, 9], n: [0, 3, 8] },
  { l: [1, 4, 6, 11], n: [2, 5, 10] },
  { l: [0, 3, 7, 8], n: [1, 4, 9] },
  { l: [2, 5, 6, 10], n: [0, 7, 11] },
];

export const DEMO_SHIFT_DAYS = DEMO_DAY_PATTERNS.length;

export type DemoShiftSpec = {
  dateKey: string;
  doctorIdx: number;
  code: "L" | "N";
};

export function targetHoursForDoctor(spec: SeedDoctorSpec): number {
  if (spec.targetHours != null) return spec.targetHours;
  const rules = DEFAULT_SCHEDULING_RULES;
  if (spec.type === "FT") return rules.ftDefaultTargetHours;
  if (spec.type === "HALF_TIME") return rules.halfTimeDefaultTargetHours;
  return rules.ptDefaultTargetHours;
}

export function buildDemoShifts(monthKeys: string[]): DemoShiftSpec[] {
  const specs: DemoShiftSpec[] = [];
  const days = Math.min(DEMO_SHIFT_DAYS, monthKeys.length);

  for (let d = 0; d < days; d++) {
    const pattern = DEMO_DAY_PATTERNS[d];
    const dateKey = monthKeys[d];
    for (const doctorIdx of pattern.l) {
      specs.push({ dateKey, doctorIdx, code: "L" });
    }
    for (const doctorIdx of pattern.n) {
      specs.push({ dateKey, doctorIdx, code: "N" });
    }
  }

  return specs;
}

/** Leave on off-days for seeded doctors (indices). */
export const DEMO_LEAVE_SPECS: { doctorIdx: number; dayOffset: number }[] = [
  { doctorIdx: 8, dayOffset: 14 },
  { doctorIdx: 10, dayOffset: 15 },
  { doctorIdx: 5, dayOffset: 20 },
  { doctorIdx: 11, dayOffset: 22 },
];

export type DemoUserSpec = {
  username: string;
  password: string;
  role: "ADMIN" | "DOCTOR";
  doctorIdx?: number;
};

export function demoUsersFromEnv(): DemoUserSpec[] {
  const users: DemoUserSpec[] = [];

  const adminUser = process.env.SEED_ADMIN_USERNAME;
  const adminPass = process.env.SEED_ADMIN_PASSWORD;
  if (adminUser && adminPass) {
    users.push({ username: adminUser, password: adminPass, role: "ADMIN" });
  }

  const d1User = process.env.SEED_DOCTOR1_USERNAME;
  const d1Pass = process.env.SEED_DOCTOR1_PASSWORD;
  if (d1User && d1Pass) {
    users.push({
      username: d1User,
      password: d1Pass,
      role: "DOCTOR",
      doctorIdx: 0,
    });
  }

  const d2User = process.env.SEED_DOCTOR2_USERNAME;
  const d2Pass = process.env.SEED_DOCTOR2_PASSWORD;
  if (d2User && d2Pass) {
    users.push({
      username: d2User,
      password: d2Pass,
      role: "DOCTOR",
      doctorIdx: 1,
    });
  }

  return users;
}
