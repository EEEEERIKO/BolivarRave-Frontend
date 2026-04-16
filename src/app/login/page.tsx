"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";
import { type AuthSession, writeAuthSession } from "@/lib/auth-session";

type LoginResponse = {
  session: AuthSession;
};

export default function LoginPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanCedula = useMemo(() => cedula.replace(/\D/g, ""), [cedula]);

  const renderError = (message: string) => {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("portal de admin/monitor") || normalizedMessage.includes("debe ingresar por el portal")) {
      return (
        <p className="rounded-md border border-[#f7c56c]/50 bg-[#fff8e6] px-3 py-2 text-xs font-medium text-[#8a5a00]">
          Este usuario debe acceder al portal de colaboradores con su cédula.{' '}
          <a className="font-bold text-[#3a5f94] hover:underline" href="/login/colaborador">
            Ir al portal de colaboradores
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

    if (!cleanCedula || !password) {
      setIsSubmitting(false);
      setError("Ingresa cédula y contraseña para continuar.");
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
          password,
          portal: "admin-monitor",
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
    <div className="min-h-screen bg-[#f7f9fb] text-[#2a3439] selection:bg-[#bfd5ff] selection:text-[#153f73]">
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/60 bg-[#f7f9fb]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white">
              <Image src="/logo.png" alt="UNAC" width={40} height={40} className="object-contain" />
            </div>
            <span className="text-lg font-semibold tracking-tight sm:text-xl">Administración Bolivar Rave</span>
          </div>
          <div className="flex items-center gap-5">
            <button type="button" className="inline-flex items-center gap-2 rounded px-2 py-1 text-sm font-medium text-[#566166] hover:bg-slate-200/60 hover:text-[#3a5f94]">
              <span className="material-symbols-outlined text-[18px]">language</span>
              Español
            </button>
            <a href="#" className="text-sm font-semibold text-[#3a5f94] hover:opacity-80">
              Soporte
            </a>
          </div>
        </div>
      </header>

      <main className="flex items-center justify-center px-5 py-10 sm:px-6 md:py-14">
        <div className="mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#a9b4b9]/20 bg-[#f0f4f7] shadow-[0_10px_40px_rgba(42,52,57,0.06)] md:flex-row">
          <div className="relative hidden w-1/2 overflow-hidden bg-[#e8eff3] md:flex md:flex-col md:justify-end">
            <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#3a5f94]/20 via-transparent to-transparent" />
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0b0f10]/72 via-[#0b0f10]/28 to-transparent" />
            <Image
              src="/images/login-bg-bolivar-rave.webp"
              alt="Edificio academico Bolivar Rave"
              fill
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
              quality={90}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="relative z-20 p-10 text-white">
              <h2 className="text-3xl leading-tight font-bold tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]">
                Infraestructura Administrativa Inteligente
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/95 [text-shadow:0_2px_10px_rgba(0,0,0,0.45)]">
                Acceso seguro para administración y monitoreo institucional del Edificio Bolivar Rave.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col bg-white p-7 sm:p-10 md:w-1/2 md:p-14">
            <div className="mb-8">
              <span className="mb-2 block text-xs font-bold tracking-[0.2em] text-[#3a5f94] uppercase">Acceso seguro</span>
              <h1 className="text-2xl font-bold tracking-tight text-[#2a3439]">Login Admin/Monitor</h1>
              <p className="mt-2 text-sm text-[#566166]">Ingresa con tus credenciales institucionales para continuar.</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="national-id" className="mb-2 ml-1 block text-xs font-semibold text-[#566166]">
                  Cédula de ciudadanía
                </label>
                <div className="group relative">
                  <input
                    id="national-id"
                    value={cedula}
                    onChange={(event) => setCedula(event.target.value)}
                    placeholder="Número de identificación"
                    className="w-full border-b-2 border-transparent bg-[#f0f4f7] px-4 py-3.5 text-sm text-[#2a3439] transition-all outline-none focus:border-[#3a5f94]"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[#a9b4b9] group-focus-within:text-[#3a5f94]">
                    <span className="material-symbols-outlined text-[20px]">badge</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 ml-1 flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold text-[#566166]">
                    Contraseña
                  </label>
                  <a href="#" className="text-xs font-medium text-[#3a5f94] hover:text-[#2d5387]">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="group relative">
                  <input
                    id="password"
                    type={isPasswordVisible ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full border-b-2 border-transparent bg-[#f0f4f7] px-4 py-3.5 pr-12 text-sm text-[#2a3439] transition-all outline-none focus:border-[#3a5f94]"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#a9b4b9] transition-colors hover:text-[#3a5f94] focus:text-[#3a5f94] focus:outline-none"
                  >
                    <span className="material-symbols-outlined text-[20px]">{isPasswordVisible ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              {error ? renderError(error) : null}

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-center gap-2 rounded-md bg-[#3a5f94] py-4 text-sm font-semibold text-[#f6f7ff] shadow-sm transition-all duration-200 hover:bg-[#2d5387] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Ingresando..." : "Ingresa al sistema"}
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                </button>
              </div>
            </form>

            <div className="mt-auto border-t border-dashed border-[#d9e4ea] pt-8">
              <div className="mb-4 flex items-center gap-3 text-[#566166]">
                <div className="rounded-lg bg-[#e8eff3] p-2">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                </div>
                <div className="text-xs leading-tight">
                  <p className="font-semibold text-[#2a3439]">Seguridad institucional activa</p>
                  <p>Sesión cifrada de extremo a extremo</p>
                </div>
              </div>
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                <p className="text-[11px] font-bold tracking-wider text-[#566166] uppercase">Acceso institucional</p>
                <ul className="mt-2 space-y-1 text-xs text-[#566166]">
                  <li>Admin y Monitor: ingreso con cédula y contraseña.</li>
                  <li>Colaborador: usa el portal separado con cédula.</li>
                  <li>Si olvidaste tu contraseña, solicita soporte institucional.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-slate-200/50 bg-[#f7f9fb]">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-between gap-4 px-6 py-10 md:flex-row lg:px-8">
          <div className="text-sm leading-relaxed text-[#566166]">
            © 2024 Administración Bolivar Rave. Todos los derechos reservados.
          </div>
          <div className="flex gap-7">
            <a className="text-sm text-[#566166] transition-colors hover:text-[#3a5f94]" href="#">
              Política de privacidad
            </a>
            <a className="text-sm text-[#566166] transition-colors hover:text-[#3a5f94]" href="#">
              Términos
            </a>
            <a className="text-sm text-[#566166] transition-colors hover:text-[#3a5f94]" href="#">
              Seguridad
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
