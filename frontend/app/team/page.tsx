import { AppShell } from "@/components/app-shell"
import { PlaceholderPage } from "@/components/placeholder-page"
import { UserCog } from "lucide-react"

export default function Team() {
  return (
    <AppShell>
      <PlaceholderPage
        title="Team"
        description="Manage team members and permissions."
        icon={UserCog}
      />
    </AppShell>
  )
}
