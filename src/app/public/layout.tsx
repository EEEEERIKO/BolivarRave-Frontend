"use client";

import Link from "next/link";
import { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#2a3439]">
      <header className="w-full bg-white border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-extrabold text-xl">Página de Reservas - UNAC</Link>
          <nav className="flex items-center gap-4">
            <Link href="/public/horarios" className="text-sm font-medium text-[#3a5f94]">Reservas de Salones</Link>
            <Link href="/public/auditorio" className="text-sm font-medium text-[#3a5f94]">Reservas de Auditorio</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>

      <footer className="mt-12 border-t border-slate-100 py-8 text-center text-sm text-[#566166]">
        © Corporación Universitaria Adventista de Colombia — Página Oficial de Reservas
      </footer>
    </div>
  );
}
