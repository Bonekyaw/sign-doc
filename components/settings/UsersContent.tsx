import { listDoctorsForUserLink, listUsers } from "@/app/actions/users";
import { UserManager } from "@/components/settings/UserManager";
import { getSession } from "@/lib/auth/guards";

export async function UsersContent() {
  const [users, doctors, session] = await Promise.all([
    listUsers(),
    listDoctorsForUserLink(),
    getSession(),
  ]);

  return (
    <UserManager
      users={users}
      doctors={doctors}
      canManageAllRoles={session?.role === "OWNER"}
    />
  );
}
