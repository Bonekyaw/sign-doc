"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ConfirmDialog,
  type ConfirmDialogProps,
} from "@/components/ui/confirm-dialog";

export type ConfirmRequest = Pick<
  ConfirmDialogProps,
  "title" | "description" | "confirmLabel" | "cancelLabel" | "variant"
>;

export function useConfirmDialog() {
  const [pending, setPending] = useState<{
    request: ConfirmRequest;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const requestConfirm = useCallback(
    (request: ConfirmRequest, onConfirm: () => Promise<void>) => {
      setPending({ request, onConfirm });
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    setLoading(true);
    try {
      await pending.onConfirm();
      setPending(null);
    } finally {
      setLoading(false);
    }
  }, [pending]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !loading) setPending(null);
    },
    [loading],
  );

  const confirmDialog = useMemo(
    () => (
      <ConfirmDialog
        open={!!pending}
        onOpenChange={handleOpenChange}
        title={pending?.request.title ?? ""}
        description={pending?.request.description ?? ""}
        confirmLabel={pending?.request.confirmLabel}
        cancelLabel={pending?.request.cancelLabel}
        variant={pending?.request.variant}
        loading={loading}
        onConfirm={handleConfirm}
      />
    ),
    [pending, loading, handleOpenChange, handleConfirm],
  );

  return {
    requestConfirm,
    confirmDialog,
    confirmOpen: !!pending,
    confirmLoading: loading,
  };
}
