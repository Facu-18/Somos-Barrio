"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import { Modal } from "@/components/ui/modal";
import { Loader2, Plus, Edit, Trash2, Search, MapPin } from "lucide-react";

type Barrio = {
  id: string;
  name: string;
  slug: string;
  city: string;
  province: string;
  country: string;
};

const barrioSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(120),
  slug: z.string().min(2, "Mínimo 2 caracteres").max(120).regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  city: z.string().min(2, "Mínimo 2 caracteres").max(120),
  province: z.string().min(2, "Mínimo 2 caracteres").max(120),
  country: z.string().min(2, "Mínimo 2 caracteres").max(2)
});

type BarrioFormValues = z.infer<typeof barrioSchema>;

export default function BarriosPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarrio, setEditingBarrio] = useState<Barrio | null>(null);
  const [search, setSearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<BarrioFormValues>({
    resolver: zodResolver(barrioSchema)
  });

  const { data: barrios, isLoading, error: barriosError } = useQuery({
    queryKey: ["admin-barrios"],
    queryFn: async () => {
      const res = await apiClient.get("/barrios");
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: BarrioFormValues) => {
      if (editingBarrio) {
        const updateData: Partial<BarrioFormValues> = { ...data };
        delete updateData.slug;
        const res = await apiClient.patch(`/admin/barrios/${editingBarrio.slug}`, updateData);
        return res.data;
      } else {
        const res = await apiClient.post("/admin/barrios", data);
        return res.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-barrios"] });
      handleCloseModal();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await apiClient.delete(`/admin/barrios/${slug}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-barrios"] });
    }
  });

  const handleOpenModal = (barrio?: Barrio) => {
    if (barrio) {
      setEditingBarrio(barrio);
      reset({
        name: barrio.name,
        slug: barrio.slug,
        city: barrio.city,
        province: barrio.province,
        country: barrio.country
      });
    } else {
      setEditingBarrio(null);
      reset({ name: "", slug: "", city: "", province: "", country: "AR" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBarrio(null);
    reset();
  };

  const onSubmit = (data: BarrioFormValues) => {
    saveMutation.mutate(data);
  };

  const handleDelete = (slug: string) => {
    if (confirm("¿Estás seguro de eliminar este barrio? Esta acción no se puede deshacer y puede fallar si tiene datos relacionados.")) {
      deleteMutation.mutate(slug);
    }
  };

  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  const filteredBarrios = barrios?.filter((barrio: Barrio) =>
    !normalizedSearch || `${barrio.name} ${barrio.slug} ${barrio.city} ${barrio.province}`.toLocaleLowerCase("es").includes(normalizedSearch)
  ) || [];
  const mutationError = saveMutation.error || deleteMutation.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Gestión de Barrios</h1>
          <p className="text-sm text-[var(--text-muted)]">Administrá los barrios activos en la plataforma.</p>
        </div>
        
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-text)] hover:bg-[var(--primary-dark)] hover:text-white transition-colors"
        >
          <Plus size={16} />
          Nuevo Barrio
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, slug o ubicación..." className="w-full rounded-lg border border-[var(--divider)] bg-[var(--surface)] py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[var(--primary)]" />
        </label>
        <div className="flex items-center gap-2 rounded-lg bg-[var(--primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--primary-dark)]"><MapPin size={16} /> {barrios?.length || 0} barrios</div>
      </div>

      {(barriosError || mutationError) && <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">{getApiErrorMessage(barriosError || mutationError, "No se pudo completar la operación.")}</div>}

      <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--divider)]">
            <thead className="bg-[var(--surface-flat)]">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Nombre</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Slug</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Ubicación</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)] bg-[var(--surface)]">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--primary)]" />
                  </td>
                </tr>
              ) : filteredBarrios.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    No hay barrios registrados.
                  </td>
                </tr>
              ) : (
                filteredBarrios.map((barrio: Barrio) => (
                  <tr key={barrio.id} className="hover:bg-[var(--surface-flat)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-[var(--text)]">{barrio.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-mono text-[var(--text-muted)]">{barrio.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[var(--text)]">{barrio.city}, {barrio.province} ({barrio.country})</div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleOpenModal(barrio)}
                          className="text-[var(--primary)] hover:text-[var(--primary-dark)]"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(barrio.slug)}
                          className="text-[var(--error)] hover:text-red-700"
                        >
                          <Trash2 size={18} />
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
        title={editingBarrio ? "Editar Barrio" : "Nuevo Barrio"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Nombre</label>
            <input
              type="text"
              {...register("name")}
              className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
            {errors.name && <p className="mt-1 text-xs text-[var(--error)]">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Slug</label>
            <input
              type="text"
              {...register("slug")}
              disabled={!!editingBarrio}
              className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-50"
            />
            {errors.slug && <p className="mt-1 text-xs text-[var(--error)]">{errors.slug.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Ciudad</label>
              <input
                type="text"
                {...register("city")}
                className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              />
              {errors.city && <p className="mt-1 text-xs text-[var(--error)]">{errors.city.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Provincia</label>
              <input
                type="text"
                {...register("province")}
                className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              />
              {errors.province && <p className="mt-1 text-xs text-[var(--error)]">{errors.province.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">País (2 letras)</label>
            <input
              type="text"
              {...register("country")}
              maxLength={2}
              className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-body)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
            {errors.country && <p className="mt-1 text-xs text-[var(--error)]">{errors.country.message}</p>}
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
              {editingBarrio ? "Guardar Cambios" : "Crear Barrio"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
