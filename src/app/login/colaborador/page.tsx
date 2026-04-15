"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { type AuthSession, writeAuthSession } from "@/lib/auth-session";

type CollaboratorMock = {
  cedula: string;
  session: AuthSession;
};

const COLLABORATOR_USERS: CollaboratorMock[] = [
  {
    cedula: "1001001003",
    session: {
      role: "colaborador",
      name: "Gerson Esteban Marin Gomez",
      roleLabel: "Colaborador",
      cedula: "1001001003",
    },
  },
  {
    cedula: "1001001004",
    session: {
      role: "colaborador",
      name: "Luisa Fernanda Torres",
      roleLabel: "Colaborador",
      cedula: "1001001004",
    },
  },
];

export default function LoginColaboradorPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCedula = useMemo(() => cedula.replace(/\D/g, ""), [cedula]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const match = COLLABORATOR_USERS.find((user) => user.cedula === cleanCedula);
    if (!match) {
      setIsSubmitting(false);
      setError("Cédula no autorizada para el portal de colaboradores.");
      return;
    }

    writeAuthSession(match.session);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#2a3439]">
      <header className="w-full bg-[#f0f4f7]">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Administración Bolivar Rave</span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a className="text-[#566166] transition-colors duration-200 hover:text-[#3a5f94]" href="#">
              Portal select
            </a>
            <a className="text-[#566166] transition-colors duration-200 hover:text-[#3a5f94]" href="#">
              Protocolo de seguridad
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <button type="button" className="rounded-full p-2 text-[#3a5f94] transition-colors hover:bg-white/60">
              <span className="material-symbols-outlined">language</span>
            </button>
            <button type="button" className="rounded-full p-2 text-[#3a5f94] transition-colors hover:bg-white/60">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
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
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f0f4f7]">
                <span className="material-symbols-outlined text-3xl text-[#3a5f94]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  badge
                </span>
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

              {error ? <p className="rounded-md border border-[#fe8983]/50 bg-[#fe8983]/15 px-3 py-2 text-xs font-medium text-[#752121]">{error}</p> : null}

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

      <footer className="w-full border-t border-slate-200/30 bg-[#f7f9fb]">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm leading-relaxed md:flex-row lg:px-8">
          <div className="text-[#566166] opacity-80 transition-all hover:opacity-100">
            © 2024 Administración Bolivar Rave. All Rights Reserved. Secure Academic Gateway.
          </div>
          <div className="flex gap-6">
            <a className="text-[#566166] transition-all hover:text-[#3a5f94]" href="#">
              Privacy Policy
            </a>
            <a className="text-[#566166] transition-all hover:text-[#3a5f94]" href="#">
              Terms of Service
            </a>
            <a className="text-[#566166] transition-all hover:text-[#3a5f94]" href="#">
              System Status
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
