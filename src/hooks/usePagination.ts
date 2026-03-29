import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  pageSize?: number;
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { pageSize = 20 } = options;
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));
  const nextPage = () => goToPage(safePage + 1);
  const prevPage = () => goToPage(safePage - 1);

  // Reset to page 1 when items change significantly
  const resetPage = () => setPage(1);

  return {
    items: paginatedItems,
    page: safePage,
    totalPages,
    totalItems: items.length,
    pageSize,
    goToPage,
    nextPage,
    prevPage,
    resetPage,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}
