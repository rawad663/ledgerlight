import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
const postMock = vi.fn();
const loadStripeMock = vi.fn(() => Promise.resolve({}));
const toastMock = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useApiClient: () => ({
    GET: getMock,
    POST: postMock,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: toastMock,
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: loadStripeMock,
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
  PaymentElement: () => (
    <div data-testid="payment-element">
      Expanded payment element with address fields
    </div>
  ),
  useElements: () => ({}),
  useStripe: () => ({}),
}));

function findAncestorWithClass(element: HTMLElement, className: string) {
  let current: HTMLElement | null = element;

  while (current) {
    if (current.classList.contains(className)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

describe("ProcessPaymentDialog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_dialog_scroll");
    getMock.mockReset();
    postMock.mockReset();
    loadStripeMock.mockClear();
    toastMock.mockReset();
  });

  it("keeps the Stripe form and submit button inside the scrollable body", async () => {
    getMock.mockResolvedValue({
      data: {
        id: "payment-1",
        orderId: "order-1",
        organizationId: "org-1",
        method: "CARD",
        paymentStatus: "UNPAID",
        refundStatus: "NONE",
        financialStatus: "UNPAID",
        amountCents: 2599,
        currencyCode: "CAD",
        paidAt: null,
        refundRequestedAt: null,
        refundedAt: null,
        stripeRefundId: null,
        refundFailedAt: null,
        refundReason: null,
        lastPaymentFailure: null,
        lastRefundFailure: null,
        latestAttempt: null,
        createdAt: "2026-04-18T12:00:00.000Z",
        updatedAt: "2026-04-18T12:00:00.000Z",
      },
    });
    postMock.mockImplementation(async (path: string) => {
      if (path === "/payments/{orderId}/card") {
        return {
          data: {
            paymentId: "payment-1",
            attemptId: "attempt-1",
            clientSecret: "pi_secret_123",
            paymentStatus: "PENDING",
            attemptStatus: "PENDING",
          },
        };
      }

      throw new Error(`Unexpected POST ${path}`);
    });

    const { ProcessPaymentDialog } = await import(
      "@/components/orders/process-payment-dialog"
    );

    render(
      <ProcessPaymentDialog
        open
        onOpenChange={() => {}}
        orderId="11111111-1111-1111-1111-111111111111"
        paymentSummary={{
          id: "payment-1",
          method: "CARD",
          paymentStatus: "UNPAID",
          refundStatus: "NONE",
          financialStatus: "UNPAID",
          amountCents: 2599,
          currencyCode: "CAD",
          paidAt: null,
          refundRequestedAt: null,
          refundedAt: null,
        }}
      />,
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Process Payment",
    });

    await waitFor(() => {
      expect(loadStripeMock).toHaveBeenCalledWith("pk_test_dialog_scroll");
      expect(postMock).toHaveBeenCalledWith("/payments/{orderId}/card", {
        params: {
          path: {
            orderId: "11111111-1111-1111-1111-111111111111",
          },
        },
      });
    });

    const paymentElement = await screen.findByTestId("payment-element");
    const submitButton = screen.getByRole("button", {
      name: "Submit Card Payment",
    });
    const scrollBody = findAncestorWithClass(paymentElement, "overflow-y-auto");

    expect(dialog).toHaveClass("overflow-hidden");
    expect(dialog).toHaveClass("max-h-[calc(100vh-2rem)]");
    expect(scrollBody).not.toBeNull();
    expect(scrollBody).toContainElement(paymentElement);
    expect(scrollBody).toContainElement(submitButton);
    expect(dialog.querySelector('[data-slot="dialog-footer"]')).toHaveClass(
      "shrink-0",
    );
  });
});
