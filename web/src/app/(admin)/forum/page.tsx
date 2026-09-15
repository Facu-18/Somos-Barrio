"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Filter, Loader2, MessageCircle, RotateCcw, Send, ShieldX, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/context/auth-context";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";

type ForumTarget = "THREAD" | "REPLY";
type ForumQueue = "PENDING_REVIEW" | "REPORTED" | "APPEALED" | "BLOCKED" | "REMOVED";
type ForumDecision = "APPROVE" | "BLOCK" | "REMOVE" | "RESTORE";

type ForumItem = {
  id: string;
  title?: string;
  content: string;
  status: string;
  moderationVersion: number;
  createdAt: string;
  user: { name: string | null; email: string; nickname: string | null };
  barrio?: { name: string; slug: string };
  subforum?: { name: string };
  thread?: { title: string; barrio: { name: string; slug: string }; subforum: { name: string } };
  reports: Array<{ id: string; category: string; comment: string | null; reporter: { nickname: string | null } }>;
  appeals: Array<{ id: string; statement: string }>;
};

type Barrio = { id: string; name: string; slug: string };
type QueueResponse = { items: ForumItem[]; total: number; page: number; limit: number };

const QUEUES: Array<{ value: ForumQueue; label: string }> = [
  { value: "PENDING_REVIEW", label: "Pendientes" },
  { value: "REPORTED", label: "Reportados" },
  { value: "APPEALED", label: "Apelaciones" },
  { value: "BLOCKED", label: "Bloqueados" },
  { value: "REMOVED", label: "Removidos" },
];

const REASONS = [
  ["POLICY_COMPLIANT", "Cumple con las políticas"],
  ["THREAT", "Amenazas"],
  ["HARASSMENT", "Acoso"],
  ["DISCRIMINATION", "Discriminación"],
  ["INAPPROPRIATE_CONTENT", "Contenido inapropiado"],
  ["SPAM", "Spam"],
  ["REPORT_REVIEW", "Revisión de reporte"],
  ["OTHER_POLICY", "Otra política"],
] as const;

export default function ForumPage() {
  const [section, setSection] = useState<"active" | "moderation">("active");

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[var(--text)]">Foro</h1><p className="text-sm text-[var(--text-muted)]">Participá en conversaciones abiertas y gestioná contenido reportado.</p></div>
      <div className="border-b border-[var(--divider)]"><nav className="-mb-px flex gap-7"><button onClick={() => setSection("active")} className={`border-b-2 px-1 py-3 text-sm font-medium ${section === "active" ? "border-[var(--primary)] text-[var(--primary-dark)]" : "border-transparent text-[var(--text-muted)]"}`}>Hilos abiertos</button><button onClick={() => setSection("moderation")} className={`border-b-2 px-1 py-3 text-sm font-medium ${section === "moderation" ? "border-[var(--primary)] text-[var(--primary-dark)]" : "border-transparent text-[var(--text-muted)]"}`}>Moderación</button></nav></div>
      {section === "active" ? <ActiveThreads /> : <ModerationQueue />}
    </div>
  );
}

