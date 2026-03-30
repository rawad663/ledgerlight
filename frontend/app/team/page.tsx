import { UserCog } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MockFeaturePage } from "@/components/mock/mock-feature-page";
import { teamPageMock } from "@/lib/mocks/team";

export default function Team() {
  return (
    <AppShell>
      <MockFeaturePage icon={UserCog} data={teamPageMock} />
    </AppShell>
  );
}
