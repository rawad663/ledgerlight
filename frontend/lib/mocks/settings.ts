import type { MockFeaturePageData } from "@/lib/mocks/mock-feature-page";

export const settingsPageMock: MockFeaturePageData = {
  title: "Settings",
  description: "Configure your account and application preferences.",
  summaryCards: [
    { label: "Configured Policies", value: "9", description: "Mock policy areas represented for future settings work" },
    { label: "Notification Channels", value: "4", description: "Email, SMS, push, and internal alerts" },
    { label: "Brand Profiles", value: "2", description: "Storefront themes and receipt branding presets" },
  ],
  sections: [
    {
      title: "Organization Preferences",
      description: "Mock settings categories that will later map to persisted configuration.",
      items: [
        { title: "Receipt branding", description: "Logo, footer text, and print options.", meta: "Draft defaults loaded" },
        { title: "Tax configuration", description: "Regional tax presets and manual overrides.", meta: "Pending backend model" },
        { title: "Notification defaults", description: "Alert thresholds and channel preferences.", meta: "UI only" },
      ],
    },
    {
      title: "Implementation Notes",
      description: "Mock-only notes to keep the UI realistic while the feature is incomplete.",
      items: [
        { title: "Settings persistence", description: "The backend contract has not been finalized yet." },
        { title: "Role-based visibility", description: "Admin-only sections will be enforced when permissions are implemented." },
      ],
    },
  ],
};
