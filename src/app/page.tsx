"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchApiJson } from "@/lib/api-client";

type ScheduleItem = {
  id: string;
  classId: string;
  subject: string;
  professor: string;
  room: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday";
  dayEs: string;
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  faculty: string;
  code: string;
};

type ApiScheduleEvent = {
  id: string;
  classId?: string;
  day: string;
  room: string;
  start: string;
  end: string;
  faculty: string;
  code: string;
  subject: string;
  teacher: string;
  startDate: string;
  endDate: string;
};

type ScheduleEventsResponse = {
  events?: ApiScheduleEvent[];
};

type RoomsResponse = {
  rooms?: string[];
};

type ImportHistoryItem = {
  id: string;
  imported_at: string;
  source_file: string;
  conflicts_detected: number;
  conflicts_accepted: number;
  conflicts_rejected: number;
  status: string;
};

type ImportsHistoryResponse = {
  imports?: ImportHistoryItem[];
};

type RoomsInfoSchedule = {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
};

type RoomsInfoRoom = {
  id: string;
  nombre: string;
  piso: number | null;
  horarios: RoomsInfoSchedule[];
};

type RoomsInfoResponse = {
  success?: boolean;
  roomsByFloor?: RoomsInfoRoom[][];
};

type DashboardCachePayload = {
  savedAt: number;
  scheduleItems: ScheduleItem[];
  importsHistory: ImportHistoryItem[];
  roomsCatalog: string[];
  roomsByFloor: Array<{ floor: number; rooms: RoomsInfoRoom[] }>;
};

const mergeRoomsByFloor = (floors: Array<{ floor: number; rooms: RoomsInfoRoom[] }>) =>
  floors
    .map((entry) => {
      const roomsById = new Map<string, RoomsInfoRoom>();

      for (const room of entry.rooms) {
        const existing = roomsById.get(room.id);
        if (!existing) {
          roomsById.set(room.id, {
            ...room,
            horarios: [...room.horarios],
          });
          continue;
        }

        const scheduleKeys = new Set(
          existing.horarios.map((slot) => `${slot.diaSemana}|${slot.horaInicio}|${slot.horaFin}`)
        );

        for (const slot of room.horarios) {
          const slotKey = `${slot.diaSemana}|${slot.horaInicio}|${slot.horaFin}`;
          if (scheduleKeys.has(slotKey)) continue;
          scheduleKeys.add(slotKey);
          existing.horarios.push(slot);
        }
      }

      return {
        floor: entry.floor,
        rooms: Array.from(roomsById.values()),
      };
    })
    .sort((a, b) => a.floor - b.floor);

const DAY_COLORS: Record<ScheduleItem["day"], string> = {
  Monday: "#295786",
  Tuesday: "#1f8f6a",
  Wednesday: "#c7801d",
  Thursday: "#7c4d9e",
  Friday: "#cd3f3f",
};

const DAY_LABELS: Record<ScheduleItem["day"], string> = {
  Monday: "Lun",
  Tuesday: "Mar",
  Wednesday: "Mié",
  Thursday: "Jue",
  Friday: "Vie",
};

