"use client";

import Link from "next/link";

export default function LoginColaboradorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f9fb] px-6 py-12 text-[#2a3439]">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold tracking-[0.2em] text-[#3a5f94] uppercase">Acceso colaboradores</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Próximamente</h1>
        <p className="mt-3 text-sm text-[#566166]">
          Esta será la pantalla de inicio de sesión para colaboradores. Mientras tanto, el acceso de administración y
          monitoría está disponible en /login.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-[#3a5f94] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d5387]"
          >
            Ir al login Admin/Monitor
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
