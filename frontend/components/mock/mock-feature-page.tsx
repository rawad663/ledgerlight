import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MockFeaturePageData } from "@/lib/mocks/mock-feature-page";

type MockFeaturePageProps = {
  icon: LucideIcon;
  data: MockFeaturePageData;
};

export function MockFeaturePage({
  icon: Icon,
  data,
}: MockFeaturePageProps) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={data.title}
        description={data.description}
        actions={
          <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Icon className="size-4" />
            Mock-backed preview
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {data.summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{card.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {data.sections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {section.description}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item) => (
                <div
                  key={`${section.title}-${item.title}`}
                  className="rounded-md border p-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    {item.meta ? (
                      <span className="text-xs text-muted-foreground">
                        {item.meta}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
