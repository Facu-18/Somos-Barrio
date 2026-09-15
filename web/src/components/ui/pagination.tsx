import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--divider)] px-4 py-3 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span>
        Página {page} de {totalPages} · {total} resultados
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--divider)] px-3 py-1.5 font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--surface-flat)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} /> Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--divider)] px-3 py-1.5 font-medium text-[var(--text-body)] transition-colors hover:bg-[var(--surface-flat)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
