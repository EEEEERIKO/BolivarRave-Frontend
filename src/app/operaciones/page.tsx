"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";
import { readAuthSession } from "@/lib/auth-session";

type DashboardRoomItem = {
  id: string;
  name: string;
  piso: number | null;
  capacidad: number | null;
  lastCleanAt: string | null;
  lastDamageAt: string | null;
  nextClassAt: string | null;
  nextClassLabel: string | null;
  minutesSinceLastClean: number | null;
  minutesUntilNextClass: number | null;
  priorityScore: number;
  urgency: "inmediata" | "alta" | "media" | "baja" | "limpio";
  displayState: "ocupado" | "requerido" | "recomendado" | "limpio";
  reason: string;
  cleanedByName: string | null;
  occupiedNow: boolean;
};

type DashboardStaffItem = {
  id: string;
  nombre: string;
  cedula: string;
  rol: string;
  estado: string;
  fechaCreacion: string;
  attendanceStatus: "registrado" | "no_registrado";
};

type DashboardLoanItem = {
  id: string;
  resourceType: string;
  resourceLabel: string;
  resourceContext: string | null;
  destinationRoomLabel: string | null;
  requesterName: string;
  requesterDocument: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  minutesUntilStart: number;
  minutesUntilEnd: number;
  badge: "proximo" | "vigente" | "vencido" | "alerta";
  nextAction: "desplazar" | "devolver" | "revisar";
  actionLabel: string;
};

type DashboardAlertItem = {
  id: string;
  kind: "damage" | "clean" | "staff" | "room" | "loan";
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  createdAt: string;
  roomName?: string | null;
};

type ReservationFeedLoanItem = {
  id: string;
  resourceType: string;
  resourceLabel: string;
  resourceContext: string | null;
  destinationRoomLabel: string | null;
  requesterName: string;
  requesterDocument: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
};

type DashboardResponse = {
  generatedAt: string;
  operationsStatus: {
    label: "bien" | "mal";
    message: string;
    cleanCoverage5hPercent: number;
  };
  summary: {
    rooms: number;
    immediatePriorities: number;
    activeLoans: number;
    staff: number;
    damageReports: number;
    cleanReports: number;
    cleanCoverage5hPercent: number;
    cleanedRoomsLast5h: number;
  };
  topCleanTasks: DashboardRoomItem[];
  urgentRooms: DashboardRoomItem[];
  staff: DashboardStaffItem[];
  activeLoans: DashboardLoanItem[];
  roomReports: Array<{
    id: string;
    roomName: string;
    actionType: string;
    note: string | null;
    createdAt: string;
    createdByName: string | null;
    createdByRole: string | null;
  }>;
  alerts: DashboardAlertItem[];
};

type StaffJornadaBulkItem = {
  id: string;
  staffId: string;
  diaSemana: string;
  horaEntrada: string;
  horaSalida: string;
  totalHorasDia: number;
};

type StaffPausaBulkItem = {
  id: string;
  staffId: string;
  diaSemana: string;
  tipoPausa: "Comida" | "Descanso";
  horaInicio: string;
  horaFin: string;
};

type StaffLiveStatus = "No registrado" | "Activo" | "Descanso" | "Comiendo" | "Inactivo";

type StaffJornadasBulkResponse = {
  jornadas: Record<string, StaffJornadaBulkItem[]>;
};

type StaffPausasBulkResponse = {
  pausas: Record<string, StaffPausaBulkItem[]>;
};

const formatTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
};