const ALL_DAYS: ScheduleItem["day"][] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOURS = Array.from({ length: 17 }, (_, idx) => 6 + idx);
const OCCUPANCY_CHART_Y_AXIS_WIDTH = 30;
const OCCUPANCY_CHART_RIGHT_MARGIN = 8;
const TIME_OPTIONS = Array.from({ length: 33 }, (_, idx) => {
  const totalMinutes = 6 * 60 + idx * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

const toAmPmLabel = (value: string) => {
  const [h, m] = value.split(":");
  const hour = Number(h);
  const minute = Number(m);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}:${String(minute).padStart(2, "0")} ${suffix}`;
};
const DASHBOARD_CACHE_KEY = "dashboard_cache_v1";
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

let inMemoryDashboardCache: DashboardCachePayload | null = null;

const DAY_ES_TO_EN: Record<string, ScheduleItem["day"]> = {
  lunes: "Monday",
  martes: "Tuesday",
  miercoles: "Wednesday",
  miércoles: "Wednesday",
  jueves: "Thursday",
  viernes: "Friday",
};

const DAY_EN_TO_ES: Record<ScheduleItem["day"], string> = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
};

const FLOOR_ONE_ALLOWED = new Set([
  "aula foro union 101",
  "aula foro unac 102",
  "sala informatica 1 bolivar",
  "sala informatica 2 bolivar",
]);

const EXCLUDED_EXACT_ROOM_NAMES = new Set<string>();

const EXCLUDED_NORMALIZED_ROOM_NAMES = new Set([
  "salon 200",
  "salon academia de musica 200",
  "salon 205 - sillas",
  "salon 206 - sillas",
  "salon 305",
  "laboratorio de simulacion financiera 403",
  "501",
  "502",
  "503",
  "503 - p",
]);

const normalizeRoomName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const extractRoomNumber = (roomName: string) => {
  const match = roomName.match(/(\d{3})/);
  return match?.[1] ? parseInt(match[1], 10) : 9999;
};

const getEffectiveFloor = (room: { nombre: string; piso: number | null }) => {
  const roomNumber = extractRoomNumber(room.nombre);
  if (roomNumber !== 9999) {
    const floorFromNumber = Math.floor(roomNumber / 100);
    if (floorFromNumber > 0) return floorFromNumber;
  }
  return room.piso;
};

const isRoomVisible = (room: { nombre: string; piso: number | null }) => {
  const effectiveFloor = getEffectiveFloor(room);
  if (effectiveFloor === null) return false;
  if (EXCLUDED_EXACT_ROOM_NAMES.has(room.nombre.trim())) return false;

  const normalized = normalizeRoomName(room.nombre);
  if (EXCLUDED_NORMALIZED_ROOM_NAMES.has(normalized)) return false;

  if (effectiveFloor === 1) {
    return FLOOR_ONE_ALLOWED.has(normalized);
  }

  const roomNumber = extractRoomNumber(room.nombre);
  if (roomNumber === 9999) return false;
  return Math.floor(roomNumber / 100) === effectiveFloor;
};

const toMinutes = (time: string) => {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
};

const isDashboardCacheFresh = (payload: DashboardCachePayload) => Date.now() - payload.savedAt <= DASHBOARD_CACHE_TTL_MS;

const readDashboardCache = (): DashboardCachePayload | null => {
  if (inMemoryDashboardCache && isDashboardCacheFresh(inMemoryDashboardCache)) {
    return inMemoryDashboardCache;
  }

  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DashboardCachePayload;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed.scheduleItems) ||
      !Array.isArray(parsed.importsHistory) ||
      !Array.isArray(parsed.roomsCatalog) ||
      !Array.isArray(parsed.roomsByFloor)
    ) {
      return null;
    }

    if (!isDashboardCacheFresh(parsed)) {
      window.sessionStorage.removeItem(DASHBOARD_CACHE_KEY);
      return null;
    }

    inMemoryDashboardCache = parsed;
    return parsed;
  } catch {
    return null;
  }
};

const writeDashboardCache = (payload: Omit<DashboardCachePayload, "savedAt">) => {
  const cache: DashboardCachePayload = {
    ...payload,
    savedAt: Date.now(),
  };

  inMemoryDashboardCache = cache;

  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures and keep runtime cache only.
  }
};

const parseScheduleClockToMinutes = (value: string) => {
  const text = value.trim();

  const isoTime = text.match(/T(\d{2}):(\d{2})/);
  if (isoTime?.[1] && isoTime?.[2]) {
    return Number(isoTime[1]) * 60 + Number(isoTime[2]);
  }

  const plainTime = text.match(/^(\d{2}):(\d{2})/);
  if (plainTime?.[1] && plainTime?.[2]) {
    return Number(plainTime[1]) * 60 + Number(plainTime[2]);
  }

  return null;
};

const normalizeDayValue = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

const getBogotaNow = () => {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = dateParts.find((part) => part.type === "year")?.value ?? "1970";
  const month = dateParts.find((part) => part.type === "month")?.value ?? "01";
  const day = dateParts.find((part) => part.type === "day")?.value ?? "01";

  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(new Date());

  const hour = Number(timeParts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(timeParts.find((part) => part.type === "minute")?.value ?? "0");
  const weekday = timeParts.find((part) => part.type === "weekday")?.value ?? "";

  const dayEn =
    weekday === "Monday" || weekday === "Tuesday" || weekday === "Wednesday" || weekday === "Thursday" || weekday === "Friday"
      ? (weekday as ScheduleItem["day"])
      : null;

  return {
    dateIso: `${year}-${month}-${day}`,
    currentMinutes: hour * 60 + minute,
    dayEn,
  };
};

const formatRelativeTime = (isoDate: string) => {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return "unknown";
  const diffMs = Date.now() - ts;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const toDashboardEvent = (event: ApiScheduleEvent): ScheduleItem | null => {
  const normalizedDay = DAY_ES_TO_EN[event.day.toLowerCase()] ?? null;
  if (!normalizedDay) return null;

  return {
    id: event.id,
    classId: event.classId ?? event.id,
    subject: event.subject,
    professor: event.teacher,
    room: event.room,
    day: normalizedDay,
    dayEs: DAY_EN_TO_ES[normalizedDay],
    start: event.start,
    end: event.end,
    startDate: event.startDate,
    endDate: event.endDate,
    faculty: event.faculty,
    code: event.code,
  };
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const scoreMatch = (item: ScheduleItem, query: string) => {
  const searchable = normalizeText(`${item.subject} ${item.professor} ${item.room} ${item.day} ${item.dayEs} ${item.start} ${item.end}`);
  if (!query) return 1;

  const tokens = query.split(" ").filter(Boolean);
  if (tokens.length === 0) return 1;

  let score = 0;
  for (const token of tokens) {
    if (searchable.includes(token)) score += 2;
    if (normalizeText(item.subject).includes(token)) score += 2;
    if (normalizeText(item.professor).includes(token)) score += 2;
    if (normalizeText(item.room).includes(token)) score += 1;
  }

  return score;
};

function LoadingInline({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
      {text}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const occupancyChartScrollRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [quickMode, setQuickMode] = useState<"class" | "professor" | "availableRooms">("class");
  const [roomCheckDay, setRoomCheckDay] = useState<ScheduleItem["day"]>("Monday");
  const [roomCheckStartTime, setRoomCheckStartTime] = useState("08:00");
  const [roomCheckEndTime, setRoomCheckEndTime] = useState("09:00");
  const [submittedRoomCheck, setSubmittedRoomCheck] = useState<{
    day: ScheduleItem["day"];
    startTime: string;
    endTime: string;
  } | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [importsHistory, setImportsHistory] = useState<ImportHistoryItem[]>([]);
  const [roomsCatalog, setRoomsCatalog] = useState<string[]>([]);
  const [roomsByFloor, setRoomsByFloor] = useState<Array<{ floor: number; rooms: RoomsInfoRoom[] }>>([]);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const cached = readDashboardCache();
    if (cached) {
      setScheduleItems(cached.scheduleItems);
      setImportsHistory(cached.importsHistory);
      setRoomsCatalog(cached.roomsCatalog);
      const mergedCachedFloors = mergeRoomsByFloor(cached.roomsByFloor);
      setRoomsByFloor(mergedCachedFloors);
      setSelectedFloor((prev) => prev ?? mergedCachedFloors[0]?.floor ?? null);
      setIsLoadingData(false);
    }

    const loadDashboardData = async () => {
      try {
        const [eventsBody, roomsBody, importsBody] = await Promise.all([
          fetchApiJson<ScheduleEventsResponse>("/api/schedules/events", { cache: "no-store" }),
          fetchApiJson<RoomsResponse>("/api/schedules/rooms", { cache: "no-store" }),
          fetchApiJson<ImportsHistoryResponse>("/api/schedules/imports-history", { cache: "no-store" }),
        ]);

        const roomsInfoBody = await fetchApiJson<RoomsInfoResponse>("/api/schedules/rooms-info", { cache: "no-store" }).catch(() => null);

        if (cancelled) return;

        const mapped = (eventsBody.events ?? [])
          .map(toDashboardEvent)
          .filter((item): item is ScheduleItem => item !== null);

        setScheduleItems(mapped);
        setRoomsCatalog(
          Array.from(new Set((roomsBody.rooms ?? []).map((room) => room.trim()).filter(Boolean)))
        );
        setImportsHistory(importsBody.imports ?? []);

        const floors = mergeRoomsByFloor(
          (roomsInfoBody?.roomsByFloor ?? [])
            .map((group) => {
              const floor = group[0]?.piso ?? null;
              return floor ? { floor, rooms: group } : null;
            })
            .filter((entry): entry is { floor: number; rooms: RoomsInfoRoom[] } => entry !== null)
        );

        const selectedFloorFromData = floors[0]?.floor ?? null;

        setRoomsByFloor(floors);
        setSelectedFloor((prev) => prev ?? selectedFloorFromData);

        writeDashboardCache({
          scheduleItems: mapped,
          importsHistory: importsBody.imports ?? [],
          roomsCatalog: Array.from(new Set((roomsBody.rooms ?? []).map((room) => room.trim()).filter(Boolean))),
          roomsByFloor: floors,
        });
      } catch {
        if (cancelled) return;
        if (!cached) {
          setScheduleItems([]);
          setRoomsCatalog([]);
          setImportsHistory([]);
          setRoomsByFloor([]);
          setSelectedFloor(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingData(false);
        }
      }
    };

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  const bogotaNow = getBogotaNow();
  const currentMinutes = bogotaNow.currentMinutes;
  const todayIso = bogotaNow.dateIso;
  const todayDay = bogotaNow.dayEn;
  const currentHourLabel = useMemo(() => {
    const currentHour = Math.floor(currentMinutes / 60);
    if (!HOURS.includes(currentHour)) return null;
    return `${String(currentHour).padStart(2, "0")}:00`;
  }, [currentMinutes]);

  const roomUniverse = useMemo(() => {
    const roomsFromInfo = Array.from(
      new Set(roomsByFloor.flatMap((entry) => entry.rooms).filter(isRoomVisible).map((room) => room.nombre.trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    if (roomsFromInfo.length > 0) return roomsFromInfo;
    if (roomsCatalog.length > 0) return roomsCatalog;

    return Array.from(new Set(scheduleItems.map((item) => item.room))).sort();
  }, [roomsByFloor, roomsCatalog, scheduleItems]);

  const roomUniverseNormalized = useMemo(
    () => new Set(roomUniverse.map((room) => normalizeRoomName(room))),
    [roomUniverse],
  );

  const totalRooms = roomUniverse.length;

  const activeRoomsNow = useMemo(() => {
    if (!todayDay) return new Set<string>();

    return new Set(
      scheduleItems
        .filter(
          (item) =>
            item.day === todayDay &&
            item.startDate <= todayIso &&
            todayIso <= item.endDate &&
            toMinutes(item.start) <= currentMinutes &&
            currentMinutes < toMinutes(item.end) &&
            roomUniverseNormalized.has(normalizeRoomName(item.room))
        )
        .map((item) => item.room)
    );
  }, [todayDay, scheduleItems, currentMinutes, todayIso, roomUniverseNormalized]);

  const roomsInClassNow = activeRoomsNow.size;
  const roomsDisponibleNow = Math.max(totalRooms - roomsInClassNow, 0);

  const uniqueWeeklyClasses = useMemo(
    () => new Set(scheduleItems.map((item) => item.classId)).size,
    [scheduleItems]
  );

  const latestImport = importsHistory[0];
  const pendientesConflictos = Math.max(
    (latestImport?.conflicts_detected ?? 0) -
      (latestImport?.conflicts_accepted ?? 0) -
      (latestImport?.conflicts_rejected ?? 0),
    0
  );

  const occupancyByHour = useMemo(() => {
    return HOURS.map((hour) => {
      const slotStart = hour * 60;
      const slotEnd = slotStart + 60;
      const row: Record<string, number | string> = {
        hour: `${String(hour).padStart(2, "0")}:00`,
      };

      for (const day of ALL_DAYS) {
        const activeRooms = new Set(
          scheduleItems.filter((entry) => {
            if (entry.day !== day || entry.startDate > todayIso || todayIso > entry.endDate) return false;
            const start = toMinutes(entry.start);
            const end = toMinutes(entry.end);
            return start < slotEnd && slotStart < end;
          }).map((entry) => entry.room)
        );

        row[day] = activeRooms.size;
      }

      return row;
    });
  }, [scheduleItems, todayIso]);

  const currentHourIndex = useMemo(() => {
    if (!currentHourLabel) return -1;
    return occupancyByHour.findIndex((row) => row.hour === currentHourLabel);
  }, [occupancyByHour, currentHourLabel]);

  const centerOccupancyChartAtCurrentHour = useCallback(() => {
    const container = occupancyChartScrollRef.current;
    if (!container || currentHourIndex < 0) return;

    const trackWidth = container.scrollWidth;
    const points = Math.max(HOURS.length - 1, 1);
    const drawableWidth = Math.max(trackWidth - OCCUPANCY_CHART_Y_AXIS_WIDTH - OCCUPANCY_CHART_RIGHT_MARGIN, 1);
    const pointStep = drawableWidth / points;
    const currentHourCenterX = OCCUPANCY_CHART_Y_AXIS_WIDTH + currentHourIndex * pointStep;
    const targetLeft = currentHourCenterX - container.clientWidth / 2;
    const maxLeft = Math.max(container.scrollWidth - container.clientWidth, 0);
    const nextLeft = Math.max(0, Math.min(targetLeft, maxLeft));

    container.scrollTo({ left: nextLeft, behavior: "smooth" });
  }, [currentHourIndex]);

  useEffect(() => {
    centerOccupancyChartAtCurrentHour();
  }, [centerOccupancyChartAtCurrentHour]);

  useEffect(() => {
    window.addEventListener("resize", centerOccupancyChartAtCurrentHour);
    return () => window.removeEventListener("resize", centerOccupancyChartAtCurrentHour);
  }, [centerOccupancyChartAtCurrentHour]);

  const kpis = [
    {
      title: "Salones en clase ahora",
      value: String(roomsInClassNow),
      chip: totalRooms > 0 ? `${Math.round((roomsInClassNow / totalRooms) * 100)}% Activos` : "Sin salones",
      chipClasses: "bg-green-50 text-green-600 dark:bg-green-900/20",
    },
    {
      title: "Salones disponibles",
      value: String(roomsDisponibleNow),
      chip: "Listos para reserva",
      chipClasses: "bg-[#295786]/10 text-[#295786]",
    },
    {
      title: "Total de clases semanales",
      value: uniqueWeeklyClasses.toLocaleString("es-ES"),
      chip: "Desde base de datos",
      chipClasses: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
    {
      title: "Última importación",
      value: latestImport ? new Intl.DateTimeFormat("es-ES", { month: "short", day: "2-digit" }).format(new Date(latestImport.imported_at)) : "N/D",
      chip: latestImport ? latestImport.status : "Sin historial",
      chipClasses: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
  ];

  const immediateActions = useMemo(() => {
    const actions: Array<{ title: string; detail: string; level: string; icon: string; classes: string }> = [];

    if (pendientesConflictos > 0) {
      actions.push({
        title: `Resolver ${pendientesConflictos} conflicto${pendientesConflictos === 1 ? "" : "s"} de horario`,
        detail: "Revisa conflictos pendientes en la última importación.",
        level: "Alta",
        icon: "warning",
        classes: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20",
      });
    }

    if (!isLoadingData && scheduleItems.length === 0) {
      actions.push({
        title: "No hay horario cargado",
        detail: "Importa un archivo para comenzar a poblar la agenda.",
        level: "Media",
        icon: "upload_file",
        classes: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20",
      });
    }

    if (isLoadingData) {
      actions.push({
        title: "Sincronizando datos del tablero",
        detail: "Actualizando eventos e historial desde la base de datos.",
        level: "Baja",
        icon: "sync",
        classes: "border-[#295786]/20 bg-[#295786]/5 text-[#295786]",
      });
    }

    if (actions.length === 0) {
      actions.push({
        title: "Sistema funcionando normalmente",
        detail: "No hay acciones críticas pendientes en este momento.",
        level: "Info",
        icon: "task_alt",
        classes: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20",
      });
    }

    return actions.slice(0, 3);
  }, [pendientesConflictos, isLoadingData, scheduleItems.length]);

  const todayEvents = useMemo(() => {
    if (!todayDay) return [];
    return scheduleItems.filter((item) => item.day === todayDay && item.startDate <= todayIso && todayIso <= item.endDate);
  }, [scheduleItems, todayDay, todayIso]);

  const peakToday = useMemo(() => {
    if (!todayDay) return "N/D";
    let bestHour = "06:00";
    let maxRooms = -1;

    occupancyByHour.forEach((row) => {
      const count = Number(row[todayDay] ?? 0);
      if (count > maxRooms) {
        maxRooms = count;
        bestHour = String(row.hour);
      }
    });

    return bestHour;
  }, [occupancyByHour, todayDay]);

  const mostOccupiedRoomsToday = useMemo(() => {
    if (todayEvents.length === 0) return "N/D";

    const occupancyByRoom = new Map<string, number>();

    for (const event of todayEvents) {
      const duration = Math.max(toMinutes(event.end) - toMinutes(event.start), 0);
      occupancyByRoom.set(event.room, (occupancyByRoom.get(event.room) ?? 0) + duration);
    }

    let maxMinutes = 0;
    for (const minutes of occupancyByRoom.values()) {
      if (minutes > maxMinutes) {
        maxMinutes = minutes;
      }
    }

    if (maxMinutes === 0) return "N/D";

    const winners = [...occupancyByRoom.entries()]
      .filter(([, minutes]) => minutes === maxMinutes)
      .map(([room]) => room)
      .sort((a, b) => a.localeCompare(b));

    return winners.join(", ");
  }, [todayEvents]);

  const todayOverview = [
    { label: "Clases hoy", value: String(todayEvents.length), icon: "calendar_today" },
    { label: "Hora pico", value: peakToday, icon: "schedule" },
    { label: "Salones ocupados", value: String(new Set(todayEvents.map((item) => item.room)).size), icon: "meeting_room" },
    { label: "Salón más ocupado", value: mostOccupiedRoomsToday, icon: "bar_chart" },
  ];

  const nextClasses = useMemo(() => {
    const startsSoon = todayEvents
      .filter((item) => {
        const diff = toMinutes(item.start) - currentMinutes;
        return diff >= 0 && diff <= 30;
      })
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
      .slice(0, 10)
      .map((item) => {
        const start = toMinutes(item.start);
        const diff = start - currentMinutes;
        const status = `Inicia en ${Math.max(diff, 0)} min`;
        return {
          time: item.start,
          period: start < 720 ? "AM" : "PM",
          subject: item.subject,
          room: item.room,
          professor: item.professor,
          status,
          statusClasses: "bg-green-100 text-green-700",
        };
      });

    if (startsSoon.length > 0) {
      return startsSoon;
    }

    const todayIndex = todayDay ? ALL_DAYS.indexOf(todayDay) : 0;

    return scheduleItems
      .filter((item) => item.startDate <= todayIso && todayIso <= item.endDate)
      .map((item) => {
        const dayIndex = ALL_DAYS.indexOf(item.day);
        if (dayIndex < 0) {
          return null;
        }

        const startMinutes = toMinutes(item.start);
        let daysAhead = dayIndex - todayIndex;

        if (daysAhead < 0 || (daysAhead === 0 && startMinutes < currentMinutes)) {
          daysAhead += ALL_DAYS.length;
        }

        return {
          item,
          daysAhead,
          startMinutes,
        };
      })
      .filter((entry): entry is { item: ScheduleItem; daysAhead: number; startMinutes: number } => entry !== null)
      .sort((a, b) => a.daysAhead - b.daysAhead || a.startMinutes - b.startMinutes || a.item.subject.localeCompare(b.item.subject))
      .slice(0, 10)
      .map(({ item, daysAhead, startMinutes }) => ({
        time: item.start,
        period: startMinutes < 720 ? "AM" : "PM",
        subject: item.subject,
        room: item.room,
        professor: item.professor,
        status: daysAhead === 0 ? "Hoy" : DAY_LABELS[item.day],
        statusClasses: "bg-slate-100 text-slate-600 dark:bg-slate-800",
      }));
  }, [todayEvents, scheduleItems, currentMinutes, todayDay, todayIso]);

  const recentActivity = useMemo(
    () =>
      importsHistory.slice(0, 4).map((item) => ({
        key: item.id,
        text: `Importacion ${item.source_file} (${item.status})`,
        when: formatRelativeTime(item.imported_at),
        icon: "upload_file",
      })),
    [importsHistory]
  );

  const compactWeeklyOverview = useMemo(
    () =>
      ALL_DAYS.map((day) => {
        const avg =
          totalRooms > 0
            ? Math.round(
                (occupancyByHour.reduce((acc, row) => acc + Number(row[day] ?? 0), 0) /
                  occupancyByHour.length /
                  totalRooms) *
                  100
              )
            : 0;
        return {
          day: DAY_LABELS[day],
          occupancy: avg,
          conflicts: day === todayDay ? pendientesConflictos : 0,
        };
      }),
    [occupancyByHour, totalRooms, pendientesConflictos, todayDay]
  );

  const floorNumbers = useMemo(() => roomsByFloor.map((entry) => entry.floor), [roomsByFloor]);

  const miniMapRooms = useMemo(() => {
    if (!todayDay || selectedFloor === null) return [];

    const selected = roomsByFloor.find((entry) => entry.floor === selectedFloor);
    if (!selected) return [];

    const targetDayEs = normalizeDayValue(DAY_EN_TO_ES[todayDay]);

    const sortedRooms = [...selected.rooms].sort((a, b) => {
      const aNum = Number(a.nombre.match(/\d+/)?.[0] ?? Number.POSITIVE_INFINITY);
      const bNum = Number(b.nombre.match(/\d+/)?.[0] ?? Number.POSITIVE_INFINITY);
      if (aNum !== bNum) return aNum - bNum;
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    });

    return sortedRooms.map((room) => {
      const daySchedules = room.horarios.filter(
        (slot) => normalizeDayValue(slot.diaSemana) === targetDayEs
      );

      const inClass = daySchedules.some((slot) => {
        const start = parseScheduleClockToMinutes(slot.horaInicio);
        const end = parseScheduleClockToMinutes(slot.horaFin);
        if (start === null || end === null) return false;
        return start <= currentMinutes && currentMinutes < end;
      });

      const startingSoon = daySchedules.some((slot) => {
        const start = parseScheduleClockToMinutes(slot.horaInicio);
        if (start === null) return false;
        const delta = start - currentMinutes;
        return delta > 0 && delta <= 30;
      });

      if (inClass) {
        return {
          id: room.id,
          room: room.nombre,
          label: "En clase" as const,
          classes: "border-red-500/30 bg-red-100 text-red-700 dark:bg-red-900/20",
          textClass: "text-red-600/70",
        };
      }

      if (startingSoon) {
        return {
          id: room.id,
          room: room.nombre,
          label: "Inicia pronto" as const,
          classes: "border-amber-500/30 bg-amber-100 text-amber-700 dark:bg-amber-900/20",
          textClass: "text-amber-600/70",
        };
      }

      return {
        id: room.id,
        room: room.nombre,
        label: "Disponible" as const,
        classes: "border-green-500/30 bg-green-100 text-green-700 dark:bg-green-900/20",
        textClass: "text-green-600/70",
      };
    });
  }, [roomsByFloor, selectedFloor, todayDay, currentMinutes]);

  const normalizedSubmittedQuery = normalizeText(submittedQuery);

  const classSearchResults = useMemo(() => {
    if (!normalizedSubmittedQuery || quickMode !== "class") return [];

    const tokens = normalizedSubmittedQuery.split(" ").filter(Boolean);
    return scheduleItems
      .map((item) => ({
        item,
        score: scoreMatch(item, normalizedSubmittedQuery),
        searchable: normalizeText(`${item.subject} ${item.code}`),
      }))
      .filter((entry) => tokens.every((token) => entry.searchable.includes(token)))
      .sort((a, b) => b.score - a.score || a.item.day.localeCompare(b.item.day) || a.item.start.localeCompare(b.item.start))
      .slice(0, 20);
  }, [normalizedSubmittedQuery, scheduleItems, quickMode]);

  const professorSearchResults = useMemo(() => {
    if (!normalizedSubmittedQuery || quickMode !== "professor") return [];

    const tokens = normalizedSubmittedQuery.split(" ").filter(Boolean);
    return scheduleItems
      .map((item) => ({
        item,
        score: scoreMatch(item, normalizedSubmittedQuery),
        searchable: normalizeText(item.professor),
      }))
      .filter((entry) => tokens.every((token) => entry.searchable.includes(token)))
      .sort((a, b) => b.score - a.score || a.item.day.localeCompare(b.item.day) || a.item.start.localeCompare(b.item.start))
      .slice(0, 20);
  }, [normalizedSubmittedQuery, scheduleItems, quickMode]);

  const availableRoomsResult = useMemo(() => {
    if (!submittedRoomCheck || quickMode !== "availableRooms") return null;

    const checkStartMinutes = toMinutes(submittedRoomCheck.startTime);
    const checkEndMinutes = toMinutes(submittedRoomCheck.endTime);

    if (checkEndMinutes <= checkStartMinutes) {
      return null;
    }

    const occupiedRooms = new Set(
      scheduleItems
        .filter((item) => {
          if (item.day !== submittedRoomCheck.day) return false;
          if (!(item.startDate <= todayIso && todayIso <= item.endDate)) return false;
          const itemStartMinutes = toMinutes(item.start);
          const itemEndMinutes = toMinutes(item.end);
          return itemStartMinutes < checkEndMinutes && checkStartMinutes < itemEndMinutes;
        })
        .map((item) => item.room)
    );

    const availableRooms = roomUniverse.filter((room) => !occupiedRooms.has(room));

    return {
      availableRooms,
      totalRooms: roomUniverse.length,
      day: submittedRoomCheck.day,
      startTime: submittedRoomCheck.startTime,
      endTime: submittedRoomCheck.endTime,
    };
  }, [submittedRoomCheck, quickMode, scheduleItems, roomUniverse, todayIso]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (quickMode === "availableRooms") {
      if (!roomCheckStartTime || !roomCheckEndTime) {
        setIsSearchModalOpen(false);
        return;
      }

      if (toMinutes(roomCheckEndTime) <= toMinutes(roomCheckStartTime)) {
        setIsSearchModalOpen(false);
        return;
      }

      setSubmittedRoomCheck({
        day: roomCheckDay,
        startTime: roomCheckStartTime,
        endTime: roomCheckEndTime,
      });
      setSubmittedQuery("");
      setIsSearchModalOpen(true);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setIsSearchModalOpen(false);
      setSubmittedQuery("");
      return;
    }

    setSubmittedQuery(trimmed);
    setSubmittedRoomCheck(null);
    setIsSearchModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-3 sm:space-y-8 sm:p-6 lg:p-8">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-xs font-medium tracking-wider text-slate-500 uppercase transition-none transform-none motion-reduce:transition-none motion-reduce:transform-none">{kpi.title}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                {isLoadingData ? <span className="material-symbols-outlined animate-spin text-[22px]">progress_activity</span> : kpi.value}
              </h3>
              <span className={`rounded px-2 py-1 text-xs font-bold ${isLoadingData ? "bg-slate-100 text-slate-500" : kpi.chipClasses}`}>
                {isLoadingData ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>
                    Cargando
                  </span>
                ) : (
                  kpi.chip
                )}
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:col-span-12 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-9 xl:p-5">
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">BÚSQUEDA RÁPIDA</h4>
            <div className="mt-1 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQuickMode("class");
                    setSubmittedRoomCheck(null);
                  }}
                  className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold leading-none transition ${quickMode === "class" ? "bg-[#295786] text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  <span className="material-symbols-outlined text-[15px] leading-none">menu_book</span>
                  <span className="leading-none">Clase</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickMode("professor");
                    setSubmittedRoomCheck(null);
                  }}
                  className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold leading-none transition ${quickMode === "professor" ? "bg-[#295786] text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  <span className="material-symbols-outlined text-[15px] leading-none">person_search</span>
                  <span className="leading-none">Profesor</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickMode("availableRooms");
                    setQuery("");
                  }}
                  className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold leading-none transition ${quickMode === "availableRooms" ? "bg-[#295786] text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                >
                  <span className="material-symbols-outlined text-[15px] leading-none">meeting_room</span>
                  <span className="leading-none">Salones Disponibles</span>
                </button>
              </div>
              <form onSubmit={handleSearchSubmit} className="mt-2 flex flex-col gap-2 sm:mt-1 sm:gap-1 sm:flex-row sm:items-end">
                {quickMode !== "availableRooms" ? (
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={quickMode === "class" ? "Ej: Programacion I, Calculo II" : "Ej: Perez, Mendez"}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none ring-[#295786]/30 transition focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  ) : (
                    <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">Día:</span>
                        <select
                          value={roomCheckDay}
                          onChange={(event) => setRoomCheckDay(event.target.value as ScheduleItem["day"])}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none ring-[#295786]/30 transition focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          {ALL_DAYS.map((day) => (
                            <option key={day} value={day}>{DAY_EN_TO_ES[day]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">Hora de Inicio:</span>
                        <select
                          value={roomCheckStartTime}
                          onChange={(event) => {
                            const nextStartTime = event.target.value;
                            setRoomCheckStartTime(nextStartTime);
                            if (toMinutes(roomCheckEndTime) <= toMinutes(nextStartTime)) {
                              const fallbackEnd = TIME_OPTIONS.find((option) => toMinutes(option) > toMinutes(nextStartTime));
                              if (fallbackEnd) setRoomCheckEndTime(fallbackEnd);
                            }
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none ring-[#295786]/30 transition focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>{toAmPmLabel(time)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-slate-600">Hora Final:</span>
                        <select
                          value={roomCheckEndTime}
                          onChange={(event) => setRoomCheckEndTime(event.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none ring-[#295786]/30 transition focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          {TIME_OPTIONS.filter((time) => toMinutes(time) > toMinutes(roomCheckStartTime)).map((time) => (
                            <option key={time} value={time}>{toAmPmLabel(time)}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  <button
                  type="submit"
                    className="w-full rounded-xl bg-[#295786] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 sm:w-auto"
                >
                  Buscar
                </button>
              </form>
              {quickMode === "availableRooms" ? <p className="mt-1 text-xs text-slate-500">Selecciona día, hora de inicio y hora final para validar disponibilidad de salones.</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:col-span-3 lg:max-w-[320px] lg:justify-self-end">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Acciones inmediatas</h4>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold tracking-wider text-red-700 uppercase dark:bg-red-900/30 dark:text-red-300">
                {immediateActions.length} pendientes
              </span>
            </div>
            <div className="space-y-2">
              {immediateActions.map((action) => (
                <div key={action.title} className={`flex gap-2 rounded-lg border p-2.5 ${action.classes}`}>
                  <span className="material-symbols-outlined text-sm">{action.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold">{action.title}</p>
                    <p className="line-clamp-2 text-[10px] opacity-90">{action.detail}</p>
                  </div>
                  <span className="ml-auto h-fit rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase text-slate-700 dark:bg-slate-950/20 dark:text-slate-100">
                    {action.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-12">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Vista previa del mapa del edificio</h4>
              <p className="mt-1 text-xs text-slate-500">Visualización en tiempo real del estado de ocupación de salones</p>
            </div>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {floorNumbers.map((floor) => (
                <button
                  key={floor}
                  type="button"
                  onClick={() => setSelectedFloor(floor)}
                  className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase ${selectedFloor === floor ? "bg-white text-[#295786] shadow-sm dark:bg-slate-700" : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-700/50"}`}
                >
                  Piso {floor}
                </button>
              ))}
              {floorNumbers.length === 0 && (
                <span className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase">Sin pisos</span>
              )}
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {miniMapRooms.map((room, index) => (
              <div key={`${room.id}-${index}`} className={`group flex min-h-[88px] cursor-default flex-col justify-between rounded-xl border-2 p-3 sm:min-h-[98px] ${room.classes}`}>
                <span className="line-clamp-2 text-center text-xs font-black leading-tight md:text-sm">{room.room}</span>
                <span className={`text-center text-[10px] font-bold uppercase ${room.textClass}`}>{room.label || "Disponible"}</span>
              </div>
            ))}
            {miniMapRooms.length === 0 && (
              <div className="col-span-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-500 md:col-span-4 lg:col-span-6">
                {isLoadingData ? <LoadingInline text="Cargando mapa de salones..." /> : "No hay datos de salones para este piso."}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-green-500" />
                <span className="text-xs font-medium text-slate-600">Disponible</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-red-500" />
                <span className="text-xs font-medium text-slate-600">En clase</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-amber-500" />
                <span className="text-xs font-medium text-slate-600">Inicia pronto</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/rooms")}
              className="w-full rounded-xl bg-[#295786] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#295786]/20 transition-all hover:scale-105 active:scale-95 sm:w-auto"
            >
              Abrir mapa completo del edificio
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:col-span-12 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 lg:p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Ocupación por hora de salones</h4>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold tracking-wider text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">
                {isLoadingData ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>
                    Cargando
                  </span>
                ) : (
                  "Datos en vivo"
                )}
              </span>
            </div>
            {isLoadingData ? (
              <p className="mb-2"><LoadingInline text="Actualizando ocupación por hora..." /></p>
            ) : null}
            <div ref={occupancyChartScrollRef} className="overflow-x-auto">
              <div className="h-72 min-w-[920px] w-full sm:min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={occupancyByHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => toAmPmLabel(String(value))}
                    />
                    <YAxis
                      domain={[0, Math.max(totalRooms, 1)]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickCount={8}
                      allowDecimals={false}
                      width={OCCUPANCY_CHART_Y_AXIS_WIDTH}
                    />
                    <Tooltip
                      labelFormatter={(label) => toAmPmLabel(String(label))}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: 12,
                      }}
                    />
                    {ALL_DAYS.map((day) => {
                      const isTodayLine = todayDay === day;

                      return (
                        <Line
                          key={day}
                          type="monotone"
                          dataKey={day}
                          name={DAY_LABELS[day]}
                          stroke={DAY_COLORS[day]}
                          strokeWidth={isTodayLine ? 3.6 : 2.2}
                          strokeOpacity={isTodayLine ? 1 : 0.35}
                          dot={
                            isTodayLine
                              ? (props) => {
                                  const payload = props.payload as { hour?: string };
                                  if (!currentHourLabel || payload.hour !== currentHourLabel) {
                                    const emptyDotKey = `empty-dot-${day}-${payload.hour ?? "na"}-${String(props.cx)}-${String(props.cy)}`;
                                    return <g key={emptyDotKey} />;
                                  }

                                  const dotKey = `current-dot-${day}-${payload.hour ?? "na"}-${String(props.cx)}-${String(props.cy)}`;

                                  return (
                                    <circle
                                      key={dotKey}
                                      cx={props.cx}
                                      cy={props.cy}
                                      r={6}
                                      fill={DAY_COLORS[day]}
                                      stroke="#ffffff"
                                      strokeWidth={2}
                                    />
                                  );
                                }
                              : undefined
                          }
                          activeDot={{ r: isTodayLine ? 6 : 4 }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 sm:hidden">Desliza horizontalmente para ver toda la línea por hora.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {ALL_DAYS.map((day) => (
                <span key={day} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="size-2 rounded-full" style={{ backgroundColor: DAY_COLORS[day] }} />
                  {DAY_LABELS[day]}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Resumen de hoy</h4>
            <div className="mt-4 flex flex-col gap-2">
              {todayOverview.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="material-symbols-outlined text-sm">{item.icon}</span>
                    <p className="text-[10px] font-bold tracking-wider uppercase">{item.label}</p>
                  </div>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex lg:h-full lg:flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Próximas clases</h4>
            <button className="text-xs font-bold text-[#295786] hover:underline">Ver todo</button>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800 lg:flex-1 lg:overflow-y-auto">
            {nextClasses.map((nextClass) => (
              <div key={`${nextClass.subject}-${nextClass.time}`} className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="flex min-w-[60px] flex-col items-center rounded-lg bg-slate-100 px-2 py-3 dark:bg-slate-800">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{nextClass.time}</span>
                    <span className="text-[9px] text-slate-500 uppercase">{nextClass.period}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{nextClass.subject}</p>
                    <div className="flex gap-2 text-xs text-slate-500">
                      <span className="font-medium text-[#295786]">{nextClass.room}</span>
                      <span>•</span>
                      <span>{nextClass.professor}</span>
                    </div>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${nextClass.statusClasses}`}>{nextClass.status}</span>
              </div>
            ))}
            {nextClasses.length === 0 && (
              <div className="p-4 text-sm text-slate-500">
                {isLoadingData ? <LoadingInline text="Cargando próximas clases..." /> : "No hay clases que inicien en los proximos 30 minutos."}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:h-full">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-5 dark:border-slate-800">
              <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Resumen semanal del edificio</h4>
              <p className="mt-1 text-[11px] text-slate-500">Tendencia semanal compacta para planificación, no para operación en tiempo real.</p>
            </div>
            <div className="space-y-2 p-4">
              {compactWeeklyOverview.map((day) => (
                <div key={day.day} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{day.day}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{day.occupancy}% ocupación</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-[#295786]" style={{ width: `${day.occupancy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex lg:flex-1 lg:flex-col">
            <div className="border-b border-slate-100 p-5 dark:border-slate-800">
              <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Actividad reciente</h4>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:flex-1 lg:overflow-y-auto">
              {recentActivity.map((activity) => (
                <div key={activity.key} className="flex items-start gap-3 p-4">
                  <span className="material-symbols-outlined mt-0.5 text-base text-[#295786]">{activity.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{activity.text}</p>
                    <p className="text-xs text-slate-500">{activity.when}</p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="p-4 text-sm text-slate-500">
                  {isLoadingData ? <LoadingInline text="Cargando actividad reciente..." /> : "Aún no hay actividad de importación registrada."}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
          <button
            aria-label="Close search modal"
            className="absolute inset-0"
            onClick={() => setIsSearchModalOpen(false)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {quickMode === "class"
                    ? "Resultados por Clase"
                    : quickMode === "professor"
                      ? "Resultados por Profesor"
                      : "Disponibilidad de Salones"}
                </p>
                {quickMode !== "availableRooms" ? (
                  <p className="text-xs text-slate-500">Búsqueda: {submittedQuery}</p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Consulta: {submittedRoomCheck ? `${DAY_EN_TO_ES[submittedRoomCheck.day]} ${submittedRoomCheck.startTime} - ${submittedRoomCheck.endTime}` : "N/D"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-[68vh] space-y-3 overflow-y-auto p-5">
              {quickMode === "class" && classSearchResults.length === 0 && (
                <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  No encontramos clases para esa búsqueda.
                </p>
              )}
              {quickMode === "class" && classSearchResults.map(({ item }) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.code} • {item.subject}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{item.professor} • {item.room}</p>
                  <p className="mt-1 text-xs font-medium text-[#295786]">{item.dayEs} • {item.start} - {item.end}</p>
                </div>
              ))}

              {quickMode === "professor" && professorSearchResults.length === 0 && (
                <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  No encontramos clases asociadas a ese profesor.
                </p>
              )}
              {quickMode === "professor" && professorSearchResults.map(({ item }) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.professor}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{item.code} • {item.subject}</p>
                  <p className="mt-1 text-xs font-medium text-[#295786]">{item.dayEs} • {item.start} - {item.end} • {item.room}</p>
                </div>
              ))}

              {quickMode === "availableRooms" && availableRoomsResult && (
                <>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      Disponibles: {availableRoomsResult.availableRooms.length} de {availableRoomsResult.totalRooms}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-200/90">
                      Día: {DAY_EN_TO_ES[availableRoomsResult.day]} • Hora: {availableRoomsResult.startTime} - {availableRoomsResult.endTime}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">Salones Disponibles</p>
                    {availableRoomsResult.availableRooms.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay salones disponibles en ese rango de horario.</p>
                    ) : (
                      <p className="text-sm text-slate-700 dark:text-slate-200">{availableRoomsResult.availableRooms.join(", ")}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
