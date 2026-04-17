"use client";

import { useState, useEffect } from "react";
import type { AuthSession } from "@/lib/auth-session";
import { readAuthSession } from "@/lib/auth-session";

export default function HabilidadesPage() {
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    readAuthSession().then(setAuthSession);
  }, []);

  if (!authSession) {
    return <div className="p-8">Cargando...</div>;
  }

  return (
    <div className="w-full">
      <div className="space-y-6 p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Habilidades
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Gestiona las habilidades del personal
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex h-96 items-center justify-center text-center">
            <div>
              <div className="mb-4 inline-block rounded-full bg-slate-100 p-4 dark:bg-slate-700">
                <span className="material-symbols-outlined text-4xl text-slate-400">
                  school
                </span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Sin habilidades registradas
              </h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                Aquí aparecerán las habilidades del personal cuando se agreguen
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
