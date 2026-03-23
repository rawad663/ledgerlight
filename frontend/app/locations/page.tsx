import { AppShell } from "@/components/app-shell";
import { PlaceholderPage } from "@/components/placeholder-page";
import { MapPin } from "lucide-react";

export default function Locations() {
  return (
    <AppShell>
      <PlaceholderPage
        title="Locations"
        description="Manage your store locations and settings."
        icon={MapPin}
      />
    </AppShell>
  );
}
