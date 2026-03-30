import { MapPin } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MockFeaturePage } from "@/components/mock/mock-feature-page";
import { locationsPageMock } from "@/lib/mocks/locations";

export default function Locations() {
  return (
    <AppShell>
      <MockFeaturePage icon={MapPin} data={locationsPageMock} />
    </AppShell>
  );
}
