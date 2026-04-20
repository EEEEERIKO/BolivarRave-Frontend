/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { readAuthSession, type AuthSession } from "@/lib/auth-session";
import { fetchApiJson } from "@/lib/api-client";
import { useWebSocketSchedules } from "@/lib/use-websocket-schedules";

type PendingScheduleRequest = {
  id: string;
  eventId: string;
  status: "pendiente" | "aprobada" | "rechazada";
  requestedByName: string;
  requestedByRole: string;
  faculty: string;
  code: string;
  subject: string;
  teacher: string;
  room: string;
  day: string;
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  createdAt: string;
};

type UpcomingAuditorioNotification = {
  id: string;
  reservaId: string;
  nombreEvento: string;
  organizador: string;
  estado: "Pendiente" | "Aprobada" | "Cancelada";
  fechaInicioPeriodo?: string;
  fechaFinPeriodo?: string;
  numeroAsistentes?: number;
  requierePantalla?: boolean;
  requiereSonido?: boolean;
  requiereMonitor?: boolean;
  requiereProyector?: boolean;
  requiereFiltroAgua?: boolean;
  observaciones?: string | null;
  fechaEspecifica: string;
  horaInicio: string;
  horaFin: string;
  startsAt: string;
  notificationType: "en_curso" | "proximo";
  horarios?: Array<{
    id: string;
    fechaEspecifica: string;
    horaInicio: string;
    horaFin: string;
  }>;
  assignedWorkers: Array<{
    staffId: string;
    cedula: string;
    numeroStaff: number;
    nombreCompleto: string;
    rol: string;
    estado: string;
  }>;
};

type NavItem = {
  label: string;
  icon: string;
  href: string;
  isRoute?: boolean;
  allowedRoles?: Array<AuthSession["role"]>;
};

const navItems: NavItem[] = [
  { label: "Tablero", icon: "dashboard", href: "/", isRoute: true },
  { label: "Horarios", icon: "calendar_today", href: "/schedules", isRoute: true },
  { label: "Salones", icon: "meeting_room", href: "/rooms", isRoute: true },
  { label: "Auditorio", icon: "theater_comedy", href: "/auditorio", isRoute: true, allowedRoles: ["admin", "monitor"] },
  { label: "Personal", icon: "groups", href: "/staff", isRoute: true },
  { label: "Tareas", icon: "assignment_turned_in", href: "/tasks", isRoute: true, allowedRoles: ["admin", "monitor"] },
  { label: "Inventario", icon: "inventory_2", href: "/inventory", isRoute: true, allowedRoles: ["admin", "monitor"] },
  { label: "Importar Excel", icon: "upload_file", href: "/excel-import", isRoute: true, allowedRoles: ["admin"] },
  { label: "Configuración", icon: "settings", href: "/settings", isRoute: true },
];

function navClasses(isActive: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[#295786] text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;
}

function getStaffPhotoUrl(cedula: string): string {
  return `/api/staff-photo/${encodeURIComponent(cedula)}`;
}

function formatTimeAmPm(value: string): string {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = ((hours + 11) % 12) + 1;
  return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDateLong(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);

  return parsed.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);

  const dayText = String(parsed.getDate());
  const monthText = parsed.toLocaleDateString("es-CO", { month: "long" });
  const monthCapitalized = monthText.charAt(0).toUpperCase() + monthText.slice(1);
  const yearText = String(parsed.getFullYear());

  return `${dayText} ${monthCapitalized} ${yearText}`;
}

function getDurationInDays(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) {
    return 1;
  }

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy ?? 0, (sm ?? 1) - 1, sd ?? 1);
  const end = new Date(ey ?? 0, (em ?? 1) - 1, ed ?? 1);

  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) && days > 0 ? days : 1;
}

