import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth/password";
import { getMonthDateKeys, parseDateKey } from "../lib/scheduling/dates";
import {
  DEFAULT_SCHEDULING_RULES,
  SCHEDULING_RULES_ID,
} from "../lib/scheduling/rules-types";
import {
  buildDemoShifts,
  DEMO_LEAVE_SPECS,
  DEMO_SHIFT_DAYS,
  DOCTOR_ROSTER,
  demoUsersFromEnv,
  SEED_DOCTOR_PREFIX,
  targetHoursForDoctor,
} from "./seed-data";

const shiftTypes = [
  {
    code: "L",
    label: "Long Day",
    startTime: "07:00",
    endTime: "19:00",
    durationHours: 12,
    color: "#3b82f6",
    sortOrder: 1,
  },
  {
    code: "N",
    label: "Night",
    startTime: "19:00",
    endTime: "07:00",
    durationHours: 12,
    color: "#6366f1",
    sortOrder: 2,
  },
  {
    code: "TWENTY_FOUR",
    label: "24 Hours",
    startTime: "07:00",
    endTime: "07:00",
    durationHours: 24,
    color: "#dc2626",
    sortOrder: 3,
  },
  {
    code: "OFF",
    label: "Off",
    startTime: "00:00",
    endTime: "00:00",
    durationHours: 0,
    color: "#94a3b8",
    sortOrder: 4,
    isActive: false,
  },
];

async function seedShiftTypes() {
  const byCode = new Map<string, string>();
  for (const st of shiftTypes) {
    const { isActive, ...rest } = st as (typeof shiftTypes)[number] & {
      isActive?: boolean;
    };
    const row = await prisma.shiftTypeConfig.upsert({
      where: { code: st.code },
      create: { ...rest, isActive: isActive ?? true },
      update: {
        label: st.label,
        startTime: st.startTime,
        endTime: st.endTime,
        durationHours: st.durationHours,
        color: st.color,
        sortOrder: st.sortOrder,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    byCode.set(st.code, row.id);
  }
  return byCode;
}

async function seedMonthSettings(year: number, month: number, day: number, night: number) {
  await prisma.monthSettings.upsert({
    where: { year_month: { year, month } },
    create: { year, month, dayShiftTarget: day, nightShiftTarget: night },
    update: { dayShiftTarget: day, nightShiftTarget: night },
  });
}

async function seedRotationTemplate() {
  const existing = await prisma.rotationTemplate.findFirst({
    where: { name: "24h → Long → Night → Off" },
  });
  if (existing) return existing;
  return prisma.rotationTemplate.create({
    data: {
      name: "24h → Long → Night → Off",
      steps: {
        create: [
          { sortOrder: 0, stepType: "TWENTY_FOUR" },
          { sortOrder: 1, stepType: "L" },
          { sortOrder: 2, stepType: "N" },
          { sortOrder: 3, stepType: "OFF" },
        ],
      },
    },
  });
}

async function seedDoctors() {
  const doctorIds: string[] = [];

  for (const spec of DOCTOR_ROSTER) {
    let doctor = await prisma.doctor.findFirst({ where: { name: spec.name } });
    if (!doctor) {
      doctor = await prisma.doctor.create({
        data: {
          name: spec.name,
          type: spec.type,
          seniority: spec.seniority,
          targetMonthlyHours: targetHoursForDoctor(spec),
        },
      });
    } else {
      doctor = await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          type: spec.type,
          seniority: spec.seniority,
          targetMonthlyHours: targetHoursForDoctor(spec),
        },
      });
    }
    doctorIds.push(doctor.id);

    if (spec.noTwentyFour) {
      await prisma.doctorRestriction.upsert({
        where: {
          doctorId_type: {
            doctorId: doctor.id,
            type: "NO_TWENTY_FOUR",
          },
        },
        create: { doctorId: doctor.id, type: "NO_TWENTY_FOUR" },
        update: {},
      });
    }
  }

  return doctorIds;
}

async function seedRotations(
  doctorIds: string[],
  templateId: string,
  monthStart: Date,
) {
  for (let i = 0; i < 6; i++) {
    const spec = DOCTOR_ROSTER[i];
    const offset = spec.rotationStartOffsetDays ?? i * 2;
    const startDate = new Date(monthStart);
    startDate.setUTCDate(startDate.getUTCDate() - offset);

    await prisma.doctorRotation.upsert({
      where: { doctorId: doctorIds[i] },
      create: {
        doctorId: doctorIds[i],
        templateId,
        startDate,
        startOffset: 0,
      },
      update: { templateId, startDate, startOffset: 0 },
    });
  }
}

