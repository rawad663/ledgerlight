import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCursorPagination } from "@/hooks/use-cursor-pagination";

describe("useCursorPagination", () => {
  it("paginates forward and backward while preserving counts", async () => {
    const fetchPage = vi.fn(async (cursor?: string) => {
      if (cursor === "page-2") {
        return {
          data: [{ id: "3" }, { id: "4" }],
          totalCount: 4,
          nextCursor: undefined,
        };
      }

      return {
        data: [{ id: "1" }, { id: "2" }],
        totalCount: 4,
        nextCursor: "page-2",
      };
    });

    const { result } = renderHook(() =>
      useCursorPagination({
        initialData: [{ id: "1" }, { id: "2" }],
        initialTotal: 4,
        initialNextCursor: "page-2",
        limit: 2,
        filterKey: "initial",
        fetchPage,
      }),
    );

    await act(async () => {
      await result.current.goNext();
    });

    expect(result.current.data).toEqual([{ id: "3" }, { id: "4" }]);
    expect(result.current.hasPrevious).toBe(true);

    await act(async () => {
      await result.current.goPrevious();
    });

    expect(result.current.data).toEqual([{ id: "1" }, { id: "2" }]);
    expect(fetchPage).toHaveBeenCalledWith("page-2");
    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });

  it("refetches from the first page when the filter key changes", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: "filtered" }],
        totalCount: 1,
        nextCursor: undefined,
      });

    const { result, rerender } = renderHook(
      ({ filterKey }) =>
        useCursorPagination({
          initialData: [{ id: "1" }],
          initialTotal: 1,
          initialNextCursor: undefined,
          limit: 50,
          filterKey,
          fetchPage,
        }),
      {
        initialProps: { filterKey: "before" },
      },
    );

    rerender({ filterKey: "after" });

    await waitFor(() => {
      expect(result.current.data).toEqual([{ id: "filtered" }]);
    });

    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });
});
