import { useState, useCallback } from "react";

type PaginatedResult<T> = {
  data: T[];
  totalCount: number;
  nextCursor?: string;
};

type UseCursorPaginationOptions<T> = {
  initialData: T[];
  initialTotal: number;
  initialNextCursor?: string;
  limit: number;
  fetchPage: (cursor?: string) => Promise<PaginatedResult<T>>;
};

export function useCursorPagination<T>({
  initialData,
  initialTotal,
  initialNextCursor,
  limit,
  fetchPage,
}: UseCursorPaginationOptions<T>) {
  const [data, setData] = useState(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [loading, setLoading] = useState(false);

  const page = cursorStack.length;
  const hasPrevious = page > 1;

  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = (page - 1) * limit + data.length;

  const hasNext = !!nextCursor && showingTo !== total;

  const goNext = useCallback(async () => {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const result = await fetchPage(nextCursor);
      setCursorStack((prev) => [...prev, nextCursor]);
      setData(result.data);
      setTotal(result.totalCount);
      setNextCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [nextCursor, fetchPage]);

  const goPrevious = useCallback(async () => {
    if (!hasPrevious) return;
    setLoading(true);
    try {
      const prevCursor = cursorStack[cursorStack.length - 2];
      const result = await fetchPage(prevCursor);
      setCursorStack((prev) => prev.slice(0, -1));
      setData(result.data);
      setTotal(result.totalCount);
      setNextCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [hasPrevious, cursorStack, fetchPage]);

  return {
    data,
    total,
    page,
    hasNext,
    hasPrevious,
    goNext,
    goPrevious,
    showingFrom,
    showingTo,
    loading,
  };
}
