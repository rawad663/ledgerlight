"use client"

import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
}

export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
            <Icon className="size-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">Coming Soon</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            This section is under development. Check back soon for updates.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
