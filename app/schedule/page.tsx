import { connection } from "next/server";
import { redirect } from "next/navigation";

export default async function ScheduleIndexPage() {
  await connection();
  const now = new Date();
  redirect(
    `/schedule/${now.getUTCFullYear()}/${now.getUTCMonth() + 1}`,
  );
}