async function seedShifts(
  doctorIds: string[],
  shiftTypeByCode: Map<string, string>,
  monthKeys: string[],
) {
  const specs = buildDemoShifts(monthKeys);
  const seedIds = new Set(doctorIds);
  const dateFrom = parseDateKey(monthKeys[0]);
  const dateTo = parseDateKey(monthKeys[Math.min(DEMO_SHIFT_DAYS, monthKeys.length) - 1]);

  await prisma.shift.deleteMany({
    where: {
      doctorId: { in: [...seedIds] },
      date: { gte: dateFrom, lte: dateTo },
    },
  });

  for (const spec of specs) {
    const doctorId = doctorIds[spec.doctorIdx];
    const shiftTypeId = shiftTypeByCode.get(spec.code);
    if (!doctorId || !shiftTypeId) continue;

    await prisma.shift.upsert({
      where: {
        doctorId_date: {
          doctorId,
          date: parseDateKey(spec.dateKey),
        },
      },
      create: {
        doctorId,
        date: parseDateKey(spec.dateKey),
        shiftTypeId,
      },
      update: { shiftTypeId },
    });
  }

  return specs.length;
}

async function seedLeave(doctorIds: string[], monthKeys: string[]) {
  let count = 0;
  for (const spec of DEMO_LEAVE_SPECS) {
    if (spec.dayOffset >= monthKeys.length) continue;
    const doctorId = doctorIds[spec.doctorIdx];
    const date = parseDateKey(monthKeys[spec.dayOffset]);
    await prisma.leaveRequest.upsert({
      where: { doctorId_date: { doctorId, date } },
      create: { doctorId, date, status: "APPROVED" },
      update: { status: "APPROVED" },
    });
    count++;
  }
  return count;
}

async function seedUsers(doctorIds: string[]) {
  const created: string[] = [];

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const username = process.env.BOOTSTRAP_OWNER_USERNAME;
    const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
    if (username && password) {
      await prisma.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          role: "OWNER",
        },
      });
      created.push(`owner:${username}`);
    } else {
      console.warn(
        "No users found. Set BOOTSTRAP_OWNER_USERNAME and BOOTSTRAP_OWNER_PASSWORD for initial owner.",
      );
    }
  }

  for (const spec of demoUsersFromEnv()) {
    const existing = await prisma.user.findUnique({
      where: { username: spec.username },
    });
    const passwordHash = await hashPassword(spec.password);
    const doctorId =
      spec.role === "DOCTOR" && spec.doctorIdx != null
        ? doctorIds[spec.doctorIdx]
        : null;

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: spec.role,
          doctorId,
          isActive: true,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          username: spec.username,
          passwordHash,
          role: spec.role,
          doctorId,
        },
      });
    }
    created.push(`${spec.role.toLowerCase()}:${spec.username}`);
  }

  return created;
}

async function main() {
  const shiftTypeByCode = await seedShiftTypes();

  await prisma.schedulingRules.upsert({
    where: { id: SCHEDULING_RULES_ID },
    create: { id: SCHEDULING_RULES_ID, ...DEFAULT_SCHEDULING_RULES },
    update: {},
  });

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthKeys = getMonthDateKeys(year, month);

  await seedMonthSettings(year, month, 4, 3);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  await seedMonthSettings(prevYear, prevMonth, 3, 3);

  const template = await seedRotationTemplate();
  const doctorIds = await seedDoctors();
  const monthStart = parseDateKey(monthKeys[0]);

  await seedRotations(doctorIds, template.id, monthStart);
  const shiftCount = await seedShifts(doctorIds, shiftTypeByCode, monthKeys);
  const leaveCount = await seedLeave(doctorIds, monthKeys);
  const users = await seedUsers(doctorIds);

  console.log("Seed completed.");
  console.log(
    "  If /doctors looks empty in dev, hard-refresh the page (doctor list avoids stale cache).",
  );
  console.log(
    `  Doctors: ${doctorIds.length} (${SEED_DOCTOR_PREFIX}*) — min on-duty/day: 5–7; roster ~10–12 for 4:3`,
  );
  console.log(`  Shifts: ${shiftCount} assignments (first ${DEMO_SHIFT_DAYS} days, 4:3 coverage)`);
  console.log(`  Leave: ${leaveCount} approved requests`);
  console.log(`  Month coverage: ${year}-${String(month).padStart(2, "0")} = 4:3, previous = 3:3`);
  if (users.length > 0) {
    console.log(`  Users: ${users.join(", ")}`);
  }
  console.log(
    "  Optional env: SEED_ADMIN_USERNAME/PASSWORD, SEED_DOCTOR1_*, SEED_DOCTOR2_*",
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
