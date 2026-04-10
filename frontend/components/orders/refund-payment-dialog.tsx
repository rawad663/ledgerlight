"use client";

import { Loader2, RefreshCw } from "lucide-react";
import * as React from "react";

import { FinancialStatusBadge } from "@/components/orders/financial-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiClient } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { type components } from "@/lib/api-types";
import {
  formatCurrencyCents,
  formatDateTime,
  formatEnumLabel,
  formatOrderId,
} from "@/lib/formatters";

type PaymentSummaryDto = components["schemas"]["PaymentSummaryDto"];
type PaymentDto = components["schemas"]["PaymentDto"];

type RefundPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  paymentSummary?: PaymentSummaryDto | null;
  onSuccess?: () => void;
};

export function RefundPaymentDialog({
  open,
  onOpenChange,
  orderId,
  paymentSummary,
  onSuccess,
}: RefundPaymentDialogProps) {
  const apiClient = useApiClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [refundReason, setRefundReason] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setApiError(null);
      return;
    }

    setRefundReason("");
  }, [open]);

  async function handleRefund() {
    if (!refundReason.trim()) {
      setApiError("A refund reason is required.");
      return;
    }

    setSubmitting(true);
    setApiError(null);

    const { data, error } = await apiClient.POST("/payments/{orderId}/refund", {
      params: { path: { orderId } },
      body: {
        refundReason: refundReason.trim(),
      },
    });

    setSubmitting(false);

    if (error) {
      setApiError((error as Error)?.message ?? "Failed to create refund");
      return;
    }

    if (!data) {
      return;
    }

    const payment = data as PaymentDto;
    const title =
      payment.financialStatus === "REFUNDED"
        ? "Payment refunded"
        : payment.financialStatus === "REFUND_FAILED"
          ? "Refund failed"
          : "Refund requested";
    const description =
      payment.lastRefundFailure ??
      (payment.financialStatus === "REFUNDED"
        ? "The payment was refunded successfully."
        : "The refund was submitted and is waiting on Stripe.");

    toast({
      title,
      description,
      variant: payment.financialStatus === "REFUND_FAILED" ? "destructive" : "default",
    });

    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {paymentSummary?.refundStatus === "FAILED"
              ? "Retry Refund"
              : "Refund Payment"}
          </DialogTitle>
          <DialogDescription>
            Submit a full refund for{" "}
            <span className="font-medium text-foreground">
              {formatOrderId(orderId)}
            </span>
            . The reason is stored with the payment record and refund audit log.
          </DialogDescription>
        </DialogHeader>

        {paymentSummary ? (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Current state</span>
              <FinancialStatusBadge status={paymentSummary.financialStatus} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">
                {formatCurrencyCents(paymentSummary.amountCents)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Method</span>
              <span>
                {paymentSummary.method
                  ? formatEnumLabel(paymentSummary.method)
                  : "Not set"}
              </span>
            </div>
            {paymentSummary.paidAt ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Paid at</span>
                <span>{formatDateTime(paymentSummary.paidAt)}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="refund-reason">Refund reason</Label>
          <Textarea
            id="refund-reason"
            value={refundReason}
            onChange={(event) => setRefundReason(event.target.value)}
            placeholder="Explain why this order is being refunded."
            rows={4}
          />
        </div>

        {apiError ? (
          <Alert variant="destructive">
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Close
          </Button>
          <Button onClick={handleRefund} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-4" />
            )}
            {paymentSummary?.refundStatus === "FAILED"
              ? "Retry Refund"
              : "Submit Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
