"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Loader2, Filter, CheckCircle, XCircle, ImageIcon, AlertTriangle } from "lucide-react";
import clsx from "clsx";

// Types
type MarketplacePost = {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  status: string;
  moderationStatus: string;
  moderationVersion: number;
  createdAt: string;
  author: { id: string; name: string; email: string };
  barrio: { id: string; name: string; slug: string };
};

type MarketplaceAsset = {
  id: string;
  url: string;
  status: string;
  moderationVersion: number;
  post: { id: string; title: string };
};

const REASON_CODES = [
  { value: "POLICY_COMPLIANT", label: "Cumple con las políticas" },
  { value: "PROHIBITED_ITEM", label: "Artículo prohibido" },
  { value: "REGULATED_ITEM", label: "Artículo regulado" },
  { value: "FRAUD_OR_MISLEADING", label: "Fraude o Engañoso" },
  { value: "SPAM_OR_DUPLICATE", label: "Spam o Duplicado" },
  { value: "INAPPROPRIATE_CONTENT", label: "Contenido Inapropiado" },
  { value: "IMAGE_POLICY", label: "Infracción de Imágenes" },
  { value: "OTHER_POLICY", label: "Otra Política" }
];

export default function MarketplaceModerationPage() {
  const [activeTab, setActiveTab] = useState<"posts" | "assets">("posts");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Moderación de Marketplace</h1>
          <p className="text-sm text-[var(--text-muted)]">Revisá publicaciones y sus imágenes.</p>
        </div>
      </div>

      <div className="border-b border-[var(--divider)]">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("posts")}
            className={clsx(
              activeTab === "posts"
                ? "border-[var(--primary)] text-[var(--primary-dark)]"
                : "border-transparent text-[var(--text-muted)] hover:border-[var(--divider)] hover:text-[var(--text)]",
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors"
            )}
          >
            Publicaciones
          </button>
          <button
            onClick={() => setActiveTab("assets")}
            className={clsx(
              activeTab === "assets"
                ? "border-[var(--primary)] text-[var(--primary-dark)]"
                : "border-transparent text-[var(--text-muted)] hover:border-[var(--divider)] hover:text-[var(--text)]",
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors"
            )}
          >
            Imágenes (Assets)
          </button>
        </nav>
      </div>

      {activeTab === "posts" ? <PostsQueue /> : <AssetsQueue />}
    </div>
  );
}

// ----------------------------------------------------------------------
// POSTS QUEUE
// ----------------------------------------------------------------------
function PostsQueue() {
  const queryClient = useQueryClient();
  const [queueFilter, setQueueFilter] = useState("PENDING_REVIEW");
  const [selectedPost, setSelectedPost] = useState<MarketplacePost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [reasonCode, setReasonCode] = useState("POLICY_COMPLIANT");
  const [privateNote, setPrivateNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace-queue", queueFilter],
    queryFn: async () => {
      const res = await apiClient.get("/moderation/marketplace", {
        params: { queue: queueFilter, limit: 50 }
      });
      return res.data.data;
    }
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ postId, decision, version }: { postId: string, decision: string, version: number }) => {
      const res = await apiClient.post(`/moderation/marketplace/${postId}/decision`, {
        decision,
        reasonCode,
        privateNote,
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID()
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-queue"] });
      setIsModalOpen(false);
      setSelectedPost(null);
      setPrivateNote("");
      setReasonCode("POLICY_COMPLIANT");
    }
  });

  const handleDecision = (post: MarketplacePost) => {
    setSelectedPost(post);
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_REVIEW": return <Badge variant="warning">Pendiente</Badge>;
      case "REPORTED": return <Badge variant="danger">Reportado</Badge>;
      case "APPROVED": return <Badge variant="success">Aprobado</Badge>;
      case "REJECTED": return <Badge variant="danger">Rechazado</Badge>;
      case "REMOVED": return <Badge variant="danger">Removido</Badge>;
      default: return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="relative">
          <select
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            className="appearance-none rounded-lg border border-[var(--divider)] bg-[var(--surface)] pl-4 pr-10 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="PENDING_REVIEW">Pendientes de Revisión</option>
            <option value="APPROVED">Aprobados / Publicados</option>
            <option value="REPORTED">Reportados</option>
            <option value="REJECTED">Rechazados</option>
            <option value="REMOVED">Removidos</option>
          </select>
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] overflow-hidden">
        <table className="min-w-full divide-y divide-[var(--divider)]">
          <thead className="bg-[var(--surface-flat)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Publicación</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Autor / Barrio</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Precio</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--divider)] bg-[var(--surface)]">
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="mx-auto animate-spin" /></td></tr>
            ) : !data?.items || data.items.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No hay posts.</td></tr>
            ) : (
              data.items.map((post: MarketplacePost) => (
                <tr key={post.id} className="hover:bg-[var(--surface-flat)]">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium">{post.title}</div>
                    <div className="text-xs text-[var(--text-muted)]">{post.category}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div>{post.author?.name || "Desconocido"}</div>
                    <div className="text-xs text-[var(--text-muted)]">{post.barrio?.name || "Sin barrio"}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{post.currency} {post.price}</td>
                  <td className="px-6 py-4">{getStatusBadge(post.moderationStatus)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDecision(post)} className="text-[var(--primary)] hover:underline text-sm font-medium">
                      Moderar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Moderar Publicación">
        {selectedPost && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[var(--input-bg)] p-4 max-h-48 overflow-y-auto">
              <h4 className="font-medium text-lg mb-2">{selectedPost.title}</h4>
              <p className="text-sm whitespace-pre-wrap">{selectedPost.description}</p>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Motivo / Código</label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] p-2 text-sm"
                >
                  {REASON_CODES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nota Interna (opcional)</label>
                <textarea
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] p-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--divider)]">
              <button
                onClick={() => decisionMutation.mutate({ postId: selectedPost.id, decision: "REMOVE", version: selectedPost.moderationVersion ?? 0 })}
                disabled={decisionMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--error-bg)] px-4 py-2 text-sm font-medium text-[var(--error)] hover:bg-[var(--error)] hover:text-white transition-colors mr-auto"
              >
                <XCircle size={16} /> Eliminar
              </button>
              <button
                onClick={() => decisionMutation.mutate({ postId: selectedPost.id, decision: "REJECT", version: selectedPost.moderationVersion ?? 0 })}
                disabled={decisionMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-200 transition-colors"
              >
                <AlertTriangle size={16} /> Rechazar
              </button>
              <button
                onClick={() => decisionMutation.mutate({ postId: selectedPost.id, decision: "APPROVE", version: selectedPost.moderationVersion ?? 0 })}
                disabled={decisionMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-text)] hover:bg-[var(--primary-dark)] hover:text-white transition-colors"
              >
                <CheckCircle size={16} /> Aprobar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------
