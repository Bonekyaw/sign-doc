"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline" size="sm" className="w-full gap-2">
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </form>
  );
}
