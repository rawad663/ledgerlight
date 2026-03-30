"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationFooterProps = {
  itemLabel: string;
  total: number;
  showingFrom: number;
  showingTo: number;
  hasPrevious: boolean;
  hasNext: boolean;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function PaginationFooter({
  itemLabel,
  total,
  showingFrom,
  showingTo,
  hasPrevious,
  hasNext,
  loading,
  onPrevious,
  onNext,
}: PaginationFooterProps) {
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium">
          {total === 0 ? 0 : showingFrom}–{showingTo}
        </span>{" "}
        of <span className="font-medium">{total}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrevious || loading}
          onClick={onPrevious}
        >
          <ChevronLeft className="mr-1 size-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext || loading}
          onClick={onNext}
        >
          Next
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}
