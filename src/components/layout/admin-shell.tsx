/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuthSession, readAuthSession, type AuthSession } from "@/lib/auth-session";

type NavItem = {
  label: string;
  icon: string;
  href: string;
  isRoute?: boolean;
};

const navItems: NavItem[] = [
  { label: "Tablero", icon: "dashboard", href: "/", isRoute: true },
  { label: "Horarios", icon: "calendar_today", href: "/schedules", isRoute: true },
  { label: "Salones", icon: "meeting_room", href: "/rooms", isRoute: true },
  { label: "Auditorio", icon: "theater_comedy", href: "/auditorio", isRoute: true },
  { label: "Personal", icon: "groups", href: "/staff", isRoute: true },
  { label: "Tareas", icon: "assignment_turned_in", href: "/tasks", isRoute: true },
  { label: "Inventario", icon: "inventory_2", href: "/inventory", isRoute: true },
  { label: "Importar Excel", icon: "upload_file", href: "/excel-import", isRoute: true },
];

function navClasses(isActive: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[#295786] text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;
}

function getStaffPhotoUrl(cedula: string): string {
  return `https://svga.unac.edu.co/svga/files/pics/${encodeURIComponent(cedula)}.jpg`;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname.startsWith("/login");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLoginRoute) {
      setIsSessionReady(true);
      return;
    }

    const session = readAuthSession();
    setAuthSession(session);
    setIsSessionReady(true);

    if (!session) {
      router.replace("/login");
    }
  }, [isLoginRoute, router]);

  const handleLogout = () => {
    clearAuthSession();
    setAuthSession(null);
    router.replace("/login");
    router.refresh();
  };

  if (isLoginRoute) {
    return <>{children}</>;
  }

  if (!isSessionReady || !authSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f8] p-4">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
          Cargando sesión...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f6f7f8] text-slate-900 dark:bg-[#13181f] dark:text-slate-100">
      <button
        type="button"
        aria-label="Cerrar navegación"
        className={`fixed inset-0 z-40 bg-slate-900/45 transition-opacity lg:hidden ${isMobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:w-64 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-3 p-6">
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-white">
            <Image src="/logo.png" alt="UNAC" width={40} height={40} className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-[#295786] dark:text-slate-100">UNAC</h1>
            <p className="text-[10px] font-medium text-slate-500">Coroporación Universitaria Adventista</p>
          </div>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-4">
          {navItems.map((item) => {
            const isActive = item.isRoute ? pathname === item.href : false;
            if (item.isRoute) {
              return (
                <Link key={item.label} className={navClasses(isActive)} href={item.href}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <a key={item.label} className={navClasses(false)} href={item.href}>
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          })}

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" className={`${navClasses(false)} w-full`} onClick={handleLogout}>
              <span className="material-symbols-outlined">settings</span>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
            <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#295786] text-xs font-bold text-white shadow-sm dark:border-slate-700">
              <img
                src={getStaffPhotoUrl(authSession.cedula)}
                alt={`Foto de perfil de ${authSession.name}`}
                className="h-full w-full object-cover"
                onError={(event) => {
                  const image = event.currentTarget;
                  image.style.display = "none";
                  const fallback = image.parentElement?.querySelector<HTMLElement>("[data-profile-photo-fallback='true']");
                  fallback?.classList.remove("hidden");
                }}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  const fallback = image.parentElement?.querySelector<HTMLElement>("[data-profile-photo-fallback='true']");
                  fallback?.classList.add("hidden");
                  image.style.display = "block";
                }}
              />
              <div data-profile-photo-fallback="true" className="hidden items-center justify-center">
                {authSession.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-semibold">{authSession.name}</p>
              <p className="truncate text-[10px] text-slate-500">{authSession.roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen min-w-0 flex-1 overflow-x-hidden pt-16 sm:pt-20 lg:ml-64">
        <header className="fixed top-0 left-0 right-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur-md sm:min-h-20 sm:px-6 lg:left-64 lg:px-8 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <button
              type="button"
              aria-label="Abrir navegación"
              onClick={() => setIsMobileMenuOpen(true)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 lg:hidden dark:bg-slate-800 dark:text-slate-300"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex min-w-0 shrink items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white sm:hidden">
                <Image src="/logo.png" alt="UNAC" width={32} height={32} className="h-8 w-8 object-contain" />
              </div>
              <div className="flex min-w-0 flex-col">
                <h2 className="truncate text-base leading-tight font-black text-[#295786] sm:hidden">UNAC</h2>
                <p className="truncate text-[10px] font-medium text-slate-600 sm:hidden">Administración Bolivar Rave</p>
                <h2 className="hidden text-sm leading-tight font-bold text-slate-900 sm:text-base lg:text-lg dark:text-white sm:block">Administración del Edificio Bolivar Rave</h2>
                <p className="hidden text-xs font-medium text-[#295786] sm:block">Sitio Web Oficial</p>
              </div>
            </div>
            <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-800 lg:block" />
            <div className="relative hidden min-w-0 flex-1 lg:block lg:max-w-[28rem]">
              <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">search</span>
              <input
                className="w-full rounded-xl border-none bg-slate-100 py-2 pr-4 pl-10 text-sm transition-all focus:ring-2 focus:ring-[#295786]/20 dark:bg-slate-800"
                placeholder="Buscar salones o docentes..."
                type="text"
              />
            </div>
          </div>
          <button className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2.5 size-2 rounded-full border-2 border-white bg-red-500 dark:border-slate-900" />
          </button>
        </header>

        {children}
      </main>
    </div>
  );
}
