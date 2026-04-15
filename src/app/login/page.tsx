"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { type AuthSession, writeAuthSession } from "@/lib/auth-session";

type MockUser = {
  cedula: string;
  password: string;
  session: AuthSession;
};

const MOCK_USERS: MockUser[] = [
  {
    cedula: "1001001001",
    password: "admin123",
    session: {
      role: "admin",
      name: "Dr. Ricardo Silva",
      roleLabel: "Administrador del sistema",
      cedula: "1001001001",
    },
  },
  {
    cedula: "1001001002",
    password: "monitor123",
    session: {
      role: "monitor",
      name: "Andrea Paola Rios",
      roleLabel: "Monitor académico",
      cedula: "1001001002",
    },
  },
  {
    cedula: "1001001003",
    password: "colab123",
    session: {
      role: "colaborador",
      name: "Gerson Esteban Marin Gomez",
      roleLabel: "Colaborador",
      cedula: "1001001003",
    },
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanCedula = useMemo(() => cedula.replace(/\D/g, ""), [cedula]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const match = MOCK_USERS.find(
      (user) => user.cedula === cleanCedula && user.password === password,
    );

    if (!match) {
      setIsSubmitting(false);
      setError("Credenciales inválidas. Verifica cédula y contraseña.");
      return;
    }

    writeAuthSession(match.session);
    router.push("/");
    router.refresh();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f7f8] p-6 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-[#295786]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-12 h-80 w-80 rounded-full bg-[#bfd5ff]/35 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white">
              <Image src="/logo.png" alt="UNAC" width={40} height={40} className="h-10 w-10 object-contain" />
            </div>
            <div>
              <p className="text-sm font-black tracking-wide text-[#295786]">BOLIVAR RAVE</p>
              <p className="text-[11px] text-slate-500">Portal administrativo UNAC</p>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-600">Accede con tu cédula institucional para continuar.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-[#295786]/5">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Cédula</span>
              <div className="relative">
                <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">badge</span>
                <input
                  value={cedula}
                  onChange={(event) => setCedula(event.target.value)}
                  placeholder="1001001001"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm font-medium text-slate-900 outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/15"
                />
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">Contraseña</span>
              <div className="relative">
                <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">lock</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-10 pl-10 text-sm font-medium text-slate-900 outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/15"
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-[#295786]"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </label>

            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#295786] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#295786]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Ingresando..." : "Entrar"}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <p className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">Accesos de prueba</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li>Admin: 1001001001 / admin123</li>
              <li>Monitor: 1001001002 / monitor123</li>
              <li>Colaborador: 1001001003 / colab123</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
