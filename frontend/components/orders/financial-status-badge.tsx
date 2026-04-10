"use client";

import { Badge } from "@/components/ui/badge";
import { formatEnumLabel } from "@/lib/formatters";
import {
  FINANCIAL_STATUS_STYLES,
  type FinancialStatus,
} from "@/lib/status";
import { cn } from "@/lib/utils";

type FinancialStatusBadgeProps = {
  status: FinancialStatus;
  className?: string;
};

export function FinancialStatusBadge({
  status,
  className,
}: FinancialStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", FINANCIAL_STATUS_STYLES[status], className)}
    >
      {formatEnumLabel(status)}
    </Badge>
  );
}
