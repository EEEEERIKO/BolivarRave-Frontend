"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApiJson } from "@/lib/api-client";
import { clearAuthSession, readAuthSession } from "@/lib/auth-session";

export default function SettingsPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const session = readAuthSession();
  const isCollaborador = session?.role === "colaborador";

  const canChangePassword = session?.role === "admin" || session?.role === "monitor";

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Completa todos los campos para actualizar la contraseña.");
      return;
    }

    if (!session?.cedula) {
      setError("No se encontró una sesión válida. Inicia sesión nuevamente.");
      return;
    }

    if (!canChangePassword) {
      setError("Tu rol no usa contraseña para este portal.");
      return;
    }

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetchApiJson<{ message: string }>("/api/staff/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cedula: session.cedula,
          currentPassword,
          newPassword,
        }),
      });

      setSuccess(response.message || "Contraseña actualizada correctamente.");
      setIsSubmitting(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No se pudo actualizar la contraseña.";
      setError(message);
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    clearAuthSession();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] px-5 py-8 text-[#2a3439] sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2a3439]">Configuración</h1>
          <p className="mt-2 text-sm text-[#566166]">
            {isCollaborador
              ? "Gestiona tu sesión y preferencias generales del portal."
              : "Configura tu acceso institucional y parámetros de seguridad."}
          </p>
        </header>

        <div className="grid gap-10">
          {!isCollaborador ? (
          <section className="rounded-xl bg-[#f0f4f7] p-1">
            <div className="rounded-[0.75rem] bg-white p-7 shadow-sm sm:p-8">
              <div className="mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#3a5f94]">security</span>
                <h2 className="text-xl font-bold tracking-tight text-[#2a3439]">Seguridad</h2>
              </div>

              <div className="max-w-md">
                <h3 className="mb-6 text-xs font-bold tracking-wider text-[#566166] uppercase">Cambiar contraseña</h3>

                {!canChangePassword ? (
                  <p className="mb-6 text-xs font-semibold text-[#566166]">
                    Este usuario no administra contraseña en el portal. Si necesitas credenciales de acceso, contacta al administrador.
                  </p>
                ) : null}

                <form className="space-y-6" onSubmit={handlePasswordSubmit}>
                  <div className="space-y-1">
                    <label className="ml-1 text-xs font-bold text-[#566166]">Contraseña actual</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      disabled={!canChangePassword || isSubmitting}
                      className="w-full rounded-t-lg border-0 border-b-2 border-transparent bg-[#f0f4f7] px-4 py-3 text-[#2a3439] placeholder:text-[#a9b4b9] focus:border-[#3a5f94] focus:ring-0"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="ml-1 text-xs font-bold text-[#566166]">Nueva contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      disabled={!canChangePassword || isSubmitting}
                      className="w-full rounded-t-lg border-0 border-b-2 border-transparent bg-[#f0f4f7] px-4 py-3 text-[#2a3439] placeholder:text-[#a9b4b9] focus:border-[#3a5f94] focus:ring-0"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="ml-1 text-xs font-bold text-[#566166]">Confirmar nueva contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      disabled={!canChangePassword || isSubmitting}
                      className="w-full rounded-t-lg border-0 border-b-2 border-transparent bg-[#f0f4f7] px-4 py-3 text-[#2a3439] placeholder:text-[#a9b4b9] focus:border-[#3a5f94] focus:ring-0"
                      placeholder="••••••••"
                    />
                  </div>

                  {error ? <p className="text-xs font-semibold text-[#752121]">{error}</p> : null}
                  {success ? <p className="text-xs font-semibold text-[#2d5387]">{success}</p> : null}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={!canChangePassword || isSubmitting}
                      className="rounded-md bg-[#3a5f94] px-6 py-3 text-sm font-bold text-[#f6f7ff] shadow-sm transition-all hover:brightness-110 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
          ) : null}

          <section className="rounded-xl bg-[#f0f4f7] p-1">
            <div className="rounded-[0.75rem] bg-white p-7 shadow-sm sm:p-8">
              <div className="mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-[#3a5f94]">person</span>
                <h2 className="text-xl font-bold tracking-tight text-[#2a3439]">Cuenta</h2>
              </div>

              <div className="flex flex-col items-start justify-between gap-6 rounded-xl border-2 border-dashed border-[#d9e4ea] p-6 md:flex-row md:items-center">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#2a3439]">Sesión activa</h3>
                  <p className="text-sm text-[#566166]">Finaliza tu sesión actual para cerrar el acceso a este portal.</p>
                  {session ? <p className="text-xs text-[#3a5f94]">Usuario: {session.name} ({session.roleLabel})</p> : null}
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="group flex items-center gap-2 rounded-full bg-[#d9e4ea] px-6 py-3 text-sm font-bold text-[#9f403d] transition-all duration-300 hover:bg-[#9f403d] hover:text-[#fff7f6]"
                >
                  <span className="material-symbols-outlined text-sm">logout</span>
                  Cerrar sesión
                </button>
              </div>
            </div>
          </section>

          <div className="flex justify-center pt-2">
            <div className="flex select-none items-center gap-2 opacity-30">
              <div className="h-1 w-1 rounded-full bg-[#3a5f94]" />
              <div className="h-px w-8 bg-[#3a5f94]" />
              <div className="h-1 w-1 rounded-full bg-[#3a5f94]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