function buildResourcesLabel(event: UpcomingAuditorioNotification): string {
  const resources: string[] = [];
  if (event.requierePantalla) resources.push("Pantalla");
  if (event.requiereSonido) resources.push("Sonido");
  if (event.requiereMonitor) resources.push("Monitor");
  if (event.requiereProyector) resources.push("Proyector");
  if (event.requiereFiltroAgua) resources.push("Filtro de agua");

  if (resources.length === 0) return "Sin recursos solicitados";
  if (resources.length === 1) return resources[0];
  if (resources.length === 2) return `${resources[0]} y ${resources[1]}`;
  return `${resources.slice(0, -1).join(", ")} y ${resources[resources.length - 1]}`;
}

function getStaffInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getNotificationStatus(event: UpcomingAuditorioNotification): "en_curso" | "proximo_inmediato" | "proximo" {
  if (event.notificationType === "en_curso") {
    return "en_curso";
  }

  // Calcular minutos hasta el inicio
  const [startHours, startMinutes] = event.horaInicio.split(":").map(Number);
  const eventStart = new Date(event.fechaEspecifica);
  eventStart.setHours(startHours ?? 0, startMinutes ?? 0, 0, 0);

  const now = new Date();
  const minutesUntilStart = (eventStart.getTime() - now.getTime()) / (1000 * 60);

  if (minutesUntilStart > 0 && minutesUntilStart <= 90) {
    return "proximo_inmediato";
  }

  return "proximo";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname.startsWith("/login");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingScheduleRequest[]>([]);
  const [upcomingAuditorioEvents, setUpcomingAuditorioEvents] = useState<UpcomingAuditorioNotification[]>([]);
  const [expandedCollaboratorNotificationId, setExpandedCollaboratorNotificationId] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const notificationsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (notificationsPanelRef.current && !notificationsPanelRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    if (isNotificationsOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (!isNotificationsOpen) {
      setExpandedCollaboratorNotificationId(null);
    }
  }, [isNotificationsOpen]);

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
      return;
    }

    if (pathname.startsWith("/excel-import") && session.role !== "admin") {
      router.replace("/");
      return;
    }

    if (
      session.role === "colaborador" &&
      (pathname.startsWith("/auditorio") || pathname.startsWith("/tasks") || pathname.startsWith("/inventory"))
    ) {
      router.replace("/");
    }
  }, [isLoginRoute, pathname, router]);

  const syncNotifications = async () => {
    const role = authSession?.role;
    const canManageSchedules = role === "admin";
    const canReadAuditorioNotifications = role === "admin" || role === "monitor" || role === "colaborador";

    if (!role) {
      setPendingRequests([]);
      setUpcomingAuditorioEvents([]);
      return;
    }

    try {
      const [requestsResponse, upcomingResponse] = await Promise.all([
        canManageSchedules
          ? fetchApiJson<{ requests?: PendingScheduleRequest[] }>("/api/schedules/requests", { cache: "no-store" })
          : Promise.resolve({ requests: [] as PendingScheduleRequest[] }),
        canReadAuditorioNotifications
          ? fetchApiJson<{ notifications?: UpcomingAuditorioNotification[] }>("/api/auditorio/notifications/upcoming", {
              cache: "no-store",
            })
          : Promise.resolve({ notifications: [] as UpcomingAuditorioNotification[] }),
      ]);

      setPendingRequests(requestsResponse.requests ?? []);
      setUpcomingAuditorioEvents(upcomingResponse.notifications ?? []);
    } catch {
      setPendingRequests([]);
      setUpcomingAuditorioEvents([]);
    }
  };

  useEffect(() => {
    void syncNotifications();
  }, [authSession]);

  useWebSocketSchedules({
    enabled: Boolean(authSession && (authSession.role === "admin" || authSession.role === "monitor" || authSession.role === "colaborador")),
    onScheduleRefresh: () => {
      void syncNotifications();
    },
  });

  const totalNotifications = useMemo(() => {
    if (!authSession) {
      return 0;
    }

    if (authSession.role === "admin") {
      return pendingRequests.length + upcomingAuditorioEvents.length;
    }

    if (authSession.role === "monitor") {
      return upcomingAuditorioEvents.length;
    }

    if (authSession.role === "colaborador") {
      return upcomingAuditorioEvents.length;
    }

    return 0;
  }, [authSession, pendingRequests.length, upcomingAuditorioEvents.length]);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.allowedRoles || item.allowedRoles.includes(authSession?.role ?? "colaborador")),
    [authSession]
  );

  const handleSidebarRouteClick = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href) {
      event.preventDefault();
      return;
    }

    setIsMobileMenuOpen(false);
    setIsNotificationsOpen(false);

    // Fallback: leaving /tasks can occasionally stall in dev with client-side rendering.
    // Force a full navigation to avoid getting stuck in a perpetual "Rendering" state.
    if (pathname.startsWith("/tasks") && typeof window !== "undefined") {
      event.preventDefault();
      window.location.assign(href);
    }
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
      <style>{`
        @keyframes pulsoAhora {
          0%, 100% {
            border-color: rgb(239, 68, 68);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          50% {
            border-color: rgb(220, 38, 38);
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
          }
        }
        @keyframes pulsoProximo {
          0%, 100% {
            border-color: rgb(217, 119, 6);
            box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.3);
          }
          50% {
            border-color: rgb(180, 83, 9);
            box-shadow: 0 0 0 4px rgba(217, 119, 6, 0.15);
          }
        }
        .evento-en-curso {
          animation: pulsoAhora 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .evento-proximo-inmediato {
          animation: pulsoProximo 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
      <button
        type="button"
        aria-label="Cerrar navegación"
        className={`fixed inset-0 z-40 bg-slate-900/45 transition-opacity lg:hidden ${isMobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:w-64 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-3 p-6">
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-white">
            <Image src="/logo.png" alt="UNAC" width={40} height={40} className="object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-[#295786] dark:text-slate-100">UNAC</h1>
            <p className="text-[10px] font-medium text-slate-500">Coroporación Universitaria Adventista</p>
          </div>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-4">
          {visibleNavItems.map((item) => {
            const isActive = item.isRoute ? pathname === item.href : false;
            if (item.isRoute) {
              return (
                <Link key={item.label} className={navClasses(isActive)} href={item.href} onClick={(event) => handleSidebarRouteClick(event, item.href)}>
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
                <Image src="/logo.png" alt="UNAC" width={32} height={32} className="object-contain" />
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
          <div className="relative" ref={notificationsPanelRef}>
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((open) => !open)}
              aria-label="Abrir notificaciones"
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              <span className="material-symbols-outlined">notifications</span>
              {(authSession.role === "admin" || authSession.role === "monitor" || authSession.role === "colaborador") && totalNotifications > 0 ? (
                <span className="absolute top-1.5 right-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {totalNotifications > 9 ? "9+" : totalNotifications}
                </span>
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <div className="absolute right-0 top-12 z-50 max-h-[85vh] w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Notificaciones</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{authSession.roleLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    Cerrar
                  </button>
                </div>

                {authSession.role === "admin" ? (
                  <div className="mt-4 space-y-3">
                    {upcomingAuditorioEvents.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Auditorio: en curso y proximos</p>
                        {upcomingAuditorioEvents.map((event) => {
                          const notifStatus = getNotificationStatus(event);
                          return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => {
                              setIsNotificationsOpen(false);
                              router.push("/auditorio");
                            }}
                            className={`w-full rounded-lg border bg-[#295786]/5 px-3 py-3 text-left text-sm text-slate-700 transition dark:text-slate-100 ${
                              notifStatus === "en_curso"
                                ? "evento-en-curso border-red-500 dark:border-red-500"
                                : notifStatus === "proximo_inmediato"
                                  ? "evento-proximo-inmediato border-amber-600 dark:border-amber-500"
                                  : "border-[#295786]/20 hover:border-[#295786]/40 hover:bg-[#295786]/10 dark:border-[#295786]/40 dark:bg-[#295786]/20 dark:hover:bg-[#295786]/30"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <p className={`text-xs font-semibold ${
                                notifStatus === "en_curso"
                                  ? "text-red-700 dark:text-red-400"
                                  : notifStatus === "proximo_inmediato"
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-[#295786] dark:text-slate-200"
                              }`}>
                                {notifStatus === "en_curso" ? "Evento en curso en auditorio" : notifStatus === "proximo_inmediato" ? "Comienza pronto" : "Evento proximo en auditorio"}
                              </p>
                              {notifStatus === "en_curso" && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></span>
                                  EN CURSO
                                </span>
                              )}
                              {notifStatus === "proximo_inmediato" && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"></span>
                                  PRONTO
                                </span>
                              )}
                            </div>
                            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{event.nombreEvento}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{formatDateLong(event.fechaEspecifica)}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{formatTimeAmPm(event.horaInicio)} - {formatTimeAmPm(event.horaFin)}</p>

                            <div className="mt-3">
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Encargado(s)</p>
                              {(event.assignedWorkers ?? []).length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                  {(event.assignedWorkers ?? []).map((worker) => (
                                    <div
                                      key={`${event.id}-${worker.staffId}`}
                                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                                    >
                                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#295786] text-[10px] font-bold text-white">
                                        <img
                                          src={getStaffPhotoUrl(worker.cedula)}
                                          alt={`Foto de ${worker.nombreCompleto}`}
                                          className="h-full w-full object-cover"
                                          onError={(event) => {
                                            const image = event.currentTarget;
                                            image.style.display = "none";
                                            const fallback = image.parentElement?.querySelector<HTMLElement>("[data-notification-worker-fallback='true']");
                                            fallback?.classList.remove("hidden");
                                          }}
                                          onLoad={(event) => {
                                            const image = event.currentTarget;
                                            const fallback = image.parentElement?.querySelector<HTMLElement>("[data-notification-worker-fallback='true']");
                                            fallback?.classList.add("hidden");
                                            image.style.display = "block";
                                          }}
                                        />
                                        <div data-notification-worker-fallback="true" className="hidden items-center justify-center">
                                          {getStaffInitials(worker.nombreCompleto)}
                                        </div>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{worker.nombreCompleto}</p>
                                        <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{worker.rol}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                                  No hay encargado asignado.
                                </div>
                              )}
                            </div>

                            <p className="mt-2 text-xs font-semibold text-[#295786] dark:text-slate-200">Ver auditorio</p>
                          </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        No hay eventos de auditorio en la siguiente ventana de notificaciones.
                      </div>
                    )}

                    {pendingRequests.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Solicitudes de salon pendientes</p>
                        {pendingRequests.map((request) => (
                          <button
                            key={request.id}
                            type="button"
                            onClick={() => {
                              setIsNotificationsOpen(false);
                              router.push(`/schedules?eventId=${encodeURIComponent(request.eventId)}&requestId=${encodeURIComponent(request.id)}`);
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm text-slate-700 transition hover:border-[#295786]/30 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Solicitud de {request.requestedByName}</p>
                            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{request.code} | {request.subject}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{request.day} · {request.room}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{request.start} - {request.end}</p>
                            <p className="mt-2 text-xs font-semibold text-[#295786]">Ir a la reserva</p>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {pendingRequests.length === 0 && upcomingAuditorioEvents.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Sin notificaciones por ahora.
                      </div>
                    ) : null}
                  </div>
                ) : authSession.role === "monitor" ? (
                  <div className="mt-4 space-y-3">
                    {upcomingAuditorioEvents.length > 0 ? (
                      upcomingAuditorioEvents.map((event) => {
                        const notifStatus = getNotificationStatus(event);
                        return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => {
                            setIsNotificationsOpen(false);
                            router.push("/auditorio");
                          }}
                          className={`w-full rounded-lg border bg-[#295786]/5 px-3 py-3 text-left text-sm text-slate-700 transition dark:text-slate-100 ${
                            notifStatus === "en_curso"
                              ? "evento-en-curso border-red-500 dark:border-red-500"
                              : notifStatus === "proximo_inmediato"
                                ? "evento-proximo-inmediato border-amber-600 dark:border-amber-500"
                                : "border-[#295786]/20 hover:border-[#295786]/40 hover:bg-[#295786]/10 dark:border-[#295786]/40 dark:bg-[#295786]/20 dark:hover:bg-[#295786]/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <p className={`text-xs font-semibold ${
                              notifStatus === "en_curso"
                                ? "text-red-700 dark:text-red-400"
                                : notifStatus === "proximo_inmediato"
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-[#295786] dark:text-slate-200"
                            }`}>
                              {notifStatus === "en_curso" ? "Evento en curso en auditorio" : notifStatus === "proximo_inmediato" ? "Comienza pronto" : "Evento proximo en auditorio"}
                            </p>
                            {notifStatus === "en_curso" && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></span>
                                EN CURSO
                              </span>
                            )}
                            {notifStatus === "proximo_inmediato" && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"></span>
                                PRONTO
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-semibold text-slate-900 dark:text-white">{event.nombreEvento}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{formatDateLong(event.fechaEspecifica)}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{formatTimeAmPm(event.horaInicio)} - {formatTimeAmPm(event.horaFin)}</p>

                          <div className="mt-3">
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Encargado(s)</p>
                            {(event.assignedWorkers ?? []).length > 0 ? (
                              <div className="grid grid-cols-2 gap-2">
                                {(event.assignedWorkers ?? []).map((worker) => (
                                  <div
                                    key={`${event.id}-${worker.staffId}`}
                                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                                  >
                                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#295786] text-[10px] font-bold text-white">
                                      <img
                                        src={getStaffPhotoUrl(worker.cedula)}
                                        alt={`Foto de ${worker.nombreCompleto}`}
                                        className="h-full w-full object-cover"
                                        onError={(event) => {
                                          const image = event.currentTarget;
                                          image.style.display = "none";
                                          const fallback = image.parentElement?.querySelector<HTMLElement>("[data-notification-worker-fallback='true']");
                                          fallback?.classList.remove("hidden");
                                        }}
                                        onLoad={(event) => {
                                          const image = event.currentTarget;
                                          const fallback = image.parentElement?.querySelector<HTMLElement>("[data-notification-worker-fallback='true']");
                                          fallback?.classList.add("hidden");
                                          image.style.display = "block";
                                        }}
                                      />
                                      <div data-notification-worker-fallback="true" className="hidden items-center justify-center">
                                        {getStaffInitials(worker.nombreCompleto)}
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{worker.nombreCompleto}</p>
                                      <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{worker.rol}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                                No hay encargado asignado.
                              </div>
                            )}
                          </div>

                          <p className="mt-2 text-xs font-semibold text-[#295786] dark:text-slate-200">Ver auditorio</p>
                        </button>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Sin notificaciones por ahora. Aquí verás los eventos de auditorio de las próximas horas.
                      </div>
                    )}
                  </div>
                ) : authSession.role === "colaborador" ? (
                  <div className="mt-4 space-y-3">
                    {upcomingAuditorioEvents.length > 0 ? (
                      upcomingAuditorioEvents.map((event) => {
                        const notifStatus = getNotificationStatus(event);
                        const isExpanded = expandedCollaboratorNotificationId === event.id;

                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => {
                              setExpandedCollaboratorNotificationId((current) => (current === event.id ? null : event.id));
                            }}
                            className={`w-full rounded-lg border bg-[#295786]/5 px-3 py-3 text-left text-sm text-slate-700 transition dark:text-slate-100 ${
                              notifStatus === "en_curso"
                                ? "evento-en-curso border-red-500 dark:border-red-500"
                                : notifStatus === "proximo_inmediato"
                                  ? "evento-proximo-inmediato border-amber-600 dark:border-amber-500"
                                  : "border-[#295786]/20 hover:border-[#295786]/40 hover:bg-[#295786]/10 dark:border-[#295786]/40 dark:bg-[#295786]/20 dark:hover:bg-[#295786]/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-[#295786] dark:text-slate-200">Evento asignado</p>
                              <span className="material-symbols-outlined text-sm text-slate-500 dark:text-slate-300">
                                {isExpanded ? "expand_less" : "expand_more"}
                              </span>
                            </div>

                            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{event.nombreEvento}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{formatDateLong(event.fechaEspecifica)}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">{formatTimeAmPm(event.horaInicio)} - {formatTimeAmPm(event.horaFin)}</p>

                            <div className="mt-2 flex items-center gap-2">
                              {notifStatus === "en_curso" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></span>
                                  EN CURSO
                                </span>
                              ) : notifStatus === "proximo_inmediato" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"></span>
                                  INICIA PRONTO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                  PROGRAMADO
                                </span>
                              )}
                            </div>

                            {isExpanded ? (
                              <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900/60">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Detalle del evento</p>

                                <div className="space-y-1 text-slate-700 dark:text-slate-200">
                                  <p><span className="font-semibold">Titulo:</span> {event.nombreEvento}</p>
                                  <p><span className="font-semibold">Organiza:</span> {event.organizador}</p>
                                  <p><span className="font-semibold">Duracion:</span> {getDurationInDays(event.fechaInicioPeriodo, event.fechaFinPeriodo)} dia(s)</p>
                                  <p><span className="font-semibold">Asistentes:</span> {event.numeroAsistentes ?? "No disponible"}</p>
                                  <p><span className="font-semibold">Recursos:</span> {buildResourcesLabel(event)}</p>
                                </div>

                                <div>
                                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Encargado(s)</p>
                                  {(event.assignedWorkers ?? []).length > 0 ? (
                                    <div className="space-y-2">
                                      {(event.assignedWorkers ?? []).map((worker) => (
                                        <div
                                          key={`${event.id}-${worker.staffId}`}
                                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
                                        >
                                          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#295786] text-[10px] font-bold text-white">
                                            <img
                                              src={getStaffPhotoUrl(worker.cedula)}
                                              alt={`Foto de ${worker.nombreCompleto}`}
                                              className="h-full w-full object-cover"
                                              onError={(event) => {
                                                const image = event.currentTarget;
                                                image.style.display = "none";
                                                const fallback = image.parentElement?.querySelector<HTMLElement>("[data-notification-worker-fallback='true']");
                                                fallback?.classList.remove("hidden");
                                              }}
                                              onLoad={(event) => {
                                                const image = event.currentTarget;
                                                const fallback = image.parentElement?.querySelector<HTMLElement>("[data-notification-worker-fallback='true']");
                                                fallback?.classList.add("hidden");
                                                image.style.display = "block";
                                              }}
                                            />
                                            <div data-notification-worker-fallback="true" className="hidden items-center justify-center">
                                              {getStaffInitials(worker.nombreCompleto)}
                                            </div>
                                          </div>
                                          <div className="min-w-0">
                                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{worker.nombreCompleto}</p>
                                            <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{worker.rol}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                                      No hay encargado asignado.
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Horarios</p>
                                  <div className="space-y-2">
                                    {(event.horarios ?? []).map((slot) => (
                                      <div key={slot.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                          <span className="material-symbols-outlined text-sm">calendar_month</span>
                                          <p>{formatDateShort(slot.fechaEspecifica)}</p>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                          <span className="material-symbols-outlined text-sm">schedule</span>
                                          <p>{formatTimeAmPm(slot.horaInicio)} - {formatTimeAmPm(slot.horaFin)}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <p className="text-slate-700 dark:text-slate-200">
                                    <span className="font-semibold">Observaciones:</span> {event.observaciones?.trim() ? event.observaciones : "Sin observaciones"}
                                  </p>
                                </div>
                              </div>
                            ) : null}
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Sin notificaciones por ahora. Aqui veras eventos de auditorio que te asignen.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Sin notificaciones por ahora.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