const formatRelativeMinutes = (minutes: number | null) => {
  if (minutes === null) return "SIN DATO";
  if (minutes < 60) return `${minutes} MIN`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}H ${remaining}M` : `${hours}H`;
};

const formatDateTimeShort = (value: string | null | undefined) => {
  if (!value) return "Sin hora";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
};

const formatClockTime = (value: string | null | undefined) => {
  if (!value) return "--:--";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = ((hour + 11) % 12) + 1;
  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
};

const roomDisplayClasses: Record<DashboardRoomItem["displayState"], string> = {
  ocupado: "bg-[#d5e3ff]/70 border-[#3a5f94] text-[#1A365D]",
  requerido: "bg-rose-500/10 border-rose-500/40 text-rose-700",
  recomendado: "bg-amber-400/10 border-amber-400/40 text-amber-700",
  limpio: "bg-emerald-500/10 border-emerald-500/40 text-emerald-700",
};

function getRoomDisplayState(room: DashboardRoomItem): DashboardRoomItem["displayState"] {
  if (room.displayState === "ocupado" || room.displayState === "requerido" || room.displayState === "recomendado" || room.displayState === "limpio") {
    return room.displayState;
  }

  if (room.urgency === "inmediata" || room.urgency === "alta") {
    return "requerido";
  }

  if (room.urgency === "media" || room.urgency === "baja") {
    return "recomendado";
  }

  return "limpio";
}

const roomDisplayLabel: Record<DashboardRoomItem["displayState"], string> = {
  ocupado: "ocupado",
  requerido: "requerido",
  recomendado: "recomendado",
  limpio: "limpio",
};

const containsGhostTestValue = (value: string | null | undefined) => {
  if (!value) return false;
  return value.trim().toLowerCase().includes("test");
};

const normalizeDayName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const timeToMinutes = (value: string) => {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return -1;
  }

  return hours * 60 + minutes;
};

const getBogotaCurrentMinutes = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }

  return hour * 60 + minute;
};

const getBogotaDayName = () =>
  normalizeDayName(new Date().toLocaleDateString("es-CO", { weekday: "long", timeZone: "America/Bogota" }));

const weekdayIndexByName: Record<string, number> = {
  lunes: 0,
  martes: 1,
  miercoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5,
  domingo: 6,
};

const parseLabelMinutesUntilNextClass = (label: string | null | undefined): number | null => {
  if (!label) {
    return null;
  }

  const match = label.match(/([A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    return null;
  }

  const dayName = normalizeDayName(match[1]);
  const dayIndex = weekdayIndexByName[dayName];
  if (typeof dayIndex !== "number") {
    return null;
  }

  const hourText = match[2] ?? "0";
  const minuteText = match[3] ?? "0";
  const amPm = (match[4] ?? "").toUpperCase();

  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  hour = hour % 12;
  if (amPm === "PM") {
    hour += 12;
  }

  const targetMinutes = hour * 60 + minute;
  const currentDayName = getBogotaDayName();
  const currentDayIndex = weekdayIndexByName[currentDayName];
  if (typeof currentDayIndex !== "number") {
    return null;
  }

  const currentMinutes = getBogotaCurrentMinutes();
  let dayDelta = (dayIndex - currentDayIndex + 7) % 7;

  // If label points to today's past hour, treat it as the next weekly occurrence.
  if (dayDelta === 0 && targetMinutes < currentMinutes) {
    dayDelta = 7;
  }

  return dayDelta * 24 * 60 + (targetMinutes - currentMinutes);
};

const getRoomSortMinutesUntilNextClass = (room: DashboardRoomItem): number => {
  const parsedFromLabel = parseLabelMinutesUntilNextClass(room.nextClassLabel);
  if (typeof parsedFromLabel === "number" && Number.isFinite(parsedFromLabel) && parsedFromLabel >= 0) {
    return parsedFromLabel;
  }

  if (typeof room.minutesUntilNextClass === "number" && Number.isFinite(room.minutesUntilNextClass) && room.minutesUntilNextClass >= 0) {
    return room.minutesUntilNextClass;
  }

  return Number.POSITIVE_INFINITY;
};

const staffStatusStyle: Record<Exclude<StaffLiveStatus, "Inactivo">, { textClass: string; dotClass: string; ringClass: string }> = {
  "No registrado": {
    textClass: "text-rose-700",
    dotClass: "bg-rose-500",
    ringClass: "border-rose-500",
  },
  Activo: {
    textClass: "text-emerald-600",
    dotClass: "bg-emerald-500",
    ringClass: "border-emerald-500",
  },
  Descanso: {
    textClass: "text-amber-700",
    dotClass: "bg-amber-500",
    ringClass: "border-amber-500",
  },
  Comiendo: {
    textClass: "text-orange-700",
    dotClass: "bg-orange-500",
    ringClass: "border-orange-500",
  },
};

const alertClasses: Record<DashboardAlertItem["severity"], string> = {
  danger: "border-rose-300 bg-rose-50 text-rose-800",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-sky-300 bg-sky-50 text-sky-800",
};

const DASHBOARD_REFRESH_INTERVAL_MS = 15_000;
const LIVE_SCHEDULES_REFRESH_INTERVAL_MS = 30_000;
const CLEAN_STALE_THRESHOLD_MINUTES = 5 * 60;
const CLASS_SOON_WINDOW_MINUTES = 60;

const roomDisplayPriorityOrder: Record<DashboardRoomItem["displayState"], number> = {
  requerido: 0,
  recomendado: 1,
  ocupado: 2,
  limpio: 3,
};

function getStaffPhotoUrl(cedula: string): string {
  return `/api/staff-photo/${encodeURIComponent(cedula)}`;
}

function getDirectStaffPhotoUrl(cedula: string): string {
  const normalizedCedula = (cedula ?? "").replace(/\D/g, "").trim();
  const photoId = normalizedCedula || (cedula ?? "").trim();
  return `https://bolivar-rave-staff-photos.s3.amazonaws.com/${encodeURIComponent(photoId)}.jpg`;
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

function isRoomStaleForCleaning(room: DashboardRoomItem): boolean {
  if (typeof room.minutesSinceLastClean !== "number") {
    return true;
  }

  return room.minutesSinceLastClean > CLEAN_STALE_THRESHOLD_MINUTES;
}

function isRoomClassStartingSoon(room: DashboardRoomItem): boolean {
  if (typeof room.minutesUntilNextClass !== "number") {
    return false;
  }

  return room.minutesUntilNextClass >= 0 && room.minutesUntilNextClass <= CLASS_SOON_WINDOW_MINUTES;
}

function getRoomPanelPriorityBucket(room: DashboardRoomItem): number {
  if (!isRoomStaleForCleaning(room)) {
    return 99;
  }

  if (isRoomClassStartingSoon(room)) {
    return 0;
  }

  if (room.occupiedNow) {
    return 2;
  }

  if (room.displayState === "requerido") {
    return 0;
  }

  return 1;
}

function getOperationalRoomDisplayState(room: DashboardRoomItem): DashboardRoomItem["displayState"] {
  if (!isRoomStaleForCleaning(room)) {
    return "limpio";
  }

  if (room.occupiedNow) {
    return "ocupado";
  }

  // Any stale room that is not currently occupied must be required.
  return "requerido";
}

function getLoanActionClass(loan: DashboardLoanItem) {
  if (loan.badge === "vencido") {
    return "text-rose-700 underline decoration-rose-700 decoration-2";
  }

  // Highlight displacement action 30 minutes before start.
  if (loan.nextAction === "desplazar" && loan.minutesUntilStart <= 30 && loan.minutesUntilStart >= 0) {
    return "rounded bg-rose-100 px-2 py-0.5 text-rose-700";
  }

  if (loan.badge === "alerta") {
    return "text-amber-700";
  }

  return "text-[#3a5f94]";
}

const parseLoanDateTime = (dateText: string, timeText: string) => {
  if (!dateText || !timeText) return null;
  const [yearText, monthText, dayText] = dateText.split("-");
  const [hourText, minuteText] = timeText.split(":");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
};

