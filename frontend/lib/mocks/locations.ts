import type { MockFeaturePageData } from "@/lib/mocks/mock-feature-page";

export const locationsPageMock: MockFeaturePageData = {
  title: "Locations",
  description: "Manage store locations, hours, and operational settings.",
  summaryCards: [
    { label: "Active Stores", value: "4", description: "Currently visible to staff" },
    { label: "Pickup Enabled", value: "3", description: "Locations accepting pickup orders" },
    { label: "Low Stock Alerts", value: "12", description: "Alerts aggregated across locations" },
  ],
  sections: [
    {
      title: "Store Rollout",
      description: "Mock rollout data for future multi-location management.",
      items: [
        { title: "Downtown Flagship", description: "Open 9am - 9pm with full catalog enabled.", meta: "Toronto, ON" },
        { title: "West End Pop-Up", description: "Seasonal store with limited inventory sync.", meta: "Toronto, ON" },
        { title: "Warehouse Pickup", description: "Supports pickup only and internal stock transfers.", meta: "Mississauga, ON" },
      ],
    },
    {
      title: "Pending Workflows",
      description: "Mock tasks that will later map to real operational tooling.",
      items: [
        { title: "Holiday hours review", description: "Schedule overrides still need approval from operations." },
        { title: "Pickup readiness template", description: "Standard pickup prep SLA has not been finalized yet." },
      ],
    },
  ],
};
