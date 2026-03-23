import { AppShell } from "@/components/app-shell"
import { PlaceholderPage } from "@/components/placeholder-page"
import { BarChart3 } from "lucide-react"

export default function Reports() {
  return (
    <AppShell>
      <PlaceholderPage
        title="Reports"
        description="View analytics and generate business reports."
        icon={BarChart3}
      />
    </AppShell>
  )
}
