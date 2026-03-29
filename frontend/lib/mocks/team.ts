import type { MockFeaturePageData } from "@/lib/mocks/mock-feature-page";

export const teamPageMock: MockFeaturePageData = {
  title: "Team",
  description: "Manage team members, roles, and permissions.",
  summaryCards: [
    { label: "Members", value: "18", description: "Mock roster synced for UI development" },
    { label: "Managers", value: "4", description: "Users with elevated access in the mock org" },
    { label: "Pending Invites", value: "2", description: "Invitations still awaiting acceptance" },
  ],
  sections: [
    {
      title: "Active Roles",
      description: "Mock role definitions that will later map to real authorization rules.",
      items: [
        { title: "Store Manager", description: "Can manage products, inventory, and staff operations.", meta: "4 assigned" },
        { title: "Sales Associate", description: "Can create orders and view customer records.", meta: "10 assigned" },
        { title: "Operations Lead", description: "Can review reports and inventory health.", meta: "2 assigned" },
      ],
    },
    {
      title: "Upcoming Work",
      description: "Placeholder tasks for the eventual team-management workflow.",
      items: [
        { title: "Invite flow finalization", description: "Email invite + role selection flow still pending backend support." },
        { title: "Audit log visibility", description: "Need a final policy for when role changes become visible in the UI." },
      ],
    },
  ],
};