function ModerationQueue() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<ForumTarget>("THREAD");
  const [queue, setQueue] = useState<ForumQueue>("PENDING_REVIEW");
  const [barrioSlug, setBarrioSlug] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ForumItem | null>(null);
  const [reasonCode, setReasonCode] = useState("POLICY_COMPLIANT");
  const [privateNote, setPrivateNote] = useState("");

  const barriosQuery = useQuery({
    queryKey: ["barrios-list"],
    queryFn: async () => (await apiClient.get("/barrios")).data.data as Barrio[],
  });

  const queueQuery = useQuery({
    queryKey: ["forum-queue", target, queue, barrioSlug, page],
    queryFn: async () => (await apiClient.get("/moderation/forum", {
      params: { target, queue, barrioSlug: barrioSlug || undefined, page, limit: 20 },
    })).data.data as QueueResponse,
  });

  const decisionMutation = useMutation({
    mutationFn: async (decision: ForumDecision) => {
      if (!selected) return;
      const resource = target === "THREAD" ? "threads" : "replies";
      await apiClient.post(`/moderation/forum/${resource}/${selected.id}/decision`, {
        decision,
        reasonCode,
        privateNote: privateNote || undefined,
        expectedVersion: selected.moderationVersion,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forum-queue"] });
      queryClient.invalidateQueries({ queryKey: ["moderation-metrics"] });
      setSelected(null);
      setPrivateNote("");
      setReasonCode("POLICY_COMPLIANT");
    },
  });

  const changeFilter = (update: () => void) => {
    update();
    setPage(1);
  };

  const context = selected ? (selected.thread || selected) : null;
  const error = queueQuery.error || decisionMutation.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex rounded-lg bg-[var(--surface-flat)] p-1">
          {(["THREAD", "REPLY"] as ForumTarget[]).map((value) => (
            <button key={value} onClick={() => changeFilter(() => setTarget(value))} className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${target === value ? "bg-[var(--surface)] text-[var(--primary-dark)] shadow-sm" : "text-[var(--text-muted)]"}`}>
              {value === "THREAD" ? "Hilos" : "Respuestas"}
            </button>
          ))}
        </div>
        <div className="relative min-w-44 flex-1 sm:max-w-56">
          <select value={queue} onChange={(event) => changeFilter(() => setQueue(event.target.value as ForumQueue))} className="w-full appearance-none rounded-lg border border-[var(--divider)] bg-[var(--surface)] py-2 pl-3 pr-9 text-sm outline-none focus:border-[var(--primary)]">
            {QUEUES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Filter className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
        </div>
        <select value={barrioSlug} onChange={(event) => changeFilter(() => setBarrioSlug(event.target.value))} className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]">
          <option value="">Todos los barrios</option>
          {barriosQuery.data?.map((barrio) => <option key={barrio.id} value={barrio.slug}>{barrio.name}</option>)}
        </select>
      </div>

      {error && <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">{getApiErrorMessage(error, "No se pudo completar la operación.")}</div>}

      <div className="overflow-hidden rounded-xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--divider)]">
            <thead className="bg-[var(--surface-flat)]"><tr><th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Contenido</th><th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Autor / Barrio</th><th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Estado</th><th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Acciones</th></tr></thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {queueQuery.isLoading ? <tr><td colSpan={4} className="p-12"><Loader2 className="mx-auto animate-spin text-[var(--primary)]" /></td></tr> : !queueQuery.data?.items.length ? <tr><td colSpan={4} className="p-12 text-center text-sm text-[var(--text-muted)]">No hay contenido en esta cola.</td></tr> : queueQuery.data.items.map((item) => {
                const itemContext = item.thread || item;
                return <tr key={item.id} className="transition-colors hover:bg-[var(--surface-flat)]"><td className="max-w-md px-6 py-4"><p className="text-sm font-medium text-[var(--text)]">{item.title || item.thread?.title || "Respuesta"}</p><p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{item.content}</p>{(item.reports.length > 0 || item.appeals.length > 0) && <div className="mt-2 flex gap-2">{item.reports.length > 0 && <Badge variant="danger">{item.reports.length} reporte(s)</Badge>}{item.appeals.length > 0 && <Badge variant="warning">Apelación</Badge>}</div>}</td><td className="px-6 py-4 text-sm"><p>{item.user.name || item.user.nickname || "Sin nombre"}</p><p className="text-xs text-[var(--text-muted)]">{itemContext.barrio?.name} · {itemContext.subforum?.name}</p></td><td className="px-6 py-4"><Badge variant={item.status === "PUBLISHED" ? "success" : item.status === "PENDING_REVIEW" ? "warning" : "danger"}>{item.status}</Badge></td><td className="px-6 py-4 text-right"><button onClick={() => setSelected(item)} className="text-sm font-medium text-[var(--primary-dark)] hover:underline">Revisar</button></td></tr>;
              })}
            </tbody>
          </table>
        </div>
        {queueQuery.data && <Pagination page={page} total={queueQuery.data.total} limit={queueQuery.data.limit} onPageChange={setPage} />}
      </div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Decisión de moderación" className="max-w-2xl">
        {selected && <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
          <div className="rounded-lg bg-[var(--input-bg)] p-4"><div className="mb-2 flex flex-wrap gap-2"><Badge variant="neutral">{target === "THREAD" ? "Hilo" : "Respuesta"}</Badge><Badge variant="neutral">{context?.barrio?.name}</Badge></div>{(selected.title || selected.thread?.title) && <h3 className="mb-2 font-semibold">{selected.title || selected.thread?.title}</h3>}<p className="whitespace-pre-wrap text-sm text-[var(--text-body)]">{selected.content}</p></div>
          {selected.reports.length > 0 && <div><h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} /> Reportes abiertos</h4><div className="space-y-2">{selected.reports.map((report) => <div key={report.id} className="rounded-lg border border-[var(--divider)] p-3 text-sm"><strong>{report.category}</strong><span className="text-[var(--text-muted)]"> · {report.reporter.nickname || "Usuario"}</span>{report.comment && <p className="mt-1 text-[var(--text-body)]">{report.comment}</p>}</div>)}</div></div>}
          {selected.appeals.map((appeal) => <div key={appeal.id} className="rounded-lg border border-[#E4C56A] bg-[#FFF7DA] p-3 text-sm"><strong>Apelación:</strong> {appeal.statement}</div>)}
          <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">Motivo</label><select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] p-2.5 text-sm">{REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label className="mb-1 block text-sm font-medium">Nota interna</label><textarea value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} rows={2} maxLength={2000} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] p-2.5 text-sm" /></div></div>
          {decisionMutation.error && <p className="text-sm text-[var(--error)]">{getApiErrorMessage(decisionMutation.error, "No se pudo guardar la decisión.")}</p>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--divider)] pt-4">
            {selected.appeals.length > 0 ? <>
              <ActionButton label="Aceptar apelación" icon={CheckCircle} onClick={() => decisionMutation.mutate("APPROVE")} pending={decisionMutation.isPending} />
              <ActionButton label="Rechazar apelación" icon={XCircle} onClick={() => decisionMutation.mutate("BLOCK")} pending={decisionMutation.isPending} danger />
            </> : selected.status === "REMOVED" ? (
              <ActionButton label="Restaurar" icon={RotateCcw} onClick={() => decisionMutation.mutate("RESTORE")} pending={decisionMutation.isPending} />
            ) : <>
              {(selected.status === "PENDING_REVIEW" || selected.status === "BLOCKED" || selected.reports.length > 0) && <ActionButton label={selected.reports.length > 0 ? "Aprobar / desestimar" : "Aprobar"} icon={CheckCircle} onClick={() => decisionMutation.mutate("APPROVE")} pending={decisionMutation.isPending} />}
              {selected.status === "PENDING_REVIEW" && <ActionButton label="Bloquear" icon={ShieldX} onClick={() => decisionMutation.mutate("BLOCK")} pending={decisionMutation.isPending} danger />}
              <ActionButton label="Remover" icon={XCircle} onClick={() => decisionMutation.mutate("REMOVE")} pending={decisionMutation.isPending} danger />
            </>}
          </div>
        </div>}
      </Modal>
    </div>
  );
}

type Subforum = { id: string; name: string; slug: string; _count: { threads: number } };
type PublicThread = {
  id: string;
  title: string;
  content: string;
  status: string;
  isClosed: boolean;
  createdAt: string;
  score: number;
  user: { id: string; name: string | null; nickname: string | null; avatarUrl?: string | null };
  _count: { replies: number };
  barrio: Barrio;
  subforum: Subforum;
};
type ThreadReply = { id: string; content: string; status: string; createdAt: string; user: PublicThread["user"] };
type ThreadDetail = PublicThread & { replies: ThreadReply[] };

function ActiveThreads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [barrioSlug, setBarrioSlug] = useState(user?.role === "EDITOR" ? user.barrio?.slug || "" : "");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PublicThread | null>(null);
  const [reply, setReply] = useState("");

  const barriosQuery = useQuery({
    queryKey: ["barrios-list"],
    queryFn: async () => (await apiClient.get("/barrios")).data.data as Barrio[],
  });
  const availableBarrios = user?.role === "EDITOR" ? barriosQuery.data?.filter((barrio) => barrio.slug === user.barrio?.slug) : barriosQuery.data;

  const threadsQuery = useQuery({
    queryKey: ["active-forum-threads", barrioSlug, availableBarrios?.map((barrio) => barrio.slug).join(",")],
    enabled: !!availableBarrios,
    queryFn: async () => {
      const barrios = barrioSlug ? availableBarrios!.filter((barrio) => barrio.slug === barrioSlug) : availableBarrios!;
      const groups = await Promise.all(barrios.map(async (barrio) => {
        const subforums = (await apiClient.get(`/barrios/${barrio.slug}/forum`)).data.data as Subforum[];
        return Promise.all(subforums.map(async (subforum) => {
          const first = (await apiClient.get(`/barrios/${barrio.slug}/forum/${subforum.slug}/threads`, { params: { page: 1, limit: 50 } })).data.data;
          const pages = Math.ceil(first.total / first.limit);
          const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => apiClient.get(`/barrios/${barrio.slug}/forum/${subforum.slug}/threads`, { params: { page: index + 2, limit: 50 } })));
          return [first, ...rest.map((response) => response.data.data)].flatMap((result) => result.items).map((thread: Omit<PublicThread, "barrio" | "subforum">) => ({ ...thread, barrio, subforum }));
        }));
      }));
      return groups.flat(2).filter((thread) => thread.status === "PUBLISHED" && !thread.isClosed).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
  });

  const detailQuery = useQuery({
    queryKey: ["forum-thread", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const detail = (await apiClient.get(`/barrios/${selected!.barrio.slug}/forum/${selected!.subforum.slug}/threads/${selected!.id}`)).data.data;
      return { ...detail, barrio: selected!.barrio, subforum: selected!.subforum } as ThreadDetail;
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await apiClient.post(`/barrios/${selected.barrio.slug}/forum/${selected.subforum.slug}/threads/${selected.id}/replies`, { content: reply.trim() });
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["forum-thread", selected?.id] });
      queryClient.invalidateQueries({ queryKey: ["active-forum-threads"] });
    },
  });

  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const threads = threadsQuery.data?.filter((thread) => !normalizedSearch || `${thread.title} ${thread.content} ${thread.user.name || thread.user.nickname || ""}`.toLocaleLowerCase("es").includes(normalizedSearch)) || [];
  const detail = detailQuery.data;
  const error = threadsQuery.error || detailQuery.error || replyMutation.error;

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 sm:flex-row"><label className="relative flex-1"><MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar hilos abiertos..." className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--primary)]" /></label><select value={barrioSlug} onChange={(event) => setBarrioSlug(event.target.value)} disabled={user?.role === "EDITOR"} className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-sm disabled:opacity-60"><option value="">Todos los barrios</option>{availableBarrios?.map((barrio) => <option key={barrio.id} value={barrio.slug}>{barrio.name}</option>)}</select></div>
    {error && <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">{getApiErrorMessage(error, "No se pudo cargar el foro.")}</div>}
    {threadsQuery.isLoading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--primary)]" /></div> : !threads.length ? <div className="rounded-xl border border-dashed border-[var(--divider)] p-12 text-center text-sm text-[var(--text-muted)]">No hay hilos abiertos.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{threads.map((thread) => <button key={thread.id} onClick={() => setSelected(thread)} className="group rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-md"><div className="mb-3 flex items-center justify-between gap-3"><Badge variant="primary">{thread.subforum.name}</Badge><span className="text-xs text-[var(--text-muted)]">{thread.barrio.name}</span></div><h3 className="line-clamp-2 font-semibold text-[var(--text)] group-hover:text-[var(--primary-dark)]">{thread.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">{thread.content}</p><div className="mt-4 flex items-center justify-between border-t border-[var(--divider)] pt-3 text-xs text-[var(--text-muted)]"><span>{thread.user.name || thread.user.nickname || "Usuario"}</span><span className="flex items-center gap-1"><MessageCircle size={14} /> {thread._count.replies}</span></div></button>)}</div>}

    <Modal isOpen={!!selected} onClose={() => { setSelected(null); setReply(""); }} title="Hilo abierto" className="max-w-4xl">{selected && <div className="max-h-[80vh] overflow-y-auto pr-2">
      {detailQuery.isLoading || !detail ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[var(--primary)]" /></div> : <><article><div className="mb-3 flex flex-wrap gap-2"><Badge variant="primary">{detail.subforum.name}</Badge><Badge>{detail.barrio.name}</Badge></div><h2 className="text-2xl font-bold leading-tight">{detail.title}</h2><p className="mt-2 text-xs text-[var(--text-muted)]">{detail.user.name || detail.user.nickname || "Usuario"} · {new Date(detail.createdAt).toLocaleString("es-AR")}</p><div className="mt-5 whitespace-pre-wrap rounded-xl bg-[var(--input-bg)] p-5 leading-7 text-[var(--text-body)]">{detail.content}</div></article>
      <section className="mt-6"><h3 className="mb-3 font-semibold">Respuestas ({detail.replies.filter((item) => item.status === "PUBLISHED").length})</h3><div className="space-y-3">{detail.replies.filter((item) => item.status === "PUBLISHED").map((item) => <div key={item.id} className="rounded-xl border border-[var(--divider)] p-4"><div className="mb-2 flex justify-between gap-3 text-xs text-[var(--text-muted)]"><strong className="text-[var(--text-body)]">{item.user.name || item.user.nickname || "Usuario"}</strong><span>{new Date(item.createdAt).toLocaleString("es-AR")}</span></div><p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-body)]">{item.content}</p></div>)}{!detail.replies.some((item) => item.status === "PUBLISHED") && <p className="rounded-lg border border-dashed border-[var(--divider)] p-6 text-center text-sm text-[var(--text-muted)]">Todavía no hay respuestas.</p>}</div></section>
      <form onSubmit={(event) => { event.preventDefault(); replyMutation.mutate(); }} className="sticky bottom-0 mt-6 border-t border-[var(--divider)] bg-[var(--surface)] pt-4"><label className="mb-2 block text-sm font-semibold">Responder como administrador</label><div className="flex items-end gap-2"><textarea required maxLength={5000} rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Escribí una respuesta..." className="min-w-0 flex-1 resize-none rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] p-3 text-sm outline-none focus:border-[var(--primary)]" /><button disabled={!reply.trim() || replyMutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-text)] disabled:opacity-40">{replyMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Enviar</button></div>{replyMutation.error && <p className="mt-2 text-sm text-[var(--error)]">{getApiErrorMessage(replyMutation.error, "No se pudo publicar la respuesta.")}</p>}</form></>}
    </div>}</Modal>
  </div>;
}

function ActionButton({ label, icon: Icon, onClick, pending, danger = false }: { label: string; icon: typeof CheckCircle; onClick: () => void; pending: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={pending} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${danger ? "bg-[var(--error-bg)] text-[var(--error)] hover:bg-[var(--error)] hover:text-white" : "bg-[var(--primary)] text-[var(--primary-text)] hover:bg-[var(--primary-dark)] hover:text-white"}`}>{pending ? <Loader2 className="animate-spin" size={16} /> : <Icon size={16} />}{label}</button>;
}
