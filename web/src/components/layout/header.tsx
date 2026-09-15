"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

const titles: Record<string, string> = {
  dashboard: "Dashboard",
  marketplace: "Marketplace",
  news: "Noticias",
  forum: "Foro",
  businesses: "Negocios",
  barrios: "Barrios",
};

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const segment = pathname.split("/")[1];
  const title = titles[segment] || "Panel Administrativo";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--divider)] bg-[var(--surface)] px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpenMenu} className="rounded-lg p-2 text-[var(--text-body)] hover:bg-[var(--surface-flat)] lg:hidden" aria-label="Abrir menú">
          <Menu size={20} />
        </button>
        <h2 className="text-lg font-semibold text-[var(--text)] sm:text-xl">{title}</h2>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden items-center rounded-md bg-[var(--primary-soft)] px-2.5 py-0.5 text-sm font-medium text-[var(--primary-dark)] sm:inline-flex">
          Modo Administrador
        </span>
      </div>
    </header>
  );
}
