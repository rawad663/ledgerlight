# Shared Dialog Scrolling for Expanded Payment Forms

## Summary

Fix the payment-modal regression by making long dialogs usable across the app, while giving the Stripe-heavy process-payment flow a stronger layout so expanded address fields never push the primary action out of reach.

## Key Changes

- Update the shared `DialogContent` behavior in `frontend/components/ui/dialog.tsx` to cap dialog height to the viewport and allow vertical scrolling by default.
- Keep override behavior intact for callers that already opt into custom overflow handling, such as the command palette.
- Refine `frontend/components/orders/process-payment-dialog.tsx` so the dialog is structured as a fixed header + scrollable body + persistent footer layout.
- Keep the Stripe `PaymentElement` and its submit CTA inside the scrollable payment section so expanded billing/address fields remain reachable without the dialog exceeding the viewport.
- Do not change any backend APIs, DTOs, or payment flow semantics. The only interface change is shared frontend dialog behavior: standard dialogs become viewport-bounded and scrollable by default.

## Test Plan

- Add a focused frontend component test for the shared dialog primitive that verifies the default dialog content renders with the new viewport-bound, scrollable classes and that explicit caller overrides still apply.
- Add a focused component test for the process-payment dialog with mocked Stripe hooks/components and mocked API responses, covering the card tab path and asserting the rendered dialog uses the scroll-safe layout around the expanded payment form.
- Keep the existing orders integration test unchanged unless the new layout affects accessible names or button placement. No Stripe browser automation is required for this fix.

## Docs

- Update `docs/domains/payment.md` to note that the embedded Stripe payment dialog now uses a viewport-bounded scrollable layout so expanded payment/address fields remain usable on smaller screens.
- Update `docs/domains/order.md` anywhere the order-detail payment action flow is described so the current modal behavior matches the UI.

## Assumptions

- Scope choice is locked to `All dialogs`, so the shared dialog primitive will change rather than applying a payment-only CSS patch.
- The v1 fix will use scrollable dialog content, not a new sticky global footer pattern.
- `CommandDialog` will continue to rely on its existing `overflow-hidden p-0` override, so its behavior should remain unchanged.
