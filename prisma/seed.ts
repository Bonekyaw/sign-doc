import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/auth/password";

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
];

async function main() {
  for (const st of shiftTypes) {
    await prisma.shiftTypeConfig.upsert({
      where: { code: st.code },
      create: st,
      update: {
        label: st.label,
        startTime: st.startTime,
        endTime: st.endTime,
        durationHours: st.durationHours,
        color: st.color,
        sortOrder: st.sortOrder,
      },
    });
  }

  const now = new Date();
  await prisma.monthSettings.upsert({
    where: {
      year_month: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 },
    },
    create: {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      dayShiftTarget: 4,
      nightShiftTarget: 3,
    },
    update: {},
  });

  const existingTemplate = await prisma.rotationTemplate.findFirst({
    where: { name: "24h → Long → Night → Off" },
  });
  if (!existingTemplate) {
    await prisma.rotationTemplate.create({
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

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const username = process.env.BOOTSTRAP_OWNER_USERNAME;
    const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
    if (!username || !password) {
      console.warn(
        "No users found. Set BOOTSTRAP_OWNER_USERNAME and BOOTSTRAP_OWNER_PASSWORD to create the initial owner.",
      );
    } else {
      await prisma.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          role: "OWNER",
        },
      });
      console.log(`Created bootstrap owner: ${username}`);
    }
  }

  console.log("Seed completed.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