// ASSETS QUEUE
// ----------------------------------------------------------------------
function AssetsQueue() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("QUARANTINED");
  const [selectedAsset, setSelectedAsset] = useState<MarketplaceAsset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [reasonCode, setReasonCode] = useState("IMAGE_POLICY");
  const [privateNote, setPrivateNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace-assets", statusFilter],
    queryFn: async () => {
      const res = await apiClient.get("/moderation/marketplace/assets", {
        params: { status: statusFilter, limit: 50 }
      });
      return res.data.data;
    }
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ assetId, decision, version }: { assetId: string, decision: string, version: number }) => {
      const res = await apiClient.post(`/moderation/marketplace/assets/${assetId}/decision`, {
        decision,
        reasonCode,
        privateNote,
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID()
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-assets"] });
      setIsModalOpen(false);
      setSelectedAsset(null);
      setPrivateNote("");
    }
  });

  const handleDecision = (asset: MarketplaceAsset) => {
    setSelectedAsset(asset);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none rounded-lg border border-[var(--divider)] bg-[var(--surface)] pl-4 pr-10 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="QUARANTINED">En Cuarentena</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="REJECTED">Rechazadas</option>
          </select>
          <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center"><Loader2 className="animate-spin text-[var(--primary)]" /></div>
        ) : !data?.items || data.items.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[var(--text-muted)]">No hay imágenes en este estado.</div>
        ) : (
          data.items.map((asset: MarketplaceAsset) => (
            <div key={asset.id} className="rounded-xl overflow-hidden border border-[var(--divider)] bg-[var(--surface)]">
              <div className="aspect-square bg-[var(--surface-flat)] relative flex items-center justify-center overflow-hidden">
                {asset.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.url} alt="Marketplace Asset" className="object-cover w-full h-full" />
                ) : (
                  <ImageIcon className="text-[var(--text-muted)]" size={32} />
                )}
              </div>
              <div className="p-3">
                <p className="text-xs text-[var(--text-muted)] truncate mb-2">Publicación: {asset.post?.title}</p>
                <button
                  onClick={() => handleDecision(asset)}
                  className="w-full rounded-md bg-[var(--primary-soft)] text-[var(--primary-dark)] py-1.5 text-xs font-medium hover:bg-[var(--primary)] hover:text-[var(--primary-text)] transition-colors"
                >
                  Moderar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Moderar Imagen">
        {selectedAsset && (
          <div className="space-y-4">
            <div className="flex justify-center bg-[var(--surface-flat)] rounded-lg overflow-hidden border border-[var(--divider)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedAsset.url} alt="Review Asset" className="max-h-64 object-contain" />
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Motivo / Código</label>
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] p-2 text-sm"
                >
                  {REASON_CODES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nota Interna (opcional)</label>
                <textarea
                  value={privateNote}
                  onChange={(e) => setPrivateNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] p-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--divider)]">
              <button
                onClick={() => decisionMutation.mutate({ assetId: selectedAsset.id, decision: "REJECT", version: selectedAsset.moderationVersion ?? 0 })}
                disabled={decisionMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--error-bg)] px-4 py-2 text-sm font-medium text-[var(--error)]"
              >
                <XCircle size={16} /> Rechazar
              </button>
              <button
                onClick={() => decisionMutation.mutate({ assetId: selectedAsset.id, decision: "APPROVE", version: selectedAsset.moderationVersion ?? 0 })}
                disabled={decisionMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-text)]"
              >
                <CheckCircle size={16} /> Aprobar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
