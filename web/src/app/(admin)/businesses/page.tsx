"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Loader2, Store, ShieldCheck, Plus, Edit, Trash2, Search } from "lucide-react";

// Types
type Business = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  address: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  coverImage?: string;
  verified: boolean;
  barrio: { id: string; name: string; slug: string };
  owner: { id: string; name?: string | null; email?: string; nickname?: string | null };
};

type Barrio = {
  id: string;
  name: string;
  slug: string;
};

const CATEGORIES = [
  "GASTRONOMIA", "SALUD", "EDUCACION", "SERVICIOS", "HOGAR", "DEPORTES", "OTROS"
] as const;

const businessSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(255),
  slug: z.string().min(2, "Mínimo 2 caracteres").max(255).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  category: z.enum(CATEGORIES),
  address: z.string().min(2, "Requerida").max(255),
  description: z.string().max(1000).optional(),
  phone: z.string().max(30).optional(),
  whatsapp: z.string().max(30).optional(),
  website: z.string().url("Debe ser una URL válida").optional().or(z.literal("")),
  instagram: z.string().max(60).optional(),
  facebook: z.string().max(60).optional(),
  coverImage: z.string().url("Debe ser una URL válida").optional().or(z.literal("")),
  barrioId: z.string().min(1, "Debe seleccionar un barrio"),
  ownerId: z.string().min(1, "Debe especificar el ID del dueño")
});

type BusinessFormValues = z.infer<typeof businessSchema>;

