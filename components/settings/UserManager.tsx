"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import {
  createUserSchema,
  setUserPasswordSchema,
  type CreateUserInput,
} from "@/lib/schemas/user";

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
  canManageAllRoles,
}: {
  users: UserRow[];
  doctors: DoctorOption[];
  canManageAllRoles: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      role: canManageAllRoles ? "ADMIN" : "DOCTOR",
      doctorId: "",
    },
  });

  const role = form.watch("role");
  const doctorId = form.watch("doctorId");
  const availableDoctors = doctors.filter((d) => !d.user);

  function resetCreateForm() {
    form.reset({
      username: "",
      password: "",
      role: canManageAllRoles ? "ADMIN" : "DOCTOR",
      doctorId: "",
    });
    setError(null);
  }

  async function onCreateSubmit(values: CreateUserInput) {
    setError(null);
    setCreating(true);
    const result = await createUser({
      username: values.username,
      password: values.password,
      role: values.role,
      doctorId: values.role === "DOCTOR" ? values.doctorId ?? null : null,
    });
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    resetCreateForm();
    router.refresh();
  }

  async function handleSetPassword(userId: string, newPassword: string) {
    setError(null);
    const parsed = setUserPasswordSchema.safeParse({ newPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid password.");
      return;
    }
    setPasswordSaving(true);
    const result = await setUserPassword(userId, parsed.data.newPassword);
    setPasswordSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPasswordUserId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Users"
        description={
          canManageAllRoles
            ? "Manage login accounts, roles, and passwords."
            : "Create and manage doctor login accounts."
        }
        actions={
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) resetCreateForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>{canManageAllRoles ? "Add user" : "Add doctor account"}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {canManageAllRoles ? "New user" : "New doctor account"}
                </DialogTitle>
                <DialogDescription>
                  Create a login with username and password
                  {canManageAllRoles ? ", role, and optional doctor link." : " linked to a roster doctor."}
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit(onCreateSubmit)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" {...form.register("username")} />
                  {form.formState.errors.username ? (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.username.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    {...form.register("password")}
                  />
                  {form.formState.errors.password ? (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.password.message}
                    </p>
                  ) : null}
                </div>
                {canManageAllRoles ? (
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={role}
                      onValueChange={(v) => {
                        form.setValue("role", v as UserRole, {
                          shouldValidate: true,
                        });
                        if (v !== "DOCTOR") {
                          form.setValue("doctorId", "");
                        }
                      }}
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
                ) : null}
                {role === "DOCTOR" ? (
                  <div className="space-y-2">
                    <Label>Linked doctor</Label>
                    <Select
                      value={doctorId ?? ""}
                      onValueChange={(v) =>
                        form.setValue("doctorId", v, { shouldValidate: true })
                      }
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
                    {form.formState.errors.doctorId ? (
                      <p className="text-sm text-red-600">
                        {form.formState.errors.doctorId.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : null}
                <Button type="submit" disabled={creating}>
                  {creating ? "Loading…" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {error && !open && !passwordUserId ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-100">
            {users.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No user accounts yet.</p>
            ) : null}
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
                      setError(null);
                    }}
                  >
                    Set password
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={togglingUserId === user.id}
                    onClick={async () => {
                      setTogglingUserId(user.id);
                      try {
                        const result = await updateUser(user.id, {
                          role: user.role,
                          doctorId: user.doctorId,
                          isActive: !user.isActive,
                        });
                        if (!result.ok) {
                          setError(result.error);
                        } else {
                          router.refresh();
                        }
                      } finally {
                        setTogglingUserId(null);
                      }
                    }}
                  >
                    {togglingUserId === user.id
                      ? "Loading…"
                      : user.isActive
                        ? "Deactivate"
                        : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <PasswordDialog
        open={!!passwordUserId}
        onOpenChange={(o) => !o && setPasswordUserId(null)}
        saving={passwordSaving}
        error={error}
        onSave={(password) =>
          passwordUserId ? handleSetPassword(passwordUserId, password) : undefined
        }
      />
    </div>
  );
}

function PasswordDialog({
  open,
  onOpenChange,
  saving,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  error: string | null;
  onSave: (password: string) => void;
}) {
  const form = useForm<{ newPassword: string }>({
    resolver: zodResolver(setUserPasswordSchema),
    defaultValues: { newPassword: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set password</DialogTitle>
          <DialogDescription>
            Enter a new password for this account. Existing sessions will be signed out.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => onSave(values.newPassword))}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              {...form.register("newPassword")}
            />
            {form.formState.errors.newPassword ? (
              <p className="text-sm text-red-600">
                {form.formState.errors.newPassword.message}
              </p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Loading…" : "Save password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
