"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/auth-context";
import { apiClient } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginValues) => {
    setErrorMsg(null);
    try {
      const res = await apiClient.post("/auth/login", data);
      if (res.data.success) {
        login(res.data.data.accessToken, res.data.data.user);
      }
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err, "Error al iniciar sesión"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <Loader2 className="animate-spin text-[var(--primary)]" size={48} />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-8 shadow-xl border border-[var(--divider)]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[var(--primary-text)]">Somos Barrio</h1>
          <p className="mt-2 text-[var(--text-muted)]">Panel Administrativo</p>
        </div>

        {errorMsg && (
          <div className="mb-6 rounded-lg bg-[var(--error-bg)] p-4 text-[var(--error)] border border-[var(--error)]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-4 py-2 text-[var(--text-body)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              placeholder="admin@somosbarrio.local"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-sm text-[var(--error)]">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-body)] mb-1">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-[var(--divider)] bg-[var(--input-bg)] px-4 py-2 text-[var(--text-body)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              placeholder="••••••••"
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-sm text-[var(--error)]">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[var(--primary)] py-3 font-medium text-[var(--primary-text)] transition-colors hover:bg-[var(--primary-dark)] hover:text-white disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                Ingresando...
              </span>
            ) : (
              "Ingresar al Panel"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
