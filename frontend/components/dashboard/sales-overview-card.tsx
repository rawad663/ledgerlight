"use client";

import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApiClient } from "@/hooks/use-api";
import { type components } from "@/lib/api-types";
import { formatCurrencyCents } from "@/lib/formatters";

type DashboardSalesOverview =
  components["schemas"]["DashboardSalesOverviewDto"];
type DashboardSalesTimeline = DashboardSalesOverview["timeline"];

type SalesOverviewCardProps = {
  salesOverview: DashboardSalesOverview | null;
  salesOverviewError?: string | null;
};

const timelineOptions: Array<{
  value: DashboardSalesTimeline;
  label: string;
}> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function formatPeriodLabel(overview: DashboardSalesOverview): string {
  const periodStart = new Date(overview.periodStart);
  const periodEndExclusive = new Date(overview.periodEnd);
  const periodEnd = new Date(periodEndExclusive);

  periodEnd.setDate(periodEnd.getDate() - 1);

  if (overview.timeline === "day") {
    return periodStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (overview.timeline === "month") {
    return periodStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  const startLabel = periodStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = periodEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

function formatChartAxisCurrency(value: number): string {
  if (value === 0) {
    return "$0";
  }

  return formatCurrencyCents(value).replace(/\.00$/, "");
}

function formatChartTooltipLabel(label: string): string {
  return label;
}

function formatSalesOverviewError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "We couldn't load the sales overview right now.";
}

export function SalesOverviewCard({
  salesOverview: initialSalesOverview,
  salesOverviewError: initialSalesOverviewError,
}: SalesOverviewCardProps) {
  const apiClient = useApiClient();
  const [salesOverview, setSalesOverview] =
    React.useState(initialSalesOverview);
  const [salesOverviewError, setSalesOverviewError] = React.useState(
    initialSalesOverviewError ?? null,
  );
  const [selectedTimeline, setSelectedTimeline] =
    React.useState<DashboardSalesTimeline>(
      initialSalesOverview?.timeline ?? "week",
    );
  const [isLoading, setIsLoading] = React.useState(false);

  const loadSalesOverview = React.useCallback(
    async (timeline: DashboardSalesTimeline, anchor?: string) => {
      const previousTimeline = selectedTimeline;

      setIsLoading(true);
      setSalesOverviewError(null);

      const { data, error } = await apiClient.GET("/dashboard/sales-overview", {
        params: {
          query: {
            timeline,
            anchor,
          },
        },
      });

      if (error || !data) {
        setSalesOverviewError(formatSalesOverviewError(error));
        setSelectedTimeline(previousTimeline);
        setIsLoading(false);
        return;
      }

      setSalesOverview(data);
      setSelectedTimeline(data.timeline);
      setIsLoading(false);
    },
    [apiClient, selectedTimeline],
  );

  const handleTimelineChange = React.useCallback(
    (value: string) => {
      if (!value || value === selectedTimeline || isLoading) {
        return;
      }

      void loadSalesOverview(value as DashboardSalesTimeline);
    },
    [isLoading, loadSalesOverview, selectedTimeline],
  );

  const currentOverview = salesOverview;
  const canNavigate = Boolean(currentOverview) && !isLoading;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Sales Overview</CardTitle>
              {isLoading ? <Spinner className="size-4" /> : null}
            </div>
            <CardDescription>
              {currentOverview
                ? `Confirmed and fulfilled sales for ${formatPeriodLabel(currentOverview)}`
                : "Confirmed and fulfilled sales for the selected timeline."}
            </CardDescription>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4 text-success" />
              <span>
                {currentOverview
                  ? `Total ${formatCurrencyCents(currentOverview.totalSalesCents)}`
                  : "Sales data unavailable right now."}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={selectedTimeline}
              onValueChange={handleTimelineChange}
              aria-label="Sales timeline"
            >
              {timelineOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={`${option.label} timeline`}
                  className="px-3"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  currentOverview
                    ? void loadSalesOverview(
                        selectedTimeline,
                        currentOverview.previousAnchor,
                      )
                    : undefined
                }
                disabled={!canNavigate}
              >
                <ChevronLeft className="mr-1.5 size-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadSalesOverview(selectedTimeline)}
                disabled={isLoading}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  currentOverview
                    ? void loadSalesOverview(
                        selectedTimeline,
                        currentOverview.nextAnchor,
                      )
                    : undefined
                }
                disabled={!canNavigate || currentOverview?.isCurrentPeriod}
              >
                Next
                <ChevronRight className="ml-1.5 size-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {salesOverviewError ? (
          <div className="mb-4">
            <Alert variant="destructive">
              <AlertTitle>Sales overview unavailable</AlertTitle>
              <AlertDescription>{salesOverviewError}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        {currentOverview ? (
          <>
            <div
              className={`h-[300px] w-full transition-opacity ${
                isLoading ? "opacity-60" : "opacity-100"
              }`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={currentOverview.buckets}>
                  <defs>
                    <linearGradient
                      id="salesOverviewGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-primary)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    minTickGap={24}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tickFormatter={formatChartAxisCurrency}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrencyCents(Number(value))}
                    labelFormatter={formatChartTooltipLabel}
                  />
                  <Area
                    type="monotone"
                    dataKey="salesCents"
                    stroke="var(--color-primary)"
                    fill="url(#salesOverviewGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {currentOverview.totalSalesCents === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No confirmed or fulfilled orders were placed in this period.
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            No sales overview is available yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
