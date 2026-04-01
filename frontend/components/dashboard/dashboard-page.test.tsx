import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DashboardPage,
  type DashboardPageProps,
} from "@/components/dashboard/dashboard-page";

vi.mock("@/components/orders/create-order-form", () => ({
  CreateOrderForm: ({
    open,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (open ? <div>Create Order Sheet</div> : null),
}));

const baseProps: DashboardPageProps = {
  summary: {
    todaysSalesCents: 456700,
    ordersTodayCount: 12,
    lowStockItemsCount: 2,
    activeCustomersCount: 27,
  },
  summaryError: null,
  recentOrders: [
    {
      id: "12345678-1234-1234-1234-123456789012",
      organizationId: "org-1",
      customerId: "cust-1",
      locationId: "loc-1",
      status: "CONFIRMED",
      subtotalCents: 10000,
      taxCents: 0,
      discountCents: 0,
      totalCents: 10000,
      createdAt: "2026-03-31T10:00:00.000Z",
      updatedAt: "2026-03-31T10:00:00.000Z",
      placedAt: "2026-03-31T10:05:00.000Z",
      cancelledAt: null,
      customer: { id: "cust-1", name: "Jane Doe", email: "jane@example.com" },
      location: null,
    },
  ],
  recentOrdersError: null,
  recentOrdersHref: "/orders?sortBy=createdAt&sortOrder=desc",
  lowStockItems: [
    {
      productId: "prod-1",
      name: "Intentional Tee",
      sku: "WID-A",
      totalQuantity: 3,
      reorderThreshold: 10,
      stockGap: 7,
      isLowStock: true,
      locations: [
        { locationId: "loc-1", locationName: "Montreal", quantity: 2 },
        { locationId: "loc-2", locationName: "Toronto", quantity: 1 },
      ],
    },
  ],
  lowStockError: null,
  lowStockHref: "/inventory?lowStockOnly=true",
};

describe("DashboardPage", () => {
  it("renders live recent-order and low-stock drill-through links", () => {
    render(<DashboardPage {...baseProps} />);

    const viewMoreLinks = screen.getAllByRole("link", { name: "View More" });

    expect(viewMoreLinks[0]).toHaveAttribute(
      "href",
      "/inventory?lowStockOnly=true",
    );
    expect(viewMoreLinks[1]).toHaveAttribute(
      "href",
      "/orders?sortBy=createdAt&sortOrder=desc",
    );
    expect(
      screen.getByRole("link", { name: /ord-12345678/i }),
    ).toHaveAttribute("href", "/orders/12345678-1234-1234-1234-123456789012");
  });

  it("shows low-stock location distribution and opens the create-order sheet", async () => {
    const user = userEvent.setup();

    render(<DashboardPage {...baseProps} />);

    expect(
      screen.getByText("Montreal: 2, Toronto: 1"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create Order" }));

    expect(screen.getByText("Create Order Sheet")).toBeInTheDocument();
  });
});
