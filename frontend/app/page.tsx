import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import {
  DashboardPage,
  type DashboardPageProps,
} from "@/components/dashboard/dashboard-page";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { createApi } from "@/lib/api";
import { type ApiError } from "@/lib/api-config";
import { canAccessDashboard } from "@/lib/dashboard-access";
import { getServerCurrentRole } from "@/lib/server-auth";

const DASHBOARD_RECENT_ORDERS_LIMIT = 5;
const DASHBOARD_LOW_STOCK_LIMIT = 5;

type OrderViewQuery = {
  search?: string;
  status?: string;
  location?: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
};

function buildOrdersViewHref(query: OrderViewQuery): string {
  const searchParams = new URLSearchParams();

  if (query.search) searchParams.set("search", query.search);
  if (query.status) searchParams.set("status", query.status);
  if (query.location) searchParams.set("location", query.location);
  searchParams.set("sortBy", query.sortBy);
  searchParams.set("sortOrder", query.sortOrder);

  const suffix = searchParams.toString();

  return suffix ? `/orders?${suffix}` : "/orders";
}

function toFriendlyMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (!error || typeof error !== "object") {
    return fallbackMessage;
  }

  const apiError = error as ApiError;

  return apiError.message || fallbackMessage;
}

async function DashboardPageContent() {
  const currentRole = await getServerCurrentRole();

  if (!canAccessDashboard(currentRole)) {
    redirect("/products");
  }

  const api = await createApi();
  const recentOrdersQuery: OrderViewQuery = {
    sortBy: "createdAt",
    sortOrder: "desc",
  };

  const [summaryResult, recentOrdersResult, lowStockResult] = await Promise.all([
    api.GET("/dashboard/summary"),
    api.GET("/orders", {
      params: {
        query: {
          ...recentOrdersQuery,
          limit: DASHBOARD_RECENT_ORDERS_LIMIT,
          withItems: false,
        },
      },
    }),
    api.GET("/inventory", {
      params: {
        query: {
          lowStockOnly: true,
          sortBy: "stockGap",
          sortOrder: "desc",
          limit: DASHBOARD_LOW_STOCK_LIMIT,
        },
      },
    }),
  ]);

  const props: DashboardPageProps = {
    summary: summaryResult.data ?? null,
    summaryError: summaryResult.error
      ? toFriendlyMessage(
          summaryResult.error,
          "We couldn't load the dashboard metrics right now.",
        )
      : null,
    recentOrders: recentOrdersResult.data?.data ?? [],
    recentOrdersError: recentOrdersResult.error
      ? toFriendlyMessage(
          recentOrdersResult.error,
          "We couldn't load the recent orders right now.",
        )
      : null,
    recentOrdersHref: buildOrdersViewHref(recentOrdersQuery),
    lowStockItems: lowStockResult.data?.data ?? [],
    lowStockError: lowStockResult.error
      ? toFriendlyMessage(
          lowStockResult.error,
          "We couldn't load the low stock watchlist right now.",
        )
      : null,
    lowStockHref: "/inventory?lowStockOnly=true",
  };

  return <DashboardPage {...props} />;
}

export default function Home() {
  return (
    <AppShell>
      <Suspense fallback={<DashboardPageSkeleton />}>
        <DashboardPageContent />
      </Suspense>
    </AppShell>
  );
}
