"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  Calendar,
  Clock3,
  Map,
  MessageSquare,
  Newspaper,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";

type Stats = {
  users: number;
  barrios: number;
  news: number;
  businesses: number;
  marketplacePosts: number;
  events: number;
};

type Metrics = {
  scope: "GLOBAL" | "BARRIO";
  window: { days: number };
  queues: {
    forum: { pendingThreads: number; pendingReplies: number; openReports: number; pendingAppeals: number };
    marketplace: { pendingPosts: number; openReports: number; pendingAppeals: number; quarantinedAssets: number };
    totalPending: number;
    oldestPendingHours: number;
  };
  ai: { generations: number; cacheHitRate: number; estimatedCostUsd: number };
  alerts: Array<{ code: string; severity: "warning" | "critical"; message: string }>;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await apiClient.get("/admin/stats")).data.data as Stats,
    enabled: isAdmin,
  });

  const metricsQuery = useQuery({
    queryKey: ["moderation-metrics", 7],
    queryFn: async () => (await apiClient.get("/moderation/metrics/overview", { params: { days: 7 } })).data.data as Metrics,
  });

  const statsCards = [
    { name: "Usuarios", value: statsQuery.data?.users, icon: Users, tone: "bg-[var(--primary-soft)] text-[var(--primary-dark)]" },
    { name: "Barrios", value: statsQuery.data?.barrios, icon: Map, tone: "bg-[#F7E0D2] text-[#9A5728]" },
    { name: "Noticias", value: statsQuery.data?.news, icon: Newspaper, tone: "bg-[#E2ECF6] text-[#416F9A]" },
    { name: "Comercios", value: statsQuery.data?.businesses, icon: Store, tone: "bg-[#E8E3F2] text-[#625489]" },
    { name: "Marketplace", value: statsQuery.data?.marketplacePosts, icon: ShoppingBag, tone: "bg-[#F5E8D1] text-[#856520]" },
    { name: "Eventos", value: statsQuery.data?.events, icon: Calendar, tone: "bg-[#E6ECE4] text-[#54734F]" },
  ];

  const metrics = metricsQuery.data;
  const queueCards = metrics ? [
    { name: "Foro pendiente", value: metrics.queues.forum.pendingThreads + metrics.queues.forum.pendingReplies, detail: `${metrics.queues.forum.openReports} reportes abiertos`, icon: MessageSquare },
    { name: "Marketplace pendiente", value: metrics.queues.marketplace.pendingPosts, detail: `${metrics.queues.marketplace.quarantinedAssets} imágenes en cuarentena`, icon: ShoppingBag },
    { name: "Apelaciones", value: metrics.queues.forum.pendingAppeals + metrics.queues.marketplace.pendingAppeals, detail: "Esperando revisión", icon: ShieldCheck },
    { name: "Espera más antigua", value: `${Math.round(metrics.queues.oldestPendingHours)} h`, detail: "Antigüedad de la cola", icon: Clock3 },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Resumen operativo</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Actividad general y estado de las colas de moderación.</p>
        </div>
        {metrics && <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-faint)]">Últimos {metrics.window.days} días · {metrics.scope === "GLOBAL" ? "Vista global" : "Mi barrio"}</span>}
      </div>

      {(statsQuery.error || metricsQuery.error) && (
        <div className="rounded-xl border border-[var(--error)]/30 bg-[var(--error-bg)] p-4 text-sm text-[var(--error)]">
          {getApiErrorMessage(statsQuery.error || metricsQuery.error, "No se pudieron cargar todas las métricas.")}
        </div>
      )}

      {metrics?.alerts && metrics.alerts.length > 0 && (
        <section className="space-y-2">
          {metrics.alerts.map((alert) => (
            <div key={alert.code} className="flex items-start gap-3 rounded-xl border border-[#E4C56A] bg-[#FFF7DA] p-4 text-sm text-[#735B18]">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <div><strong className="block">{alert.severity === "critical" ? "Alerta crítica" : "Atención"}</strong>{alert.message}</div>
            </div>
          ))}
        </section>
      )}

      {isAdmin && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Plataforma</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {statsCards.map((stat) => (
              <div key={stat.name} className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm">
                <div className={`mb-4 inline-flex rounded-lg p-2.5 ${stat.tone}`}><stat.icon size={20} /></div>
                <p className="text-2xl font-bold text-[var(--text)]">{statsQuery.isLoading ? "..." : stat.value?.toLocaleString() ?? "-"}</p>
                <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">{stat.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Moderación</h2>
          {metrics && <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary-dark)]">{metrics.queues.totalPending} pendientes</span>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricsQuery.isLoading ? [...Array(4)].map((_, index) => <div key={index} className="h-32 animate-pulse rounded-xl border border-[var(--divider)] bg-[var(--surface)]" />) : queueCards.map((card) => (
            <div key={card.name} className="flex items-start gap-4 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="rounded-lg bg-[var(--surface-flat)] p-3 text-[var(--primary-dark)]"><card.icon size={22} /></div>
              <div><p className="text-2xl font-bold text-[var(--text)]">{card.value}</p><p className="text-sm font-medium text-[var(--text-body)]">{card.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{card.detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      {metrics && (
        <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5">
          <div className="flex items-center gap-3"><div className="rounded-lg bg-[#E8E3F2] p-3 text-[#625489]"><Bot size={22} /></div><div><h2 className="font-semibold text-[var(--text)]">Asistencia con IA</h2><p className="text-sm text-[var(--text-muted)]">Uso durante la ventana seleccionada</p></div></div>
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-[var(--divider)] pt-5 text-center"><div><p className="text-xl font-bold">{metrics.ai.generations}</p><p className="text-xs text-[var(--text-muted)]">Generaciones</p></div><div><p className="text-xl font-bold">{Math.round(metrics.ai.cacheHitRate * 100)}%</p><p className="text-xs text-[var(--text-muted)]">Aciertos de caché</p></div><div><p className="text-xl font-bold">US$ {metrics.ai.estimatedCostUsd.toFixed(2)}</p><p className="text-xs text-[var(--text-muted)]">Costo estimado</p></div></div>
        </section>
      )}
    </div>
  );
}
