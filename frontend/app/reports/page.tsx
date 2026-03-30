import { BarChart3 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MockFeaturePage } from "@/components/mock/mock-feature-page";
import { reportsPageMock } from "@/lib/mocks/reports";

export default function Reports() {
  return (
    <AppShell>
      <MockFeaturePage icon={BarChart3} data={reportsPageMock} />
    </AppShell>
  );
}
