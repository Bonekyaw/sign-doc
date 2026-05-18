"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser, setUserPassword, updateUser } from "@/app/actions/users";
import type { UserRole } from "@/app/generated/prisma/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRow = {
  id: string;
  username: string;
  role: UserRole;
  doctorId: string | null;
  isActive: boolean;
  doctor: { id: string; name: string } | null;
};

type DoctorOption = {
  id: string;
  name: string;
  user: { id: string } | null;
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  OWNER: "Owner",
  DOCTOR: "Doctor",
};

export function UserManager({
  users,
  doctors,
}: {
  users: UserRow[];
  doctors: DoctorOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>("ADMIN");
  const [doctorId, setDoctorId] = useState("");
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const availableDoctors = doctors.filter((d) => !d.user);

  async function handleCreate(formData: FormData) {
    setError(null);
    const result = await createUser({
      username: String(formData.get("username")),
      password: String(formData.get("password")),
      role,
      doctorId:
        role === "DOCTOR" ? String(formData.get("doctorId") || "") : null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setRole("ADMIN");
    setDoctorId("");
    router.refresh();
  }

  async function handleSetPassword(userId: string) {
    setError(null);
    const result = await setUserPassword(userId, newPassword);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPasswordUserId(null);
    setNewPassword("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Users"
        description="Manage login accounts, roles, and passwords."
        actions={
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setRole("ADMIN");
                setDoctorId("");
                setError(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>Add user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New user</DialogTitle>
                <DialogDescription>
                  Create a login with username, password, and role.
                </DialogDescription>
              </DialogHeader>
              <form action={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" name="username" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as UserRole)}
                  >
                    <SelectTrigger className="text-black">
                      <SelectValue placeholder="Select role">
                        {ROLE_LABELS[role]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="OWNER">Owner</SelectItem>
                      <SelectItem value="DOCTOR">Doctor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {role === "DOCTOR" ? (
                  <div className="space-y-2">
                    <Label>Linked doctor</Label>
                    <Select
                      name="doctorId"
                      value={doctorId}
                      onValueChange={setDoctorId}
                      required
                    >
                      <SelectTrigger className="text-black">
                        <SelectValue placeholder="Select doctor">
                          {availableDoctors.find((d) => d.id === doctorId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableDoctors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                {error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : null}
                <Button type="submit">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error && !open ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-100">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-black">{user.username}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge>{user.role}</Badge>
                    {!user.isActive ? (
                      <Badge className="bg-neutral-100 text-neutral-600">
                        Inactive
                      </Badge>
                    ) : null}
                    {user.doctor ? (
                      <Badge className="bg-violet-100 text-violet-800">
                        {user.doctor.name}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPasswordUserId(user.id);
                      setNewPassword("");
                    }}
                  >
                    Set password
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await updateUser(user.id, {
                        role: user.role,
                        doctorId: user.doctorId,
                        isActive: !user.isActive,
                      });
                      router.refresh();
                    }}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!passwordUserId}
        onOpenChange={(o) => !o && setPasswordUserId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set password</DialogTitle>
            <DialogDescription>
              Enter a new password for this account. Existing sessions will be signed out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button
              onClick={() =>
                passwordUserId && handleSetPassword(passwordUserId)
              }
              disabled={newPassword.length < 8}
            >
              Save password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
