"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Banknote, CreditCard, Loader2, RefreshCw } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiClient } from "@/hooks/use-api";
import { toast } from "@/hooks/use-toast";
import { type components } from "@/lib/api-types";
import {
  formatCurrencyCents,
  formatDateTime,
  formatEnumLabel,
  formatOrderId,
} from "@/lib/formatters";

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

type PaymentDto = components["schemas"]["PaymentDto"];
type PaymentSummaryDto = components["schemas"]["PaymentSummaryDto"];
type CreateCardPaymentResponseDto =
  components["schemas"]["CreateCardPaymentResponseDto"];

type ProcessPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  paymentSummary?: PaymentSummaryDto | null;
  onSuccess?: () => void;
};

type PaymentMode = "cash" | "card";

type CardPaymentFormProps = {
  orderId: string;
  payment: PaymentDto | null;
  onSynchronized: (payment: PaymentDto) => void;
};

function CardPaymentForm({
  orderId,
  payment,
  onSynchronized,
}: CardPaymentFormProps) {
  const apiClient = useApiClient();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  async function handleSubmit() {
    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const elementSubmission = await elements.submit();
    if (elementSubmission.error) {
      setSubmitError(
        elementSubmission.error.message ?? "Please review the card details.",
      );
      setSubmitting(false);
      return;
    }

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (result.error && result.error.type === "validation_error") {
      setSubmitError(
        result.error.message ?? "Please review the card details and try again.",
      );
      setSubmitting(false);
      return;
    }

    const { data, error } = await apiClient.POST("/payments/{orderId}/card/confirm", {
      params: { path: { orderId } },
    });

    setSubmitting(false);

    if (error) {
      setSubmitError((error as Error)?.message ?? "Failed to sync card payment");
      return;
    }

    if (data) {
      onSynchronized(data);
    }
  }

  return (
    <div className="space-y-4">
      {payment?.lastPaymentFailure ? (
        <Alert variant="destructive">
          <AlertDescription>{payment.lastPaymentFailure}</AlertDescription>
        </Alert>
      ) : null}

      {payment?.latestAttempt ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Latest attempt</span>
            <span className="font-medium">
              {formatEnumLabel(payment.latestAttempt.status)}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Started {formatDateTime(payment.latestAttempt.createdAt)}
          </div>
        </div>
      ) : null}

      <div className="rounded-md border p-4">
        <PaymentElement />
      </div>

      {submitError ? (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <Button onClick={handleSubmit} disabled={!stripe || !elements || submitting}>
        {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
        Submit Card Payment
      </Button>
    </div>
  );
}

export function ProcessPaymentDialog({
  open,
  onOpenChange,
  orderId,
  paymentSummary,
  onSuccess,
}: ProcessPaymentDialogProps) {
  const apiClient = useApiClient();
  const [mode, setMode] = React.useState<PaymentMode>("cash");
  const [loadingPayment, setLoadingPayment] = React.useState(false);
  const [payment, setPayment] = React.useState<PaymentDto | null>(null);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);
  const [cashSubmitting, setCashSubmitting] = React.useState(false);
  const [startingCard, setStartingCard] = React.useState(false);
  const [cardSession, setCardSession] =
    React.useState<CreateCardPaymentResponseDto | null>(null);
  const [cardError, setCardError] = React.useState<string | null>(null);

  const paymentLabel =
    paymentSummary?.financialStatus === "PAYMENT_PENDING"
      ? "Resume Payment"
      : paymentSummary?.financialStatus === "PAYMENT_FAILED"
        ? "Retry Payment"
        : "Process Payment";

  const loadPayment = React.useCallback(async () => {
    setLoadingPayment(true);
    setPaymentError(null);

    const { data, error } = await apiClient.GET("/payments/{orderId}", {
      params: { path: { orderId } },
    });

    setLoadingPayment(false);

    if (error) {
      setPaymentError((error as Error)?.message ?? "Failed to load payment");
      setPayment(null);
      return;
    }

    setPayment(data ?? null);
    setMode((data?.method ?? paymentSummary?.method) === "CARD" ? "card" : "cash");
  }, [apiClient, orderId, paymentSummary?.method]);

  React.useEffect(() => {
    if (!open) {
      setPayment(null);
      setPaymentError(null);
      setCardError(null);
      setCardSession(null);
      setCashSubmitting(false);
      setStartingCard(false);
      return;
    }

    void loadPayment();
  }, [loadPayment, open]);

  const startOrResumeCard = React.useCallback(async () => {
    setStartingCard(true);
    setCardError(null);

    const { data, error } = await apiClient.POST("/payments/{orderId}/card", {
      params: { path: { orderId } },
    });

    setStartingCard(false);

    if (error) {
      setCardError(
        (error as Error)?.message ?? "Failed to start the card payment flow",
      );
      setCardSession(null);
      return;
    }

    setCardSession(data ?? null);
    void loadPayment();
  }, [apiClient, loadPayment, orderId]);

  React.useEffect(() => {
    if (
      !open ||
      mode !== "card" ||
      !stripePromise ||
      startingCard ||
      cardSession
    ) {
      return;
    }

    void startOrResumeCard();
  }, [cardSession, mode, open, startOrResumeCard, startingCard]);

  function closeDialog() {
    onOpenChange(false);
  }

  async function handleCashPayment() {
    setCashSubmitting(true);
    setPaymentError(null);

    const { data, error } = await apiClient.POST("/payments/{orderId}/cash", {
      params: { path: { orderId } },
    });

    setCashSubmitting(false);

    if (error) {
      setPaymentError((error as Error)?.message ?? "Failed to mark cash paid");
      return;
    }

    if (!data) {
      return;
    }

    setPayment(data);
    toast({ title: "Payment recorded", description: "Cash payment marked as paid." });
    closeDialog();
    onSuccess?.();
  }

  function handleCardSynchronized(nextPayment: PaymentDto) {
    setPayment(nextPayment);

    if (nextPayment.financialStatus === "PAID") {
      toast({ title: "Payment completed", description: "Card payment was captured successfully." });
      closeDialog();
      onSuccess?.();
      return;
    }

    if (nextPayment.financialStatus === "PAYMENT_PENDING") {
      toast({
        title: "Payment submitted",
        description: "The card payment is still processing in Stripe.",
      });
      closeDialog();
      onSuccess?.();
      return;
    }

    setCardSession(null);
    setCardError(nextPayment.lastPaymentFailure ?? "Card payment failed.");
    toast({
      title: "Payment failed",
      description:
        nextPayment.lastPaymentFailure ?? "The card payment could not be completed.",
      variant: "destructive",
    });
    void loadPayment();
  }

  const canShowCardRetry =
    payment?.financialStatus === "PAYMENT_FAILED" ||
    paymentSummary?.financialStatus === "PAYMENT_FAILED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{paymentLabel}</DialogTitle>
          <DialogDescription>
            Capture payment for <span className="font-medium text-foreground">{formatOrderId(orderId)}</span>.
            Confirmed orders stay locked until the associated payment is paid.
          </DialogDescription>
        </DialogHeader>

        {loadingPayment ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading payment details...
          </div>
        ) : null}

        {paymentError ? (
          <Alert variant="destructive">
            <AlertDescription>{paymentError}</AlertDescription>
          </Alert>
        ) : null}

        {payment ? (
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Current financial state</p>
                <p className="text-sm text-muted-foreground">
                  Amount due: {formatCurrencyCents(payment.amountCents)}
                </p>
              </div>
              <FinancialStatusBadge status={payment.financialStatus} />
            </div>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Method</span>
                <span>{payment.method ? formatEnumLabel(payment.method) : "Not set"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Currency</span>
                <span>{payment.currencyCode}</span>
              </div>
              {payment.paidAt ? (
                <div className="flex items-center justify-between gap-3 sm:col-span-2">
                  <span className="text-muted-foreground">Paid at</span>
                  <span>{formatDateTime(payment.paidAt)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <Separator />

        <Tabs value={mode} onValueChange={(value) => setMode(value as PaymentMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cash">
              <Banknote className="size-4" />
              Cash
            </TabsTrigger>
            <TabsTrigger value="card">
              <CreditCard className="size-4" />
              Card
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cash" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">
              Use this when payment was collected outside Stripe and you want to
              mark the order as paid immediately.
            </p>
            <Button onClick={handleCashPayment} disabled={cashSubmitting}>
              {cashSubmitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Mark Cash as Paid
            </Button>
          </TabsContent>

          <TabsContent value="card" className="space-y-4 pt-3">
            <p className="text-sm text-muted-foreground">
              Card payments use Stripe as the source of truth. Failed attempts
              can be retried without leaving the order detail flow.
            </p>

            {!stripePromise ? (
              <Alert variant="destructive">
                <AlertDescription>
                  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not configured, so the
                  embedded card form is unavailable.
                </AlertDescription>
              </Alert>
            ) : null}

            {cardError ? (
              <Alert variant="destructive">
                <AlertDescription>{cardError}</AlertDescription>
              </Alert>
            ) : null}

            {stripePromise && startingCard ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Preparing a card payment session...
              </div>
            ) : null}

            {stripePromise && cardSession ? (
              <Elements
                key={cardSession.clientSecret}
                stripe={stripePromise}
                options={{
                  clientSecret: cardSession.clientSecret,
                  appearance: {
                    theme: "stripe",
                  },
                }}
              >
                <CardPaymentForm
                  orderId={orderId}
                  payment={payment}
                  onSynchronized={handleCardSynchronized}
                />
              </Elements>
            ) : null}

            {stripePromise && canShowCardRetry ? (
              <Button
                variant="outline"
                onClick={() => {
                  setCardSession(null);
                  setCardError(null);
                  void startOrResumeCard();
                }}
                disabled={startingCard}
              >
                {startingCard ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 size-4" />
                )}
                Start a New Card Attempt
              </Button>
            ) : null}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
