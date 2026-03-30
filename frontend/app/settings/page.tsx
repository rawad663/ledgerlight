import { Settings } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MockFeaturePage } from "@/components/mock/mock-feature-page";
import { settingsPageMock } from "@/lib/mocks/settings";

export default function SettingsPage() {
  return (
    <AppShell>
      <MockFeaturePage icon={Settings} data={settingsPageMock} />
    </AppShell>
  );
}
