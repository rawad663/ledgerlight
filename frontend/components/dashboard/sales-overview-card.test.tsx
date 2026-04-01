import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SalesOverviewCard } from "@/components/dashboard/sales-overview-card";

const getMock = vi.fn();

vi.mock("@/hooks/use-api", () => ({
  useApiClient: () => ({
    GET: getMock,
  }),
}));

const baseSalesOverview = {
  timeline: "week" as const,
  anchor: "2026-03-30T00:00:00.000Z",
  periodStart: "2026-03-30T00:00:00.000Z",
  periodEnd: "2026-04-06T00:00:00.000Z",
  previousAnchor: "2026-03-23T00:00:00.000Z",
  nextAnchor: "2026-04-06T00:00:00.000Z",
  isCurrentPeriod: true,
  totalSalesCents: 456700,
  buckets: [
    {
      bucketStart: "2026-03-30T00:00:00.000Z",
      bucketEnd: "2026-03-31T00:00:00.000Z",
      label: "Mon",
      salesCents: 120000,
    },
    {
      bucketStart: "2026-03-31T00:00:00.000Z",
      bucketEnd: "2026-04-01T00:00:00.000Z",
      label: "Tue",
      salesCents: 90000,
    },
  ],
};

describe("SalesOverviewCard", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("renders the live sales total and disables next on the current period", () => {
    render(
      <SalesOverviewCard
        salesOverview={baseSalesOverview}
        salesOverviewError={null}
      />,
    );

    expect(screen.getByText("Sales Overview")).toBeInTheDocument();
    expect(screen.getByText("Total $4567.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("switches timeline and requests live sales overview data", async () => {
    const user = userEvent.setup();

    getMock.mockResolvedValue({
      data: {
        ...baseSalesOverview,
        timeline: "day",
        anchor: "2026-04-01T00:00:00.000Z",
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-02T00:00:00.000Z",
        previousAnchor: "2026-03-31T00:00:00.000Z",
        nextAnchor: "2026-04-02T00:00:00.000Z",
        isCurrentPeriod: true,
        totalSalesCents: 250000,
        buckets: [
          {
            bucketStart: "2026-04-01T00:00:00.000Z",
            bucketEnd: "2026-04-01T01:00:00.000Z",
            label: "12 AM",
            salesCents: 10000,
          },
        ],
      },
    });

    render(
      <SalesOverviewCard
        salesOverview={baseSalesOverview}
        salesOverviewError={null}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "Day timeline" }));

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/dashboard/sales-overview", {
        params: {
          query: {
            timeline: "day",
            anchor: undefined,
          },
        },
      });
    });

    expect(screen.getByText("Total $2500.00")).toBeInTheDocument();
  });

  it("keeps the last successful chart visible when a refetch fails", async () => {
    const user = userEvent.setup();

    getMock.mockResolvedValue({
      error: {
        message: "Sales endpoint failed",
      },
    });

    render(
      <SalesOverviewCard
        salesOverview={baseSalesOverview}
        salesOverviewError={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Today" }));

    await waitFor(() => {
      expect(
        screen.getByText("Sales overview unavailable"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Total $4567.00")).toBeInTheDocument();
    expect(screen.getByText("Sales endpoint failed")).toBeInTheDocument();
  });
});
