import { listDoctorsForUserLink, listUsers } from "@/app/actions/users";
import { UserManager } from "@/components/settings/UserManager";

export async function UsersContent() {
  const [users, doctors] = await Promise.all([
    listUsers(),
    listDoctorsForUserLink(),
  ]);

  return <UserManager users={users} doctors={doctors} />;
}
