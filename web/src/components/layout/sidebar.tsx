"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  LayoutDashboard,
  ShoppingBag,
  Newspaper,
  MessageSquare,
  Store,
  MapPin,
  LogOut,
  X,
} from "lucide-react";
import clsx from "clsx";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { name: "Noticias", href: "/news", icon: Newspaper },
  { name: "Foro", href: "/forum", icon: MessageSquare },
  { name: "Negocios", href: "/businesses", icon: Store, adminOnly: true },
  { name: "Barrios", href: "/barrios", icon: MapPin, adminOnly: true },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <div className="flex h-full w-64 flex-col border-r border-[var(--divider)] bg-[var(--surface)]">
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <h1 className="text-xl font-bold text-[var(--primary-dark)]">Somos Barrio</h1>
        {onNavigate && (
          <button type="button" onClick={onNavigate} className="rounded-lg p-1 text-[var(--text-muted)] lg:hidden" aria-label="Cerrar menú">
            <X size={20} />
          </button>
        )}
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
        <nav className="flex-1 space-y-1 px-4">
          {navigation.filter((item) => !item.adminOnly || user?.role === "ADMIN").map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={clsx(
                  isActive
                    ? "bg-[var(--primary-soft)] text-[var(--primary-dark)]"
                    : "text-[var(--text-body)] hover:bg-[var(--surface-flat)] hover:text-[var(--text)]",
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors"
                )}
              >
                <item.icon
                  className={clsx(
                    isActive ? "text-[var(--primary-dark)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-body)]",
                    "mr-3 h-5 w-5 shrink-0"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[var(--divider)] p-4">
        <div className="mb-4 flex items-center px-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-[var(--text)]">{user?.name || "Admin"}</p>
            <p className="max-w-[140px] truncate text-xs font-medium text-[var(--text-muted)]">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
