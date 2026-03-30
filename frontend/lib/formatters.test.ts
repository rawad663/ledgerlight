import { describe, expect, it } from "vitest";

import {
  dollarsToCents,
  formatCurrencyAmount,
  formatCurrencyCents,
  formatDateTime,
  formatEnumLabel,
  formatOrderId,
  formatShortDate,
  getInitials,
} from "@/lib/formatters";

describe("formatters", () => {
  it("formats currency cents consistently", () => {
    expect(formatCurrencyCents(2450)).toBe("$24.50");
  });

  it("formats whole amounts consistently", () => {
    expect(formatCurrencyAmount(24.5)).toBe("$24.50");
  });

  it("formats order ids with the current prefix convention", () => {
    expect(formatOrderId("12345678-abcd-efgh")).toBe("ORD-12345678");
  });

  it("formats enum labels in a user-friendly way", () => {
    expect(formatEnumLabel("COUNT_CORRECTION")).toBe("Count Correction");
  });

  it("derives initials from a display name", () => {
    expect(getInitials("Ledger Light Admin")).toBe("LL");
  });

  it("converts dollars to cents using the existing rounding behavior", () => {
    expect(dollarsToCents("10.25")).toBe(1025);
    expect(dollarsToCents("-2")).toBe(0);
  });

  it("formats dates for short and date-time display", () => {
    expect(formatShortDate("2026-03-29T10:30:00.000Z")).toContain("2026");
    expect(formatDateTime("2026-03-29T10:30:00.000Z")).toContain("2026");
  });
});
