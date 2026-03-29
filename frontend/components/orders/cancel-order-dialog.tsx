"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { useApiClient } from "@/hooks/use-api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  order: { id: string } | null;
};

function formatOrderId(uuid: string): string {
  return `ORD-${uuid.substring(0, 8).toUpperCase()}`;
}

export function CancelOrderDialog({
  open,
  onOpenChange,
  onSuccess,
  order,
}: Props) {
  const apiClient = useApiClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setApiError(null);
    }
  }, [open]);

  async function handleCancelOrder() {
    if (!order) return;

    setSubmitting(true);
    setApiError(null);

    const { error } = await apiClient.POST("/orders/{id}/transition-status", {
      params: { path: { id: order.id } },
      body: { toStatus: "CANCELLED" },
    });

    setSubmitting(false);

    if (error) {
      setApiError((error as Error)?.message ?? "Failed to cancel order");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel order?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel{" "}
            <span className="font-medium text-foreground">
              {order ? formatOrderId(order.id) : "this order"}
            </span>
            . The order will no longer be active and a cancellation timestamp
            will be recorded.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {apiError && <p className="text-sm text-destructive">{apiError}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Keep order</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleCancelOrder}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Cancel order
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
