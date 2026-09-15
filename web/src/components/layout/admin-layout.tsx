"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Loader2 } from "lucide-react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <Loader2 className="animate-spin text-[var(--primary)]" size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via AuthContext
  }

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú" />
          <aside className="relative h-full w-64 shadow-xl">
            <Sidebar onNavigate={() => setIsMenuOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenMenu={() => setIsMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
