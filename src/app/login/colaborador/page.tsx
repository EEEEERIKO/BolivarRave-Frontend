/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";
import { type AuthSession, writeAuthSession } from "@/lib/auth-session";

type LoginResponse = {
  session: AuthSession;
};

type LegalModalType = "privacy" | "terms" | "security";

function getStaffPhotoUrl(cedula: string): string {
  return `/api/staff-photo/${encodeURIComponent(cedula)}`;
}

export default function LoginColaboradorPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<LegalModalType | null>(null);

  const cleanCedula = useMemo(() => cedula.replace(/\D/g, ""), [cedula]);

  const legalModalContent = useMemo(() => {
    if (legalModal === "privacy") {
      return {
        title: "Política de privacidad",
        body: "Tus datos se usan solo para autenticación, control operativo y trazabilidad institucional. No se comparten con terceros fuera de los procesos internos autorizados.",
      };
    }

    if (legalModal === "terms") {
      return {
        title: "Términos",
        body: "El acceso a esta plataforma es exclusivo para personal autorizado. Toda acción puede ser registrada para auditoría, seguridad y cumplimiento institucional.",
      };
    }

    if (legalModal === "security") {
      return {
        title: "Seguridad",
        body: "La sesión está protegida con autenticación por credenciales y controles de acceso por rol. Reporta inmediatamente cualquier actividad sospechosa al equipo administrador.",
      };
    }

    return null;
  }, [legalModal]);

  const renderError = (message: string) => {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("admin/monitor") || normalizedMessage.includes("portal de admin")) {
      return (
        <p className="rounded-md border border-[#f7c56c]/50 bg-[#fff8e6] px-3 py-2 text-xs font-medium text-[#8a5a00]">
          Este usuario debe iniciar sesión con su contraseña en el portal de administradores o monitores.{' '}
          <a className="font-bold text-[#3a5f94] hover:underline" href="/login">
            Ir al portal de administradores
          </a>
        </p>
      );
    }

    return <p className="rounded-md border border-[#fe8983]/50 bg-[#fe8983]/15 px-3 py-2 text-xs font-medium text-[#752121]">{message}</p>;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!cleanCedula) {
      setIsSubmitting(false);
      setError("Ingresa una cédula válida para continuar.");
      return;
    }

    try {
      const data = await fetchApiJson<LoginResponse>("/api/staff/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cedula: cleanCedula,
          portal: "colaborador",
        }),
      });

      writeAuthSession(data.session);
      router.push("/");
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No se pudo iniciar sesión.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#2a3439]">
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/60 bg-[#f7f9fb]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white">
              <Image src="/logo.png" alt="UNAC" width={40} height={40} className="object-contain" />
            </div>
            <span className="text-lg font-semibold tracking-tight sm:text-xl">Administración Bolivar Rave</span>
          </div>
        </div>
      </header>

      <main className="relative flex min-h-[calc(100vh-150px)] flex-grow items-center justify-center overflow-hidden px-6 py-12">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#d5e3ff]/50 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-[500px] w-[500px] rounded-full bg-[#d3e4fe]/20 blur-3xl" />
        </div>

        <section className="relative z-10 w-full max-w-md">
          <div className="rounded-xl border border-[#a9b4b9]/15 bg-white p-10 shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
            <div className="mb-8 flex flex-col items-center">
              <div className="relative mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#f0f4f7]">
                {cleanCedula ? (
                  <img
                    src={getStaffPhotoUrl(cleanCedula)}
                    alt={`Foto del colaborador ${cleanCedula}`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      const image = event.currentTarget;
                      image.style.display = "none";
                      const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                      fallback?.classList.remove("hidden");
                    }}
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                      fallback?.classList.add("hidden");
                      image.style.display = "block";
                    }}
                  />
                ) : null}
                <div
                  data-staff-photo-fallback="true"
                  className={`flex h-full w-full items-center justify-center ${cleanCedula ? "hidden" : ""}`}
                >
                  <span className="material-symbols-outlined text-3xl text-[#3a5f94]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    badge
                  </span>
                </div>
              </div>
              <h1 className="mb-2 text-center text-2xl font-bold tracking-tight text-[#2a3439]">Portal de colaboradores</h1>
              <p className="max-w-[280px] text-center text-sm leading-relaxed text-[#566166]">
                Ingresa tu cédula para consultar tareas asignadas y turnos de trabajo.
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="collab-national-id" className="block px-1 text-sm font-medium text-[#566166]">
                  Cédula de ciudadanía
                </label>
                <div className="group relative">
                  <span className="material-symbols-outlined absolute top-1/2 left-4 -translate-y-1/2 text-xl text-[#a9b4b9] transition-colors group-focus-within:text-[#3a5f94]">
                    fingerprint
                  </span>
                  <input
                    id="collab-national-id"
                    type="text"
                    value={cedula}
                    onChange={(event) => setCedula(event.target.value)}
                    placeholder="000.000.000"
                    className="w-full rounded-lg border-0 border-b-2 border-transparent bg-[#f0f4f7] py-4 pr-4 pl-12 text-sm text-[#2a3439] transition-all outline-none placeholder:text-[#a9b4b9]/80 focus:border-[#3a5f94]"
                  />
                </div>
              </div>

              {error ? renderError(error) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex w-full items-center justify-center gap-3 rounded-md bg-[#3a5f94] px-6 py-4 font-semibold text-[#f6f7ff] shadow-sm transition-all hover:bg-[#2d5387] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Ingresando..." : "Ingresa al sistema"}
                <span className="material-symbols-outlined text-xl transition-transform group-hover:translate-x-1">arrow_forward</span>
              </button>
            </form>

            <div className="mt-8 border-t border-[#a9b4b9]/20 pt-8">
              <div className="flex items-center justify-center gap-2 text-xs font-medium tracking-widest text-[#566166] uppercase">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified_user
                </span>
                Gateway académico seguro
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-[#566166]">
              ¿Problemas de acceso?
              <br />
              <a className="font-medium text-[#3a5f94] hover:underline" href="#">
                Contacta al administrador del sistema
              </a>
            </p>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200/50 bg-[#f7f9fb]">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-between gap-1 px-6 py-3 md:flex-row md:py-4 lg:px-8">
          <div className="text-xs leading-snug text-[#566166]">
            © 2026 Administración Bolivar Rave. Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setLegalModal("privacy")}
              className="text-xs text-[#566166] transition-colors hover:text-[#3a5f94]"
            >
              Política de privacidad
            </button>
            <button
              type="button"
              onClick={() => setLegalModal("terms")}
              className="text-xs text-[#566166] transition-colors hover:text-[#3a5f94]"
            >
              Términos
            </button>
            <button
              type="button"
              onClick={() => setLegalModal("security")}
              className="text-xs text-[#566166] transition-colors hover:text-[#3a5f94]"
            >
              Seguridad
            </button>
          </div>
        </div>
      </footer>

      {legalModal && legalModalContent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#2a3439]">{legalModalContent.title}</h2>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-[#566166] hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[#566166]">{legalModalContent.body}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