const getLoanBadgeFromTimes = (minutesUntilStart: number, minutesUntilEnd: number, status: string): DashboardLoanItem["badge"] => {
  const statusLower = status.trim().toLowerCase();
  if (statusLower === "reportado" || minutesUntilEnd < 0) {
    return "vencido";
  }
  if (minutesUntilStart > 0 && minutesUntilStart <= 20) {
    return "alerta";
  }
  if (minutesUntilStart > 0) {
    return "proximo";
  }
  return minutesUntilEnd <= 20 ? "alerta" : "vigente";
};

const buildLoanActionFromTimes = (loan: ReservationFeedLoanItem, minutesUntilStart: number, minutesUntilEnd: number, badge: DashboardLoanItem["badge"]) => {
  const destination = loan.destinationRoomLabel?.trim() || "destino";

  if (badge === "vencido") {
    return {
      nextAction: "devolver" as const,
      actionLabel: `DEVOLVER URGENTE · ATRASADO ${Math.abs(minutesUntilEnd)} MIN`,
    };
  }

  if (minutesUntilStart > 0) {
    return {
      nextAction: "desplazar" as const,
      actionLabel: `DESPLAZAR A ${destination.toUpperCase()} EN ${minutesUntilStart} MIN`,
    };
  }

  if (minutesUntilEnd >= 0) {
    return {
      nextAction: "devolver" as const,
      actionLabel: `DEVOLVER EN ${minutesUntilEnd} MIN`,
    };
  }

  return {
    nextAction: "revisar" as const,
    actionLabel: "REVISAR ESTADO DEL PRESTAMO",
  };
};

