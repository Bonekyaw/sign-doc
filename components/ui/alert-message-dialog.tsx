"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type AlertMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  tone?: "error" | "success" | "info";
  okLabel?: string;
};

export function AlertMessageDialog({
  open,
  onOpenChange,
  title,
  description,
  tone = "info",
  okLabel = "OK",
}: AlertMessageDialogProps) {
  const Icon =
    tone === "error"
      ? AlertCircle
      : tone === "success"
        ? CheckCircle2
        : Info;

  const iconWrap =
    tone === "error"
      ? "bg-red-50 text-red-600"
      : tone === "success"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-sky-50 text-sky-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="flex gap-4 p-6 pr-12">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
              iconWrap,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogHeader className="mb-0 border-0 pb-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-2">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>
        <div className="flex justify-end border-t border-neutral-200/80 bg-neutral-50/80 px-6 py-4">
          <Button type="button" onClick={() => onOpenChange(false)}>
            {okLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
