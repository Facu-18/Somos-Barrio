"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Edit, Eye, Filter, Loader2, Search, Trash2, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";

type NewsStatus = "PENDING_REVIEW" | "PUBLISHED" | "DRAFT" | "ARCHIVED";
type NewsCategory = "SEGURIDAD" | "OBRAS" | "EVENTOS" | "MUNICIPIO" | "COMUNIDAD";

type NewsItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: NewsCategory;
  status: NewsStatus;
  editorObservation?: string | null;
  aiSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  author: { name: string | null; email: string };
  barrio: { id: string; name: string; slug: string };
};

type Barrio = { id: string; name: string; slug: string };
type NewsResponse = { items: NewsItem[]; total: number; page: number; limit: number };
type EditValues = Pick<NewsItem, "title" | "excerpt" | "content" | "category">;

const CATEGORIES: NewsCategory[] = ["SEGURIDAD", "OBRAS", "EVENTOS", "MUNICIPIO", "COMUNIDAD"];

export default function NewsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<NewsStatus>("PENDING_REVIEW");
  const [barrioSlug, setBarrioSlug] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<NewsItem | null>(null);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [moderating, setModerating] = useState<NewsItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const barriosQuery = useQuery({ queryKey: ["barrios-list"], queryFn: async () => (await apiClient.get("/barrios")).data.data as Barrio[] });
  const newsQuery = useQuery({
    queryKey: ["admin-news", status, barrioSlug, page],
    queryFn: async () => (await apiClient.get("/admin/news", { params: { status, barrioSlug: barrioSlug || undefined, limit: 20, page } })).data.data as NewsResponse,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-news"] });
  const approveMutation = useMutation({
    mutationFn: async (news: NewsItem) => apiClient.post(`/barrios/${news.barrio.slug}/news/${news.slug}/approve`),
    onSuccess: () => { refresh(); setModerating(null); setViewing(null); },
  });
  const rejectMutation = useMutation({
    mutationFn: async (news: NewsItem) => apiClient.post(`/barrios/${news.barrio.slug}/news/${news.slug}/reject`, { observation: rejectReason }),
    onSuccess: () => { refresh(); setModerating(null); setRejectReason(""); },
  });
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editing || !editValues) return;
      await apiClient.patch(`/barrios/${editing.barrio.slug}/news/${editing.slug}`, { ...editValues, excerpt: editValues.excerpt || undefined });
    },
    onSuccess: () => { refresh(); setEditing(null); setEditValues(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (news: NewsItem) => apiClient.delete(`/barrios/${news.barrio.slug}/news/${news.slug}`),
    onSuccess: () => { refresh(); setViewing(null); },
  });

  const openEdit = (news: NewsItem) => {
    setEditing(news);
    setEditValues({ title: news.title, excerpt: news.excerpt, content: news.content, category: news.category });
  };
  const remove = (news: NewsItem) => {
    if (window.confirm(`¿Eliminar definitivamente “${news.title}”?`)) deleteMutation.mutate(news);
  };
  const changeFilter = (callback: () => void) => { callback(); setPage(1); };
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const items = newsQuery.data?.items.filter((news) => !normalizedSearch || `${news.title} ${news.author?.name || ""} ${news.barrio?.name || ""}`.toLocaleLowerCase("es").includes(normalizedSearch)) || [];
  const error = newsQuery.error || approveMutation.error || rejectMutation.error || editMutation.error || deleteMutation.error;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[var(--text)]">Gestión de Noticias</h1><p className="text-sm text-[var(--text-muted)]">Revisá, leé, corregí y eliminá contenido editorial.</p></div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 lg:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en esta página..." className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--primary)]" /></label>
        <div className="relative"><select value={status} onChange={(event) => changeFilter(() => setStatus(event.target.value as NewsStatus))} className="w-full appearance-none rounded-lg border border-[var(--divider)] bg-[var(--surface)] py-2 pl-3 pr-9 text-sm outline-none focus:border-[var(--primary)]"><option value="PENDING_REVIEW">Pendientes</option><option value="PUBLISHED">Publicadas</option><option value="DRAFT">Borradores</option><option value="ARCHIVED">Archivadas</option></select><Filter className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} /></div>
        <select value={barrioSlug} onChange={(event) => changeFilter(() => setBarrioSlug(event.target.value))} className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"><option value="">Todos los barrios</option>{barriosQuery.data?.map((barrio) => <option key={barrio.id} value={barrio.slug}>{barrio.name}</option>)}</select>
      </div>

      {error && <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">{getApiErrorMessage(error, "No se pudo completar la operación.")}</div>}

      <div className="overflow-hidden rounded-xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-[var(--divider)]"><thead className="bg-[var(--surface-flat)]"><tr><th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Título</th><th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Autor / Barrio</th><th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Categoría</th><th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Estado</th><th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Acciones</th></tr></thead>
          <tbody className="divide-y divide-[var(--divider)]">{newsQuery.isLoading ? <tr><td colSpan={5} className="p-12"><Loader2 className="mx-auto animate-spin text-[var(--primary)]" /></td></tr> : !items.length ? <tr><td colSpan={5} className="p-12 text-center text-sm text-[var(--text-muted)]">No hay noticias para mostrar.</td></tr> : items.map((news) => <tr key={news.id} className="transition-colors hover:bg-[var(--surface-flat)]"><td className="max-w-sm px-6 py-4"><p className="font-medium text-[var(--text)]">{news.title}</p><p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">{news.excerpt || news.slug}</p></td><td className="px-6 py-4"><p className="text-sm">{news.author?.name || "Desconocido"}</p><p className="text-xs text-[var(--text-muted)]">{news.barrio?.name || "Sin barrio"}</p></td><td className="px-6 py-4"><Badge variant="primary">{news.category}</Badge></td><td className="px-6 py-4"><StatusBadge status={news.status} /></td><td className="px-6 py-4"><div className="flex justify-end gap-2"><IconButton label="Ver noticia" onClick={() => setViewing(news)} icon={Eye} /><IconButton label="Editar noticia" onClick={() => openEdit(news)} icon={Edit} />{news.status === "PENDING_REVIEW" && <IconButton label="Moderar noticia" onClick={() => setModerating(news)} icon={CheckCircle} primary />}<IconButton label="Eliminar noticia" onClick={() => remove(news)} icon={Trash2} danger /></div></td></tr>)}</tbody>
        </table></div>
        {newsQuery.data && <Pagination page={page} total={newsQuery.data.total} limit={newsQuery.data.limit} onPageChange={setPage} />}
      </div>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Vista completa" className="max-w-4xl">{viewing && <article className="max-h-[78vh] overflow-y-auto pr-2"><div className="mb-4 flex flex-wrap gap-2"><StatusBadge status={viewing.status} /><Badge variant="primary">{viewing.category}</Badge><Badge>{viewing.barrio.name}</Badge></div><h2 className="text-2xl font-bold leading-tight text-[var(--text)]">{viewing.title}</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Por {viewing.author?.name || "Desconocido"} · {new Date(viewing.createdAt).toLocaleDateString("es-AR")}</p>{viewing.excerpt && <p className="my-5 border-l-4 border-[var(--primary)] pl-4 text-lg text-[var(--text-body)]">{viewing.excerpt}</p>}<div className="mt-5 whitespace-pre-wrap border-t border-[var(--divider)] pt-5 leading-7 text-[var(--text-body)]">{viewing.content}</div>{viewing.aiSummary && <div className="mt-6 rounded-lg bg-[var(--primary-soft)] p-4 text-sm"><strong>Resumen:</strong> {viewing.aiSummary}</div>}<div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--divider)] pt-4"><button onClick={() => { setViewing(null); openEdit(viewing); }} className="inline-flex items-center gap-2 rounded-lg border border-[var(--divider)] px-4 py-2 text-sm font-medium"><Edit size={16} /> Editar</button>{viewing.status === "PENDING_REVIEW" && <button onClick={() => { setViewing(null); setModerating(viewing); }} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-text)]"><CheckCircle size={16} /> Moderar</button>}<button onClick={() => remove(viewing)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--error-bg)] px-4 py-2 text-sm font-medium text-[var(--error)]"><Trash2 size={16} /> Eliminar</button></div></article>}</Modal>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Editar noticia" className="max-w-3xl">{editing && editValues && <form onSubmit={(event) => { event.preventDefault(); editMutation.mutate(); }} className="max-h-[76vh] space-y-4 overflow-y-auto pr-2"><div><label className="mb-1 block text-sm font-medium">Título</label><input required minLength={3} maxLength={255} value={editValues.title} onChange={(event) => setEditValues({ ...editValues, title: event.target.value })} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" /></div><div><label className="mb-1 block text-sm font-medium">Bajada</label><textarea maxLength={500} rows={2} value={editValues.excerpt || ""} onChange={(event) => setEditValues({ ...editValues, excerpt: event.target.value })} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]" /></div><div><label className="mb-1 block text-sm font-medium">Categoría</label><select value={editValues.category} onChange={(event) => setEditValues({ ...editValues, category: event.target.value as NewsCategory })} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm">{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div><div><label className="mb-1 block text-sm font-medium">Contenido</label><textarea required minLength={10} rows={14} value={editValues.content} onChange={(event) => setEditValues({ ...editValues, content: event.target.value })} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)]" /></div><div className="flex justify-end gap-2 border-t border-[var(--divider)] pt-4"><button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-[var(--text-muted)]">Cancelar</button><button disabled={editMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-text)]">{editMutation.isPending && <Loader2 className="animate-spin" size={16} />} Guardar cambios</button></div></form>}</Modal>

      <Modal isOpen={!!moderating} onClose={() => setModerating(null)} title="Moderar noticia">{moderating && <div className="space-y-4"><div className="rounded-lg bg-[var(--input-bg)] p-4"><h3 className="font-semibold">{moderating.title}</h3><p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm text-[var(--text-body)]">{moderating.content}</p></div><div><label className="mb-1 block text-sm font-medium">Motivo del rechazo</label><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} minLength={5} maxLength={1000} rows={3} placeholder="Obligatorio para rechazar..." className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] p-3 text-sm" /></div><div className="flex justify-end gap-2 border-t border-[var(--divider)] pt-4"><button onClick={() => rejectMutation.mutate(moderating)} disabled={rejectReason.trim().length < 5 || rejectMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[var(--error-bg)] px-4 py-2 text-sm font-medium text-[var(--error)] disabled:opacity-40"><XCircle size={16} /> Rechazar</button><button onClick={() => approveMutation.mutate(moderating)} disabled={approveMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-text)]"><CheckCircle size={16} /> Aprobar y publicar</button></div></div>}</Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: NewsStatus }) {
  const variants = { PENDING_REVIEW: "warning", PUBLISHED: "success", DRAFT: "neutral", ARCHIVED: "neutral" } as const;
  const labels = { PENDING_REVIEW: "Pendiente", PUBLISHED: "Publicada", DRAFT: "Borrador", ARCHIVED: "Archivada" };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function IconButton({ label, onClick, icon: Icon, primary = false, danger = false }: { label: string; onClick: () => void; icon: typeof Eye; primary?: boolean; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className={`rounded-lg p-2 transition-colors ${danger ? "text-[var(--error)] hover:bg-[var(--error-bg)]" : primary ? "bg-[var(--primary-soft)] text-[var(--primary-dark)] hover:bg-[var(--primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-flat)] hover:text-[var(--text)]"}`}><Icon size={17} /></button>;
}
