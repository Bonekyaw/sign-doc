"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

function LoginFormFields({
  nextPath,
  error,
}: {
  nextPath?: string;
  error?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </>
  );
}

export function LoginForm({
  nextPath,
  initialError,
}: {
  nextPath?: string;
  initialError?: string;
}) {
  const initialState: LoginFormState = initialError
    ? { error: initialError }
    : {};
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Doctor Duty Schedule — enter your username and password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <LoginFormFields nextPath={nextPath} error={state.error} />
        </form>
      </CardContent>
    </Card>
  );
}