export default function BusinessesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [search, setSearch] = useState("");
  const [barrioFilter, setBarrioFilter] = useState("");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema)
  });

  const { data: barrios } = useQuery({
    queryKey: ["barrios-list"],
    queryFn: async () => {
      const res = await apiClient.get("/barrios");
      return res.data.data;
    }
  });

  const { data: businesses = [], isLoading: isLoadingBusinesses, error: businessesError } = useQuery({
    queryKey: ["admin-businesses", barrios?.map((barrio: Barrio) => barrio.slug).join(",")],
    enabled: !!barrios,
    queryFn: async () => {
      const lists = await Promise.all((barrios as Barrio[]).map(async (barrio) => {
        const first = (await apiClient.get(`/barrios/${barrio.slug}/businesses`, { params: { page: 1, limit: 50 } })).data.data;
        const totalPages = Math.ceil(first.total / first.limit);
        const rest = await Promise.all(Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
          apiClient.get(`/barrios/${barrio.slug}/businesses`, { params: { page: index + 2, limit: 50 } })
        ));
        return [first, ...rest.map((response) => response.data.data)].flatMap((result) => result.items).map((business: Omit<Business, "barrio">) => ({ ...business, barrio }));
      }));
      return lists.flat().sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: BusinessFormValues) => {
      // Clean empty strings for optional URL fields
      const payload = {
        ...data,
        website: data.website || undefined,
        coverImage: data.coverImage || undefined,
      };

      if (editingBusiness) {
        const updateData: Partial<typeof payload> = { ...payload };
        delete updateData.slug;
        const res = await apiClient.patch(`/admin/businesses/${editingBusiness.id}`, updateData);
        return res.data;
      } else {
        const res = await apiClient.post("/admin/businesses", payload);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
      handleCloseModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/admin/businesses/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
    }
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, verified }: { id: string, verified: boolean }) => {
      const res = await apiClient.patch(`/admin/businesses/${id}/verify`, { verified });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
    }
  });

  const handleOpenModal = async (business?: Business) => {
    if (business) {
      setIsLoadingDetail(true);
      setIsModalOpen(true);
      let detail = business;
      try {
        const response = await apiClient.get(`/barrios/${business.barrio.slug}/businesses/${business.slug}`);
        detail = { ...response.data.data, barrio: business.barrio };
      } finally {
        setIsLoadingDetail(false);
      }
      setEditingBusiness(detail);
      reset({
        name: detail.name,
        slug: detail.slug,
        category: detail.category as BusinessFormValues["category"],
        address: detail.address,
        description: detail.description || "",
        phone: detail.phone || "",
        whatsapp: detail.whatsapp || "",
        website: detail.website || "",
        instagram: detail.instagram || "",
        facebook: detail.facebook || "",
        coverImage: detail.coverImage || "",
        barrioId: detail.barrio.id,
        ownerId: detail.owner.id
      });
    } else {
      setEditingBusiness(null);
      reset({
        name: "", slug: "", category: "OTROS", address: "", description: "",
        phone: "", whatsapp: "", website: "", instagram: "", facebook: "",
        coverImage: "", barrioId: "", ownerId: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBusiness(null);
    reset();
  };

  const onSubmit = (data: BusinessFormValues) => {
    saveMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este comercio?")) {
      deleteMutation.mutate(id);
    }
  };

  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const filteredBusinesses = businesses.filter((business) =>
    (!barrioFilter || business.barrio.slug === barrioFilter) &&
    (!normalizedSearch || `${business.name} ${business.address} ${business.owner.name || business.owner.nickname || ""}`.toLocaleLowerCase("es").includes(normalizedSearch))
  );

  const mutationError = saveMutation.error || deleteMutation.error || verifyMutation.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Comercios y Negocios</h1>
          <p className="text-sm text-[var(--text-muted)]">Gestión del directorio de comercios barriales y verificación oficial.</p>
        </div>
        
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-text)] hover:bg-[var(--primary-dark)] hover:text-white transition-colors"
        >
          <Plus size={16} />
          Nuevo Negocio
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, dirección o responsable..." className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--primary)]" />
        </label>
        <select value={barrioFilter} onChange={(event) => setBarrioFilter(event.target.value)} className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]">
          <option value="">Todos los barrios</option>
          {barrios?.map((barrio: Barrio) => <option key={barrio.id} value={barrio.slug}>{barrio.name}</option>)}
        </select>
      </div>

      {(businessesError || mutationError) && <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">{getApiErrorMessage(businessesError || mutationError, "No se pudo completar la operación.")}</div>}

      <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--divider)]">
            <thead className="bg-[var(--surface-flat)]">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Negocio</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Categoría</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Responsable / Barrio</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Estado</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)] bg-[var(--surface)]">
              {isLoadingBusinesses ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--primary)]" />
                  </td>
                </tr>
              ) : filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    No hay comercios registrados.
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((business) => (
                  <tr key={business.id} className="hover:bg-[var(--surface-flat)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center text-[var(--primary-dark)]">
                          {business.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={business.coverImage} alt={business.name} className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Store size={20} />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[var(--text)] flex items-center gap-1">
                            {business.name}
                            {business.verified && <ShieldCheck size={14} className="text-[var(--primary)]" />}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">{business.address}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="neutral">{business.category}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[var(--text)]">{business.owner?.name || business.owner?.nickname || "Desconocido"}</div>
                      <div className="text-xs text-[var(--text-muted)]">{business.barrio?.name || "Sin barrio"}</div>
                    </td>
                    <td className="px-6 py-4">
                      {business.verified 
                        ? <Badge variant="success">Verificado</Badge> 
                        : <Badge variant="neutral">Estándar</Badge>
                      }
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end gap-3 items-center">
                        <button
                          onClick={() => verifyMutation.mutate({ id: business.id, verified: !business.verified })}
                          disabled={verifyMutation.isPending}
                          className="text-[var(--primary)] hover:text-[var(--primary-dark)] text-xs font-medium mr-2"
                        >
                          {business.verified ? "Desverificar" : "Verificar"}
                        </button>
                        <button
                          onClick={() => handleOpenModal(business)}
                          className="text-[var(--text-muted)] hover:text-[var(--text)]"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(business.id)}
                          className="text-[var(--error)] hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingBusiness ? "Editar Comercio" : "Nuevo Comercio"}
      >
          {isLoadingDetail ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[var(--primary)]" /></div> : <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Nombre</label>
              <input type="text" {...register("name")} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]" />
              {errors.name && <p className="mt-1 text-xs text-[var(--error)]">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Slug</label>
              <input type="text" {...register("slug")} disabled={!!editingBusiness} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)] disabled:opacity-50" />
              {errors.slug && <p className="mt-1 text-xs text-[var(--error)]">{errors.slug.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Categoría</label>
              <select {...register("category")} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.category && <p className="mt-1 text-xs text-[var(--error)]">{errors.category.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Barrio</label>
              <select {...register("barrioId")} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]">
                <option value="">Seleccionar barrio...</option>
                {barrios?.map((b: Barrio) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {errors.barrioId && <p className="mt-1 text-xs text-[var(--error)]">{errors.barrioId.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Dueño (ID de Usuario)</label>
            <input type="text" {...register("ownerId")} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]" placeholder="ID de prisma del usuario" />
            {errors.ownerId && <p className="mt-1 text-xs text-[var(--error)]">{errors.ownerId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Dirección</label>
            <input type="text" {...register("address")} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]" />
            {errors.address && <p className="mt-1 text-xs text-[var(--error)]">{errors.address.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Descripción</label>
            <textarea {...register("description")} rows={2} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">WhatsApp</label>
              <input type="text" {...register("whatsapp")} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Teléfono</label>
              <input type="text" {...register("phone")} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Imagen de Portada (URL)</label>
            <input type="url" {...register("coverImage")} className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)]" />
            {errors.coverImage && <p className="mt-1 text-xs text-[var(--error)]">{errors.coverImage.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--divider)] mt-6">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-text)] hover:bg-[var(--primary-dark)] hover:text-white transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {editingBusiness ? "Guardar Cambios" : "Crear Comercio"}
            </button>
          </div>
          </form>}
      </Modal>
    </div>
  );
}
