import { AppShell } from "@/components/app-shell"
import { PlaceholderPage } from "@/components/placeholder-page"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <AppShell>
      <PlaceholderPage
        title="Settings"
        description="Configure your account and application preferences."
        icon={Settings}
      />
    </AppShell>
  )
}