export default function OperacionesPage() {
  const authSession = useMemo(() => readAuthSession(), []);
  const isMonitorRegistroSupervisor = useMemo(() => {
    if (!authSession) {
      return false;
    }

    if (authSession.role !== "registro") {
      return false;
    }

    const normalizedLabel = authSession.roleLabel.trim().toLowerCase();
    const normalizedName = authSession.name.trim().toLowerCase();
    return normalizedLabel.includes("monitor") || normalizedName.includes("monitor registro");
  }, [authSession]);
  const [now, setNow] = useState(() => new Date());
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.innerWidth >= 1024;
  });
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const [autoFocusedRoomIndex, setAutoFocusedRoomIndex] = useState(0);
  const [liveJornadaByStaffId, setLiveJornadaByStaffId] = useState<Record<string, StaffJornadaBulkItem[]>>({});
  const [livePausaByStaffId, setLivePausaByStaffId] = useState<Record<string, StaffPausaBulkItem[]>>({});
  const [fallbackActiveLoans, setFallbackActiveLoans] = useState<DashboardLoanItem[]>([]);
  const [lastDashboardSyncAt, setLastDashboardSyncAt] = useState<Date | null>(null);
  const dashboardRequestInFlightRef = useRef(false);
  const liveSchedulesRequestInFlightRef = useRef(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsDesktopViewport(window.innerWidth >= 1024);
    };

    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  useEffect(() => {
    if (authSession?.role !== "admin" && authSession?.role !== "monitor" && !isMonitorRegistroSupervisor) {
      window.location.replace("/");
    }
  }, [authSession?.role, isMonitorRegistroSupervisor]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async ({ isBackground = false }: { isBackground?: boolean } = {}) => {
    if (!isDesktopViewport || dashboardRequestInFlightRef.current) {
      return;
    }

    dashboardRequestInFlightRef.current = true;

    if (!isBackground) {
      setIsLoading(true);
    }

    try {
      const response = await fetchApiJson<DashboardResponse>("/api/operaciones/dashboard", { cache: "no-store" });
      setDashboard(response);
      setError(null);
      setLastDashboardSyncAt(new Date());
    } catch (loadError) {
      setDashboard(null);
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el panel operativo");
    } finally {
      setIsLoading(false);
      dashboardRequestInFlightRef.current = false;
    }
  }, [isDesktopViewport]);

  useEffect(() => {
    if (!isDesktopViewport) {
      setDashboard(null);
      setIsLoading(false);
      setLastDashboardSyncAt(null);
      return;
    }

    void loadDashboard({ isBackground: false });

    const refreshTimer = window.setInterval(() => {
      void loadDashboard({ isBackground: true });
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    const refreshOnFocus = () => {
      void loadDashboard({ isBackground: true });
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadDashboard({ isBackground: true });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [isDesktopViewport, loadDashboard]);

  useEffect(() => {
    if (!isDesktopViewport) {
      setFallbackActiveLoans([]);
      return;
    }

    let cancelled = false;

    const loadFallbackActiveLoans = async () => {
      try {
        const response = await fetchApiJson<{ reservas?: ReservationFeedLoanItem[] }>("/api/reservas", { cache: "no-store" });
        if (cancelled) {
          return;
        }

        const nowDate = new Date();
        const loans = (response.reservas ?? [])
          .filter((reservation) => reservation.resourceType?.toLowerCase() !== "rooms")
          .filter((reservation) => {
            const status = reservation.status?.toLowerCase() ?? "";
            return !["devuelto", "reportado", "rechazada", "cancelada"].includes(status);
          })
          .map<DashboardLoanItem | null>((reservation) => {
            const start = parseLoanDateTime(reservation.bookingDate, reservation.startTime);
            const end = parseLoanDateTime(reservation.bookingDate, reservation.endTime);
            if (!start || !end) {
              return null;
            }

            const minutesUntilStart = Math.round((start.getTime() - nowDate.getTime()) / 60000);
            const minutesUntilEnd = Math.round((end.getTime() - nowDate.getTime()) / 60000);
            const badge = getLoanBadgeFromTimes(minutesUntilStart, minutesUntilEnd, reservation.status);
            const action = buildLoanActionFromTimes(reservation, minutesUntilStart, minutesUntilEnd, badge);

            return {
              id: reservation.id,
              resourceType: reservation.resourceType,
              resourceLabel: reservation.resourceLabel,
              resourceContext: reservation.resourceContext,
              destinationRoomLabel: reservation.destinationRoomLabel,
              requesterName: reservation.requesterName,
              requesterDocument: reservation.requesterDocument,
              bookingDate: reservation.bookingDate,
              startTime: reservation.startTime,
              endTime: reservation.endTime,
              status: reservation.status,
              minutesUntilStart,
              minutesUntilEnd,
              badge,
              nextAction: action.nextAction,
              actionLabel: action.actionLabel,
            };
          })
          .filter((loan): loan is DashboardLoanItem => loan !== null)
          .sort((left, right) => left.minutesUntilStart - right.minutesUntilStart)
          .slice(0, 20);

        setFallbackActiveLoans(loans);
      } catch {
        if (!cancelled) {
          setFallbackActiveLoans([]);
        }
      }
    };

    void loadFallbackActiveLoans();

    const refreshTimer = window.setInterval(() => {
      void loadFallbackActiveLoans();
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [isDesktopViewport]);

  const summary = dashboard?.summary;
  const operationsStatus = dashboard?.operationsStatus;
  const cleanTasks = useMemo(() => {
    const source = dashboard?.topCleanTasks ?? [];
    const sortedByRecentClean = [...source].sort((left, right) => {
      const leftDate = left.lastCleanAt ? new Date(left.lastCleanAt).getTime() : 0;
      const rightDate = right.lastCleanAt ? new Date(right.lastCleanAt).getTime() : 0;
      return rightDate - leftDate;
    });

    // Remove repeated rows with the exact same room and clean timestamp.
    const uniqueRows = sortedByRecentClean.filter((item, index, all) => {
      const duplicateIndex = all.findIndex((candidate) => candidate.id === item.id && candidate.lastCleanAt === item.lastCleanAt);
      return duplicateIndex === index;
    });

    return uniqueRows.slice(0, 3);
  }, [dashboard?.topCleanTasks]);
  const urgentRooms = useMemo(() => {
    const rooms = dashboard?.urgentRooms ?? [];

    return [...rooms]
      .filter((room) => isRoomStaleForCleaning(room))
      .sort((left, right) => {
        // 1) Never-cleaned or older-cleaned rooms first.
        const leftSince = typeof left.minutesSinceLastClean === "number" ? left.minutesSinceLastClean : Number.POSITIVE_INFINITY;
        const rightSince = typeof right.minutesSinceLastClean === "number" ? right.minutesSinceLastClean : Number.POSITIVE_INFINITY;
        if (leftSince !== rightSince) {
          return rightSince - leftSince;
        }

        // 2) If cleaning age is tied, prioritize rooms with the nearest upcoming class.
        const leftMinutes = getRoomSortMinutesUntilNextClass(left);
        const rightMinutes = getRoomSortMinutesUntilNextClass(right);
        if (leftMinutes !== rightMinutes) {
          return leftMinutes - rightMinutes;
        }

        // 3) Keep occupied rooms behind non-occupied rooms when ties remain.
        if (left.occupiedNow !== right.occupiedNow) {
          return left.occupiedNow ? 1 : -1;
        }

        return right.priorityScore - left.priorityScore;
      })
      .slice(0, 6);
  }, [dashboard?.urgentRooms]);
  const roomReports = useMemo(() => {
    const reports = dashboard?.roomReports ?? [];
    return [...reports]
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 4);
  }, [dashboard?.roomReports]);
  const rawStaff = dashboard?.staff ?? [];
  const activeLoans = useMemo(() => {
    const source = fallbackActiveLoans.length > 0 ? fallbackActiveLoans : (dashboard?.activeLoans ?? []);

    return [...source]
      .sort((left, right) => left.minutesUntilStart - right.minutesUntilStart)
      .slice(0, 20);
  }, [dashboard?.activeLoans, fallbackActiveLoans]);
  const normalizedAlerts = (dashboard?.alerts ?? [])
    .filter((alert) => !containsGhostTestValue(alert.title) && !containsGhostTestValue(alert.message))
    .filter((alert) => !alert.title.toLowerCase().includes("nuevo personal registrado"));
  const missingCheckinAlerts = normalizedAlerts
    .filter((alert) => alert.title.toLowerCase().includes("falta registro de ingreso"))
    .slice(0, 4);
  const remainingAlerts = normalizedAlerts
    .filter((alert) => !alert.title.toLowerCase().includes("falta registro de ingreso"));
  const alerts = [...missingCheckinAlerts, ...remainingAlerts].slice(0, 8);

  const rawStaffIds = useMemo(
    () => rawStaff.map((person) => person.id).sort().join("|"),
    [rawStaff]
  );

  const loadLiveSchedules = useCallback(async () => {
    if (!isDesktopViewport || rawStaff.length === 0 || liveSchedulesRequestInFlightRef.current) {
      return;
    }

    liveSchedulesRequestInFlightRef.current = true;

    try {
      const [jornadasResponse, pausasResponse] = await Promise.all([
        fetchApiJson<StaffJornadasBulkResponse>("/api/staff/jornadas-bulk", { cache: "no-store" }).catch(() => ({ jornadas: {} })),
        fetchApiJson<StaffPausasBulkResponse>("/api/staff/pausas-bulk", { cache: "no-store" }).catch(() => ({ pausas: {} })),
      ]);

      setLiveJornadaByStaffId(jornadasResponse.jornadas ?? {});
      setLivePausaByStaffId(pausasResponse.pausas ?? {});
    } catch {
      setLiveJornadaByStaffId({});
      setLivePausaByStaffId({});
    } finally {
      liveSchedulesRequestInFlightRef.current = false;
    }
  }, [isDesktopViewport, rawStaff.length]);

  useEffect(() => {
    if (!isDesktopViewport || rawStaff.length === 0) {
      setLiveJornadaByStaffId((current) => (Object.keys(current).length === 0 ? current : {}));
      setLivePausaByStaffId((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    void loadLiveSchedules();

    const refreshTimer = window.setInterval(() => {
      void loadLiveSchedules();
    }, LIVE_SCHEDULES_REFRESH_INTERVAL_MS);

    const refreshOnFocus = () => {
      void loadLiveSchedules();
    };

    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadLiveSchedules();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, [isDesktopViewport, loadLiveSchedules, rawStaffIds, rawStaff.length]);

  const liveStatusByStaffId = useMemo(() => {
    const statusMap: Record<string, StaffLiveStatus> = {};
    const todayKey = getBogotaDayName();
    const currentMinutes = getBogotaCurrentMinutes();

    for (const person of rawStaff) {
      const jornadas = liveJornadaByStaffId[person.id] ?? [];
      const pausas = livePausaByStaffId[person.id] ?? [];

      const jornadasToday = jornadas
        .filter((row) => normalizeDayName(row.diaSemana) === todayKey)
        .map((row) => ({ start: timeToMinutes(row.horaEntrada), end: timeToMinutes(row.horaSalida) }))
        .filter((row) => row.start >= 0 && row.end > row.start);

      if (jornadasToday.length === 0) {
        statusMap[person.id] = "Inactivo";
        continue;
      }

      const isWithinJornada = jornadasToday.some((row) => currentMinutes >= row.start && currentMinutes < row.end);
      if (!isWithinJornada) {
        statusMap[person.id] = "Inactivo";
        continue;
      }

      const pausesToday = pausas
        .filter((row) => normalizeDayName(row.diaSemana) === todayKey)
        .map((row) => ({ start: timeToMinutes(row.horaInicio), end: timeToMinutes(row.horaFin), tipo: row.tipoPausa }))
        .filter((row) => row.start >= 0 && row.end > row.start);

      const activePause = pausesToday.find((row) => currentMinutes >= row.start && currentMinutes < row.end);
      if (activePause) {
        statusMap[person.id] = activePause.tipo === "Comida" ? "Comiendo" : "Descanso";
        continue;
      }

      statusMap[person.id] = person.attendanceStatus === "registrado" ? "Activo" : "No registrado";
    }

    return statusMap;
  }, [rawStaff, liveJornadaByStaffId, livePausaByStaffId]);

  const staff = useMemo(() => {
    const hasLiveData = Object.keys(liveStatusByStaffId).length > 0;

    if (hasLiveData) {
      return rawStaff.filter((person) => {
        const status = liveStatusByStaffId[person.id] ?? "Inactivo";
        return status !== "Inactivo";
      });
    }

    return rawStaff;
  }, [rawStaff, liveStatusByStaffId]);

  const immediateActions = useMemo(() => {
    return activeLoans
      .filter((loan) => {
        if (loan.badge === "vencido") return true;
        if (loan.nextAction === "desplazar" && loan.minutesUntilStart <= 90) return true;
        if (loan.badge === "alerta") return true;
        return false;
      })
      .slice(0, 3)
      .map((loan) => {
        const origin = loan.resourceContext?.trim() || "origen";
        const destination = loan.destinationRoomLabel?.trim() || "destino";

        if (loan.badge === "vencido") {
          return {
            id: loan.id,
            label: `${loan.resourceLabel} debió devolverse (fin ${formatClockTime(loan.endTime)})`,
            severity: "danger" as const,
          };
        }

        if (loan.nextAction === "desplazar") {
          return {
            id: loan.id,
            label: `${loan.resourceLabel} mover antes de ${formatClockTime(loan.startTime)} de ${origin} a ${destination}`,
            severity: loan.minutesUntilStart <= 30 ? "danger" as const : "warning" as const,
          };
        }

        return {
          id: loan.id,
          label: `${loan.resourceLabel} devolver antes de ${formatClockTime(loan.endTime)}`,
          severity: "warning" as const,
        };
      });
  }, [activeLoans]);

  const cleanCoverage5hPercent = Number(summary?.cleanCoverage5hPercent ?? operationsStatus?.cleanCoverage5hPercent ?? 0);
  const cleanedRoomsLast5h = Number(summary?.cleanedRoomsLast5h ?? 0);
  const totalRooms = Number(summary?.rooms ?? 0);
  const operationsHealthLabel = operationsStatus?.label === "bien"
    ? "Bien"
    : operationsStatus?.label === "mal"
      ? "Mal"
      : "Sin datos";
  const operationsHealthDotClass = operationsStatus?.label === "bien"
    ? "bg-emerald-500"
    : operationsStatus?.label === "mal"
      ? "bg-rose-500"
      : "bg-slate-400";
  const operationsHealthTextClass = operationsStatus?.label === "bien"
    ? "text-emerald-600"
    : operationsStatus?.label === "mal"
      ? "text-rose-600"
      : "text-slate-500";

  useEffect(() => {
    if (urgentRooms.length === 0) {
      setAutoFocusedRoomIndex(0);
      return;
    }

    setAutoFocusedRoomIndex((current) => {
      if (current < urgentRooms.length) {
        return current;
      }
      return 0;
    });
  }, [urgentRooms.length]);

  useEffect(() => {
    if (hoveredRoomId || urgentRooms.length <= 1) {
      return;
    }

    const rotationTimer = window.setInterval(() => {
      setAutoFocusedRoomIndex((current) => (current + 1) % urgentRooms.length);
    }, 5_000);

    return () => window.clearInterval(rotationTimer);
  }, [hoveredRoomId, urgentRooms.length]);

  const focusedRoom =
    urgentRooms.find((room) => room.id === hoveredRoomId) ??
    urgentRooms[autoFocusedRoomIndex] ??
    cleanTasks[0] ??
    null;

  const urgentRoomsForGrid = urgentRooms;

  const roomPriorityById = useMemo(() => {
    const priorityMap: Record<string, number> = {};
    urgentRooms.forEach((room, index) => {
      priorityMap[room.id] = index + 1;
    });
    return priorityMap;
  }, [urgentRooms]);

  const focusedRoomState = focusedRoom ? getOperationalRoomDisplayState(focusedRoom) : "limpio";

  if (!isDesktopViewport) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#f7f9fb] px-6 text-[#2a3439] sm:h-[calc(100vh-5rem)]">
        <div className="max-w-md rounded-2xl border border-[#e8eff3] bg-white p-6 text-center shadow-[0_10px_40px_rgba(42,52,57,0.08)]">
          <h1 className="text-lg font-black uppercase tracking-wide text-[#1A365D]">Disponible solo en PC</h1>
          <p className="mt-3 text-sm font-medium text-[#566166]">
            El Centro de Mando de Operaciones está optimizado para resoluciones de escritorio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] flex-col overflow-hidden bg-[#f7f9fb] text-[#2a3439]">
      <style jsx global>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .status-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        .ticker-container {
          overflow: hidden;
          white-space: nowrap;
        }
        .ticker-text {
          display: inline-block;
          padding-left: 100%;
          animation: ticker 42s linear infinite;
        }
        @keyframes ticker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        .auto-scroll-track {
          display: inline-flex;
          min-width: max-content;
          animation: auto-scroll-left 48s linear infinite;
          gap: 12px;
        }
        @keyframes auto-scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <header className="z-30 flex items-center justify-between border-b border-[#e1e9ee] bg-[#f7f9fb] px-6 py-3">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-3xl font-extrabold leading-none tracking-tighter text-[#1A365D] xl:text-4xl">
              {now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#566166] xl:text-xs">
              {now.toLocaleDateString("es-CO", { weekday: "long", day: "2-digit", month: "long" })}
            </span>
          </div>
          <div className="h-10 w-px bg-[#a9b4b9]/30" />
          <div className="flex flex-col">
            <h1 className="text-base font-bold uppercase tracking-tight text-[#1A365D] xl:text-lg">
              Edificio Bolívar | <span className="font-black text-[#3a5f94]">Centro de Mando de Operaciones de Limpieza</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className={`status-pulse h-2 w-2 rounded-full ${operationsHealthDotClass}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${operationsHealthTextClass}`}>
                Operaciones: {operationsHealthLabel}
              </span>
            </div>
            {!isLoading && operationsStatus ? (
              <span className={`text-[9px] font-bold uppercase tracking-[0.14em] ${operationsStatus.label === "bien" ? "text-emerald-700" : "text-rose-700"}`}>
                {operationsStatus.message}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="border-r border-[#e8eff3] pr-6 text-right">
            <span className="block text-[9px] font-bold uppercase tracking-[0.22em] text-[#566166]">Limpios Ult. 5h</span>
            <span className="text-xl font-black text-[#1A365D]">{summary ? `${cleanCoverage5hPercent}%` : "--%"}</span>
            <span className="block text-[8px] font-bold uppercase tracking-[0.18em] text-[#566166]">
              {summary ? `${cleanedRoomsLast5h}/${totalRooms} salones` : "Sin datos"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d5e3ff]/70">
              <span className="material-symbols-outlined text-[#3a5f94]">monitor</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] leading-tight text-[#566166]">
              Modo de Monitoreo
              <br />
            Activo
            </span>
          </div>
          <div className="border-l border-[#e8eff3] pl-4 text-right">
            <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#566166]">Actualizado</span>
            <span className="text-[11px] font-black text-[#1A365D]">{lastDashboardSyncAt ? formatTime(lastDashboardSyncAt.toISOString()) : "--:--"}</span>
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-12 grid-rows-6 gap-4 overflow-hidden px-4 py-3">
        <section className="col-span-3 row-span-4 flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-[0_10px_40px_rgba(42,52,57,0.04)]">
          <div className="flex items-center justify-between border-b border-[#e8eff3] px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-[#566166]">Tareas de Limpieza Activas</h2>
            <span className="rounded bg-[#d5e3ff] px-2 py-1 text-[10px] font-bold text-[#2c5287]">{summary ? `${summary.cleanReports} REGISTROS` : "Cargando"}</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
            {cleanTasks.length > 0 ? (
              cleanTasks.map((room) => (
                <div key={room.id} className="rounded-xl border-l-4 border-[#3a5f94] bg-[#f0f4f7] p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black leading-none text-[#1A365D]">{room.name}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#3a5f94]">
                        Limpieza completa • {room.cleanedByName?.trim() ? room.cleanedByName : "Monitoreo"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-black uppercase text-[#3a5f94]">Última limpieza</span>
                      <span className="text-[9px] font-bold uppercase text-[#566166]">{formatDateTimeShort(room.lastCleanAt)}</span>
                    </div>
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {[
                      room.reason.includes("daño") ? "Revisar daño" : "Barrer",
                      "Trapear",
                      "Organizar sillas",
                      "Limpiar pizarra",
                    ].map((chip) => (
                      <span key={chip} className="rounded-sm border border-[#a9b4b9]/20 bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#566166]">{chip}</span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label="No hay limpiezas recientes" />
            )}
          </div>
        </section>

        <section className="col-span-6 row-span-4 flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
          <div className="flex items-start justify-between border-b border-[#e8eff3] px-5 py-3">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-[#1A365D]">Salones sin aseo</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#566166]">Prioridad por tiempo sin limpiar; clase en 1h y ocupados al final</p>
            </div>
            <div className="flex max-w-[280px] flex-wrap justify-end gap-x-3 gap-y-1.5">
              <LegendDot label="Recomendado" color="bg-amber-400" />
              <LegendDot label="Requerido" color="bg-rose-500" />
              <LegendDot label="Ocupado" color="bg-[#3a5f94]" />
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#f0f4f7] p-3">
            <div className="grid h-full w-full grid-cols-3 grid-rows-2 gap-3">
              {urgentRoomsForGrid.map((room) => (
                <RoomTile
                  key={room.id}
                  room={room}
                  priorityRank={roomPriorityById[room.id]}
                  highlight={focusedRoom?.id === room.id}
                  onHover={() => setHoveredRoomId(room.id)}
                  onLeave={() => setHoveredRoomId(null)}
                />
              ))}
            </div>

            <div className="pointer-events-none absolute inset-3 grid grid-cols-3 grid-rows-2 gap-3">
              {urgentRoomsForGrid.map((room) => (
                <div key={`overlay-${room.id}`} className="relative">
                  {focusedRoom?.id === room.id ? (
                    <div className="absolute bottom-1 right-1 z-20 w-52 rounded-lg border border-[#e8eff3] bg-white/95 p-2.5 shadow-2xl">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                        <h4 className="text-[10px] font-black uppercase text-[#1A365D]">Enfoque: {focusedRoom.name}</h4>
                      </div>
                      <div className="space-y-1.5">
                        <KeyValue label="Estado" value={roomDisplayLabel[focusedRoomState].toUpperCase()} />
                        <KeyValue label="Última" value={focusedRoom.lastCleanAt ? formatTime(focusedRoom.lastCleanAt) : "SIN DATO"} />
                        <KeyValue label="Encargado" value={focusedRoom.cleanedByName?.trim() ? focusedRoom.cleanedByName : "MONITOREO"} />
                        <KeyValue label="Próxima" value={focusedRoom.nextClassLabel ?? "SIN DATO"} accent="text-rose-600" />
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="col-span-3 row-span-4 flex min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-[0_10px_40px_rgba(42,52,57,0.04)]">
          <div className="flex items-center justify-between border-b border-[#e8eff3] px-5 py-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-[#566166]">Reportes de Salones</h3>
            <span className="material-symbols-outlined text-lg text-[#3a5f94]">assignment</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
            {roomReports.length > 0 ? (
              roomReports.map((report) => (
                <div key={report.id} className="flex gap-3 rounded-xl bg-white p-2.5">
                  <div className="flex min-w-[50px] flex-col items-center rounded bg-rose-50 px-2 py-1 text-rose-700">
                    <span className="text-[9px] font-black leading-none">{report.createdAt ? formatTime(report.createdAt) : "--:--"}</span>
                    <span className="text-[8px] font-bold uppercase">hora</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <p className="truncate text-xs font-extrabold text-[#1A365D]">{report.roomName}</p>
                    </div>
                    <p className="truncate text-[10px] font-bold text-[#566166]">{report.note ?? "Daño reportado"}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState label="No hay reportes" />
            )}
          </div>
        </section>

        <section className="col-span-12 row-span-1 flex min-h-0 items-center overflow-hidden rounded-xl bg-white px-4 shadow-[0_10px_40px_rgba(42,52,57,0.04)]">
          <h2 className="mr-4 shrink-0 border-r border-[#e8eff3] pr-4 text-xs font-bold uppercase tracking-[0.24em] text-[#566166]">Personal</h2>
          <AutoScrollStrip
            items={staff}
            render={(person) => {
              const status = liveStatusByStaffId[person.id] ?? (person.attendanceStatus === "registrado" ? "Activo" : "No registrado");
              const style = staffStatusStyle[status as Exclude<StaffLiveStatus, "Inactivo">] ?? staffStatusStyle.Activo;

              return (
              <div key={person.id} className="flex shrink-0 items-center gap-3 rounded-lg bg-[#f0f4f7] px-3 py-2">
                <div className={`relative h-9 w-9 rounded-full border-2 p-0.5 ${style.ringClass}`}>
                  <img
                    src={getStaffPhotoUrl(person.cedula)}
                    alt={`Foto de ${person.nombre}`}
                    className="h-full w-full rounded-full object-cover"
                    onError={(event) => {
                      const image = event.currentTarget;
                      const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");

                      if (!image.dataset.directTried) {
                        image.dataset.directTried = "true";
                        image.src = getDirectStaffPhotoUrl(person.cedula);
                        return;
                      }

                      image.style.display = "none";
                      fallback?.classList.remove("hidden");
                    }}
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                      fallback?.classList.add("hidden");
                      image.style.display = "block";
                    }}
                  />
                  <div
                    data-staff-photo-fallback="true"
                    className="hidden h-full w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#d5e3ff,#f0f4f7)] text-[10px] font-black text-[#1A365D]"
                  >
                    {getStaffInitials(person.nombre)}
                  </div>
                  <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${style.dotClass}`} />
                </div>
                <div>
                  <p className="text-xs font-black leading-tight text-[#1A365D]">{person.nombre}</p>
                  <p className={`text-[8px] font-bold uppercase ${style.textClass}`}>
                    {person.rol} • {status.toUpperCase()}
                  </p>
                </div>
              </div>
            );
            }}
            emptyLabel="Sin personal"
          />
        </section>

        <section className="col-span-12 row-span-1 flex min-h-0 items-center overflow-hidden rounded-xl bg-white px-4 shadow-[0_10px_40px_rgba(42,52,57,0.04)]">
          <div className="mr-4 flex shrink-0 items-center gap-3 border-r border-[#e8eff3] pr-4">
            <span className="material-symbols-outlined text-[#3a5f94]">inventory_2</span>
            <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-[#566166]">Préstamos Activos</h2>
          </div>

          <AutoScrollStrip
            items={activeLoans}
            render={(loan) => (
              <div key={loan.id} className="flex shrink-0 items-center gap-3 rounded-lg bg-[#f0f4f7] px-3 py-2">
                <div className="rounded bg-[#d5e3ff]/70 p-1.5">
                  <span className="material-symbols-outlined text-sm text-[#3a5f94]">{loan.resourceType === "televisor" ? "tv" : "videocam"}</span>
                </div>
                <div>
                  <p className="text-xs font-black text-[#1A365D]">{loan.resourceLabel}</p>
                  <p className={`text-[10px] font-bold uppercase ${getLoanActionClass(loan)}`}>{loan.actionLabel}</p>
                </div>
              </div>
            )}
            emptyLabel="Sin préstamos activos"
          />

          <div className="ml-auto text-right">
            <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-[#566166]">Total Equipos</span>
            <span className="text-xl font-black text-[#1A365D]">{activeLoans.length}</span>
          </div>
        </section>
      </main>

      <div className="flex items-center justify-between border-y border-[#9f403d] bg-[#9f403d] px-5 py-2 text-white">
        <div className="flex shrink-0 items-center gap-3 border-r border-white/20 pr-4">
          <span className="material-symbols-outlined text-lg text-white">priority_high</span>
          <h3 className="text-xs font-black uppercase tracking-[0.24em] whitespace-nowrap">Prioridades Inmediatas</h3>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-8 overflow-hidden px-4 text-center">
          {immediateActions.map((item) => (
            <div key={item.id} className="flex shrink-0 items-center gap-3">
              <p className="text-sm font-black tracking-tight">{item.label}</p>
              <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${item.severity === "danger" ? "bg-rose-200/40" : "bg-white/20"}`}>
                {item.severity === "danger" ? "urgente" : "atencion"}
              </span>
            </div>
          ))}
          {immediateActions.length === 0 ? <span className="text-sm font-black tracking-tight opacity-80">Sin prioridades en este momento</span> : null}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold opacity-90">
          <span className="material-symbols-outlined text-sm">notification_important</span>
          <span>Actualización en tiempo real</span>
        </div>
      </div>

      <footer className="relative z-20 flex h-14 items-center overflow-hidden bg-[#1A365D]">
        <div className="z-20 flex h-full items-center bg-[#9f403d] px-5 shadow-xl">
          <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>campaign</span>
          <span className="ml-2 text-xs font-bold uppercase tracking-widest text-white">Alertas de Operaciones</span>
        </div>

        <div className="ticker-container flex-1 bg-black/20">
          <div className="ticker-text flex items-center gap-4 py-2 pl-6">
            {(alerts.length > 0 ? alerts : fallbackTickerItems).map((alert, index) => (
              <span key={`${alert.id}-${index}`} className={`inline-flex max-w-[280px] shrink-0 truncate rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${alert.severity === "danger" ? "bg-rose-600/40 text-white" : "bg-white/10 text-blue-100"}`}>
                {alert.title}
              </span>
            ))}
          </div>
        </div>

        <div className="px-5 text-[10px] font-semibold uppercase tracking-widest text-white/70">© {now.getFullYear()} Infraestructura Académica</div>
      </footer>

      {error ? <div className="fixed left-4 top-4 z-[60] rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 shadow-lg">{error}</div> : null}
    </div>
  );
}

const fallbackTickerItems: DashboardAlertItem[] = [
  {
    id: "fallback-1",
    kind: "room",
    severity: "warning",
    title: "Limpieza prioritaria",
    message: "Sin datos cargados todavía",
    createdAt: new Date().toISOString(),
  },
];

function AutoScrollStrip<T>({
  items,
  render,
  emptyLabel,
}: {
  items: T[];
  render: (item: T) => React.ReactNode;
  emptyLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    const measureOverflow = () => {
      const container = containerRef.current;
      const track = trackRef.current;

      if (!container || !track) {
        setShouldAnimate(false);
        return;
      }

      const hasOverflow = track.scrollWidth > container.clientWidth + 1;
      setShouldAnimate(hasOverflow);
    };

    measureOverflow();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => measureOverflow());
      if (containerRef.current) observer.observe(containerRef.current);
      if (trackRef.current) observer.observe(trackRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measureOverflow);
    return () => window.removeEventListener("resize", measureOverflow);
  }, [items]);

  if (items.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  const displayItems = shouldAnimate ? [...items, ...items] : items;

  return (
    <div ref={containerRef} className="min-w-0 flex-1 overflow-hidden">
      <div
        ref={trackRef}
        className={shouldAnimate ? "auto-scroll-track" : "inline-flex min-w-max gap-3"}
      >
        {displayItems.map((item, index) => (
          <div key={index}>{render(item)}</div>
        ))}
      </div>
    </div>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#566166]">{label}</span>
    </div>
  );
}

function KeyValue({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[10px] font-bold text-[#566166]">{label}</span>
      <span className={`text-[10px] font-black uppercase ${accent ?? "text-[#2a3439]"}`}>{value}</span>
    </div>
  );
}

function RoomTile({
  room,
  priorityRank,
  highlight,
  onHover,
  onLeave,
}: {
  room: DashboardRoomItem;
  priorityRank?: number;
  highlight?: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const displayState = getOperationalRoomDisplayState(room);
  const statusClass = roomDisplayClasses[displayState];

  return (
    <div
      className={`relative cursor-pointer rounded-xl border-2 p-2 text-center transition-all duration-200 ${statusClass} ${highlight ? "ring-2 ring-[#3a5f94] ring-offset-2" : ""}`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <span className="absolute right-1.5 top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1A365D] px-1 text-[9px] font-black text-white">
        {priorityRank ?? "-"}
      </span>
      <div className="flex h-full flex-col items-center justify-center">
        <span className="text-[10px] font-black uppercase leading-tight text-[#1A365D]">{room.name}</span>
        <span className="text-[8px] font-bold uppercase">{roomDisplayLabel[displayState]}</span>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d9e4ea] bg-white/70 px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#a9b4b9]">
      {label}
    </div>
  );
}
