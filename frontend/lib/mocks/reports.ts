import type { MockFeaturePageData } from "@/lib/mocks/mock-feature-page";

export const reportsPageMock: MockFeaturePageData = {
  title: "Reports",
  description: "View analytics and generate business reports.",
  summaryCards: [
    { label: "Saved Reports", value: "6", description: "Mock reporting templates for upcoming analytics work" },
    { label: "Scheduled Exports", value: "3", description: "Recurring exports represented with static mock data" },
    { label: "Key Metrics", value: "14", description: "Tracked KPIs planned for v1 reporting" },
  ],
  sections: [
    {
      title: "Reporting Queue",
      description: "Mock report definitions currently used to shape the UI.",
      items: [
        { title: "Daily sales summary", description: "Revenue, order count, and refund totals by day.", meta: "Runs at 8:00 AM" },
        { title: "Inventory health snapshot", description: "Low-stock, out-of-stock, and reorder trend summary.", meta: "Runs at 9:00 AM" },
        { title: "Customer retention rollup", description: "Repeat purchase behavior over the last 90 days.", meta: "Draft only" },
      ],
    },
    {
      title: "Open Questions",
      description: "Still-mock decisions that will later be replaced with live reporting behavior.",
      items: [
        { title: "CSV export shape", description: "Column sets and scheduled delivery options are not finalized." },
        { title: "Multi-location filters", description: "Filter precedence between org-wide and per-store reporting is still open." },
      ],
    },
  ],
};
