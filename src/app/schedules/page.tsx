"use client";

import { FormEvent, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Rnd, RndDragCallback, RndResizeCallback } from "react-rnd";
import { fetchApiJson } from "@/lib/api-client";
import { useWebSocketSchedules } from "@/lib/use-websocket-schedules";

const toAmPmLabel = (value: string) => {
  const [rawHour, rawMinute] = value.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return value;
  }

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
};

type ScheduleEvent = {
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
  overrides?: Array<{
    date: string;
    day: string;
    room: string;
    start: string;
    end: string;
  }>;
  reservationType?: ReservationType;
  color: "blue" | "emerald" | "amber" | "violet" | "red";
};

type UpdateScope = "week" | "always";
type PendingScopedUpdate = {
  id: string;
  eventId: string;
  slotId: string;
  targetDate: string;
  source: "drag" | "resize";
  updatedEvent: ScheduleEvent;
};

type ReservationType = "normal" | "momentanea" | "iglesia";

const reservationTypeLabels: Record<ReservationType, string> = {
  normal: "Reserva semestre",
  momentanea: "Reserva por dia",
  iglesia: "Reserva iglesia",
};

type ScheduleSlotForm = {
  day: string;
  room: string;
  start: string;
  end: string;
};

type NewEventForm = {
  reservationType: ReservationType;
  faculty: string;
  code: string;
  subject: string;
  teacher: string;
  startDate: string;
  endDate: string;
  oneDayDate: string;
  churchGroup: string;
  churchEvent: string;
  churchContact: string;
  slots: ScheduleSlotForm[];
};

type EditEventForm = {
  faculty: string;
  code: string;
  subject: string;
  teacher: string;
  startDate: string;
  endDate: string;
  day: string;
  room: string;
  start: string;
  end: string;
};

type AvailableRoomResult = {
  room: string;
  capacity: number;
  floor: number;
};

type SchedulesCachePayload = {
  savedAt: number;
  events: ScheduleEvent[];
  rooms: string[];
};

const SCHEDULES_CACHE_KEY = "schedules-page-cache-v1";
const SCHEDULES_CACHE_TTL_MS = 5 * 60 * 1000;
let inMemorySchedulesCache: SchedulesCachePayload | null = null;

const canonicalizeRoomName = (value: string) => {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bmd\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^aula foro union( 101)?$/.test(normalized)) return "Aula Foro Union 101";
  if (/^aula foro unac( 102)?$/.test(normalized)) return "Aula Foro UNAC 102";

  if (/^sala( de)? informatica 1 bolivar$/.test(normalized)) {
    return "Sala Informática 1 Bolivar";
  }

  if (/^sala( de)? informatica 2 bolivar$/.test(normalized)) {
    return "Sala Informática 2 Bolivar";
  }

  if (/^laboratorio de (analisis de datos y )?simulacion financiera( 403)?$/.test(normalized)) {
    return "Laboratorio de simulación financiera 403";
  }

  if (/^laboratorio de desarrollo de software( lds)?( 404)?$/.test(normalized)) {
    return "Laboratorio de Desarrollo de Software (LDS) 404";
  }

  if (/^laboratorio de fisica( 405)?$/.test(normalized)) {
    return "Laboratorio de Física 405";
  }

  if (/^laboratorio de musica( 308)?$/.test(normalized)) {
    return "Laboratorio de Música 308";
  }

  if (/^laboratorio de infantil( 204)?$/.test(normalized)) {
    return "Laboratorio de Infantil 204";
  }

  if (/^aula interamericana (501|1)$/.test(normalized)) return "Aula Interamericana 501";
  if (/^aula interamericana (502|2)$/.test(normalized)) return "Aula Interamericana 502";
  if (/^aula interamericana (503|3)$/.test(normalized)) return "Aula Interamericana 503";

  return value.trim();
};

const normalizeLoadedEvents = (events: ScheduleEvent[], normalizeColor: (color: string) => ScheduleEvent["color"]) =>
  events.map((event) => ({
    ...event,
    room: canonicalizeRoomName(event.room),
    overrides: (event.overrides ?? []).map((override) => ({
      ...override,
      room: canonicalizeRoomName(override.room),
    })),
    color: normalizeColor(event.color),
  }));

const normalizeLoadedRooms = (incomingRooms: string[]) => {
  const seen = new Set<string>();
  const output: string[] = [];

  incomingRooms.forEach((room) => {
    if (typeof room !== "string") return;
    const canonical = canonicalizeRoomName(room);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    output.push(canonical);
  });

  return output;
};

const resolveRoomFromCatalog = (room: string, catalog: string[]) => {
  if (!room) return "";

  if (catalog.includes(room)) {
    return room;
  }

  const canonicalTarget = canonicalizeRoomName(room);
  const canonicalMatch = catalog.find((candidate) => canonicalizeRoomName(candidate) === canonicalTarget);

  return canonicalMatch ?? canonicalTarget;
};

function getColombiaTodayIsoDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

const toIsoLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getInitialSlot = (): ScheduleSlotForm => ({
  day: "",
  room: "",
  start: "",
  end: "",
});

const getInitialNewEvent = (): NewEventForm => ({
  reservationType: "normal",
  faculty: faculties[0],
  code: "",
  subject: "",
  teacher: "",
  startDate: getColombiaTodayIsoDate(),
  endDate: getColombiaTodayIsoDate(),
  oneDayDate: getColombiaTodayIsoDate(),
  churchGroup: "",
  churchEvent: "",
  churchContact: "",
  slots: [getInitialSlot()],
});

const getInitialEditEvent = (): EditEventForm => ({
  faculty: faculties[0],
  code: "",
  subject: "",
  teacher: "",
  startDate: getColombiaTodayIsoDate(),
  endDate: getColombiaTodayIsoDate(),
  day: "Lunes",
  room: rooms[0],
  start: "08:00",
  end: "10:00",
});

const weekDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const shortMonthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const pickerWeekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const faculties = [
  "Facultad de Ciencias Administrativas y Contables",
  "Facultad de Ciencias Humanas y de la Educación",
  "Facultad de Ciencias de la Salud",
  "Facultad de Ingeniería",
  "Facultad de Teología y Religión",
];

const rooms = [
  "Aula Foro Union",
  "Aula Foro UNAC",
  "Sala Informática 1 Bolivar",
  "Sala Informática 2 Bolivar",
  "Sala de Simulación 1",
  "Sala de Simulación 2",
  "Sala de Simulación 3",
  "Laboratorio de análisis de datos y simulación financiera",
  "Laboratorio de Desarrollo de Software (LDS)",
  "Laboratorio de Física",
  "Laboratorio de Infantil",
  "Laboratorio de Música",
  "Laboratorio TAPH Bucaramanga",
  "Presencial asistida por tecnología",
  "Sala de Capacitación - Lab Industrial",
  "Sala de Informática ICOLVEN - Primer piso",
  "Sala de Informática ICOLVEN - Segundo piso",
  "Sala de Producción y Picking- Lab Industrial",
  "Salón 16 TAPH",
  "Salón 18 TAPH",
  "Salón 19 TAPH",
  "Salón 20 TAPH",
  "Salón 21 TAPH",
  "Salón 22 TAPH",
  "Salón 29 TAPH",
  "Salón 200",
  "Salón 201",
  "Salón 202",
  "Salón 203",
  "Salón 205",
  "Salón 206",
  "Salón 301",
  "Salón 302",
  "Salón 303",
  "Salón 304",
  "Salón 305",
  "Salón 401",
  "Salón 402",
  "Salón 406",
  "Salón 505",
  "Salón 506",
  "Salón Academia de Música 103",
  "Salón Academia de Música 104",
  "Salón Academia de Música 105",
  "Salón Academia de Música 107",
  "Salón Academia de Música 108",
  "Salón Academia de Música 109",
  "Salón Academia de Música 200",
  "Salón Academia de Música 203",
  "Salón Academia de Música 204",
  "Salón Academia de Música 205",
  "Salón Academia de Música 206",
  "Salón Academia de Música 301",
  "Salón Academia de Música 303",
  "Salón Academia de Música 304",
  "Salón Academia de Música 305",
  "Aula Interamericana 501",
  "Aula Interamericana 502",
  "Aula Interamericana 503",
  "Solicitar salón a Planeación",
  "Virtual",
];

const timeSlots = [
  "06:00-06:30",
  "06:30-07:00",
  "07:00-07:30",
  "07:30-08:00",
  "08:00-08:30",
  "08:30-09:00",
  "09:00-09:30",
  "09:30-10:00",
  "10:00-10:30",
  "10:30-11:00",
  "11:00-11:30",
  "11:30-12:00",
  "12:00-12:30",
  "12:30-13:00",
  "13:00-13:30",
  "13:30-14:00",
  "14:00-14:30",
  "14:30-15:00",
  "15:00-15:30",
  "15:30-16:00",
  "16:00-16:30",
  "16:30-17:00",
  "17:00-17:30",
  "17:30-18:00",
  "18:00-18:30",
  "18:30-19:00",
  "19:00-19:30",
  "19:30-20:00",
  "20:00-20:30",
  "20:30-21:00",
  "21:00-21:30",
  "21:30-22:00",
];

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDayKey = (value: string) => normalizeKey(value);

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const facultyToneMap: Array<{ keys: string[]; tone: string }> = [
  {
    keys: ["facultad de ciencias administrativas y contables", "administrativas y contables"],
    tone: "bg-emerald-50 border-emerald-700 text-emerald-900",
  },
  {
    keys: ["facultad de ciencias humanas y de la educación", "humanas y de la educación"],
    tone: "bg-violet-50 border-violet-700 text-violet-900",
  },
  {
    keys: ["facultad de ciencias de la salud", "ciencias de la salud"],
    tone: "bg-rose-50 border-rose-700 text-rose-900",
  },
  {
    keys: ["facultad de ingeniería", "ingeniería"],
    tone: "bg-blue-50 border-blue-700 text-blue-900",
  },
  {
    keys: ["facultad de teología y religión", "teología y religión"],
    tone: "bg-amber-50 border-amber-700 text-amber-900",
  },
];

const defaultFacultyTone = "bg-slate-50 border-slate-700 text-slate-900";

const facultyLegend = [
  {
    label: "Administrativas y contables",
    tone: "bg-emerald-50 border-emerald-700",
  },
  {
    label: "Humanas y de la educación",
    tone: "bg-violet-50 border-violet-700",
  },
  {
    label: "Ciencias de la salud",
    tone: "bg-rose-50 border-rose-700",
  },
  {
    label: "Ingeniería",
    tone: "bg-blue-50 border-blue-700",
  },
  {
    label: "Teología y religión",
    tone: "bg-amber-50 border-amber-700",
  },
] as const;

const inferReservationType = (event: ScheduleEvent): ReservationType => {
  if (event.reservationType) return event.reservationType;

  const normalizedCode = normalizeKey(event.code);
  if (normalizedCode.includes("reserva-dia") || normalizedCode.includes("reserva dia")) {
    return "momentanea";
  }
  if (normalizedCode.includes("reserva-iglesia") || normalizedCode.includes("reserva iglesia")) {
    return "iglesia";
  }
  return "normal";
};

const getEventVisualClass = (event: ScheduleEvent) => {
  const reservationType = inferReservationType(event);

  if (reservationType === "momentanea") {
    return "bg-white border-amber-700 text-slate-900 border-2 border-dashed";
  }

  if (reservationType === "iglesia") {
    return "bg-white border-slate-900 text-slate-900 border-2";
  }

  const facultyKey = normalizeKey(event.faculty);
  return (
    facultyToneMap.find((entry) => entry.keys.some((key) => facultyKey.includes(normalizeKey(key))))?.tone ??
    defaultFacultyTone
  );
};

const getWeekdayName = (date: Date) => {
  const day = date.getDay();
  return weekDays[(day + 6) % 7];
};

const startOfWeekMonday = (date: Date) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

const parseIsoDateToLocal = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const getColombiaToday = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");

  return new Date(year, month - 1, day);
};

const getColombiaTime = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return { hour, minute };
};

const getCurrentTimeSlotIndex = (slots: string[]) => {
  const { hour, minute } = getColombiaTime();
  const currentMinutes = hour * 60 + minute;

  for (let i = 0; i < slots.length; i++) {
    const [start] = slots[i].split("-");
    const [startHour, startMin] = start.split(":").map(Number);
    const slotStartMinutes = startHour * 60 + startMin;
    const slotEndMinutes = slotStartMinutes + 30;

    if (currentMinutes >= slotStartMinutes && currentMinutes < slotEndMinutes) {
      return i;
    }
  }

  return -1;
};

const dateValue = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart <= bEnd && bStart <= aEnd;

const dateRangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
  const aStartValue = dateValue(parseIsoDateToLocal(aStart));
  const aEndValue = dateValue(parseIsoDateToLocal(aEnd));
  const bStartValue = dateValue(parseIsoDateToLocal(bStart));
  const bEndValue = dateValue(parseIsoDateToLocal(bEnd));

  return rangesOverlap(aStartValue, aEndValue, bStartValue, bEndValue);
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const buildMonthGrid = (monthCursor: Date) => {
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const startDay = monthStart.getDay();
  const endDay = monthEnd.getDay();

  const gridStart = addDays(monthStart, startDay === 0 ? -6 : 1 - startDay);
  const gridEnd = addDays(monthEnd, endDay === 0 ? 0 : 7 - endDay);

  const days: Date[] = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor));
  }

  return days;
};

const formatWeekRangeLabel = (weekStart: Date) => {
  const weekEnd = addDays(weekStart, 6);
  return `Semana ${shortMonthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${shortMonthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
};

const isCacheFresh = (payload: SchedulesCachePayload) => Date.now() - payload.savedAt <= SCHEDULES_CACHE_TTL_MS;

const getFastInitialSnapshot = (): SchedulesCachePayload | null => {
  // Safe for hydration: this only uses in-memory cache populated after client runtime.
  if (typeof window === "undefined") return null;
  if (!inMemorySchedulesCache || !isCacheFresh(inMemorySchedulesCache)) return null;
  return inMemorySchedulesCache;
};

const readSchedulesCache = (): SchedulesCachePayload | null => {
  if (inMemorySchedulesCache && isCacheFresh(inMemorySchedulesCache)) {
    return inMemorySchedulesCache;
  }

  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SCHEDULES_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SchedulesCachePayload;
    if (!parsed || !Array.isArray(parsed.events) || !Array.isArray(parsed.rooms) || typeof parsed.savedAt !== "number") {
      return null;
    }

    if (!isCacheFresh(parsed)) {
      window.localStorage.removeItem(SCHEDULES_CACHE_KEY);
      return null;
    }

    const normalizedParsed: SchedulesCachePayload = {
      savedAt: parsed.savedAt,
      events: parsed.events.map((event) => ({
        ...event,
        room: canonicalizeRoomName(event.room),
      })),
      rooms: normalizeLoadedRooms(parsed.rooms),
    };

    inMemorySchedulesCache = normalizedParsed;
    return normalizedParsed;
  } catch {
    return null;
  }
};

const writeSchedulesCache = (events: ScheduleEvent[], cachedRooms: string[]) => {
  const payload: SchedulesCachePayload = {
    savedAt: Date.now(),
    events,
    rooms: cachedRooms,
  };

  inMemorySchedulesCache = payload;

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SCHEDULES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures (private mode, quota, etc.) and keep memory cache only.
  }
};

export default function SchedulesPage() {
  const weekPickerRef = useRef<HTMLDivElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const pendingCenterEventIdRef = useRef<string | null>(null);
  const fastInitialSnapshot = getFastInitialSnapshot();

  const colombiaToday = useMemo(() => getColombiaToday(), []);
  const [selectedDay, setSelectedDay] = useState(getWeekdayName(colombiaToday));
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeekMonday(colombiaToday));
  const [currentTimeSlotIndex, setCurrentTimeSlotIndex] = useState(() => getCurrentTimeSlotIndex(timeSlots));
  const [isWeekPickerOpen, setIsWeekPickerOpen] = useState(false);
  const [pickerMonthCursor, setPickerMonthCursor] = useState(startOfMonth(colombiaToday));
  const [roomQuery, setRoomQuery] = useState("");
  const [isAvailableSearchOpen, setIsAvailableSearchOpen] = useState(false);
  const [isSearchingAvailableRooms, setIsSearchingAvailableRooms] = useState(false);
  const [availableRoomsError, setAvailableRoomsError] = useState<string | null>(null);
  const [availableRoomsResult, setAvailableRoomsResult] = useState<AvailableRoomResult[]>([]);
  const [availableRoomForm, setAvailableRoomForm] = useState({
    date: getColombiaTodayIsoDate(),
    start: "08:00",
    end: "10:00",
    capacity: "20",
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>(fastInitialSnapshot?.events ?? []);
  const [roomCatalog, setRoomCatalog] = useState<string[]>(
    fastInitialSnapshot?.rooms?.length ? fastInitialSnapshot.rooms : rooms
  );
  const [remoteLoadError, setRemoteLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState("");
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState<NewEventForm>(getInitialNewEvent);
  const [editEvent, setEditEvent] = useState<EditEventForm>(getInitialEditEvent);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const [pendingScopedUpdate, setPendingScopedUpdate] = useState<PendingScopedUpdate | null>(null);
  const [isApplyingScopedUpdate, setIsApplyingScopedUpdate] = useState(false);
  const pendingScopedUpdateRef = useRef<PendingScopedUpdate | null>(null);
  const isApplyingScopedUpdateRef = useRef(false);
  const isSchedulesWsEnabled = (process.env.NEXT_PUBLIC_ENABLE_SCHEDULES_WS ?? "").trim().toLowerCase() === "true";

  useEffect(() => {
    pendingScopedUpdateRef.current = pendingScopedUpdate;
  }, [pendingScopedUpdate]);

  useEffect(() => {
    isApplyingScopedUpdateRef.current = isApplyingScopedUpdate;
  }, [isApplyingScopedUpdate]);

  const normalizeColor = (value: string): ScheduleEvent["color"] => {
    if (value === "blue" || value === "emerald" || value === "amber" || value === "violet" || value === "red") {
      return value;
    }

    return "blue";
  };

  const syncSchedulesFromApi = async () => {
    const [eventsBody, roomsBody] = await Promise.all([
      fetchApiJson<{ events?: ScheduleEvent[] }>("/api/schedules/events", { cache: "no-store" }),
      fetchApiJson<{ rooms?: string[] }>("/api/schedules/rooms", { cache: "no-store" }),
    ]);

    const loadedEvents = normalizeLoadedEvents(eventsBody.events ?? [], normalizeColor);
    setEvents(loadedEvents);

    const loadedRooms = normalizeLoadedRooms((roomsBody.rooms ?? []).filter((room) => typeof room === "string" && room.trim().length > 0));
    if (loadedRooms.length > 0) {
      setRoomCatalog(loadedRooms);
      writeSchedulesCache(loadedEvents, loadedRooms);
      return;
    }

    writeSchedulesCache(loadedEvents, roomCatalog);
  };

  // Close week picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (weekPickerRef.current && !weekPickerRef.current.contains(e.target as Node)) {
        setIsWeekPickerOpen(false);
      }
    };

    if (isWeekPickerOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isWeekPickerOpen]);

  // Update current time slot index every minute
  useEffect(() => {
    const updateTimeSlot = () => {
      setCurrentTimeSlotIndex(getCurrentTimeSlotIndex(timeSlots));
    };

    const timer = setInterval(updateTimeSlot, 60000);
    return () => clearInterval(timer);
  }, []);

  // Hydrate from cache before paint so the grid appears instantly while API revalidates.
  useLayoutEffect(() => {
    const cached = readSchedulesCache();
    if (!cached) return;

    const cachedEvents = normalizeLoadedEvents(cached.events, normalizeColor);
    setEvents((prev) => (prev.length ? prev : cachedEvents));

    if (cached.rooms.length > 0) {
      setRoomCatalog((prev) => (prev.length && prev !== rooms ? prev : cached.rooms));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const cached = readSchedulesCache();
    const fallbackRooms = cached?.rooms?.length ? cached.rooms : roomCatalog;

    const loadFromApi = async () => {
      try {
        setRemoteLoadError(null);
        console.info("[Schedules] Loading events and rooms from API");

        const [eventsBody, roomsBody] = await Promise.all([
          fetchApiJson<{ events?: ScheduleEvent[] }>("/api/schedules/events", { cache: "no-store" }),
          fetchApiJson<{ rooms?: string[] }>("/api/schedules/rooms", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        const loadedEvents = normalizeLoadedEvents(eventsBody.events ?? [], normalizeColor);

        setEvents(loadedEvents);

        const loadedRooms = normalizeLoadedRooms((roomsBody.rooms ?? []).filter((room) => typeof room === "string" && room.trim().length > 0));
        if (loadedRooms.length > 0) {
          setRoomCatalog(loadedRooms);
          writeSchedulesCache(loadedEvents, loadedRooms);
        } else {
          writeSchedulesCache(loadedEvents, fallbackRooms.length > 0 ? fallbackRooms : rooms);
        }

        console.info("[Schedules] API load success", {
          events: loadedEvents.length,
          rooms: loadedRooms.length,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("[Schedules] API load failed", error);
        setRemoteLoadError(error instanceof Error ? error.message : "Error cargando horarios");
      }
    };

    void loadFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeSchedulesCache(events, roomCatalog);
  }, [events, roomCatalog]);

  useLayoutEffect(() => {
    const node = gridScrollRef.current;
    if (!node) return;

    const syncWidth = () => {
      setGridViewportWidth(node.clientWidth);
    };

    syncWidth();

    const observer = new ResizeObserver(syncWidth);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  // WebSocket sync para actualización en tiempo real
  useWebSocketSchedules({
    enabled: isSchedulesWsEnabled,
    onScheduleRefresh: () => {
      if (pendingScopedUpdateRef.current || isApplyingScopedUpdateRef.current) {
        return;
      }

      console.log("📡 Refrescando horarios desde WebSocket");
      syncSchedulesFromApi().catch((error) => {
        console.error("Error refrescando horarios:", error);
      });
    },
  });

  const resetCreateForm = () => {
    setCreateError(null);
    setIsCreatingEvent(false);
    setNewEvent(getInitialNewEvent());
  };

  const centerEventInGrid = (eventId: string) => {
    const grid = gridScrollRef.current;
    if (!grid) return false;

    const target = Array.from(grid.querySelectorAll<HTMLElement>("[data-schedule-event-id]"))
      .find((node) => node.dataset.scheduleEventId === eventId);

    if (!target) return false;

    const gridRect = grid.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const desiredLeft =
      grid.scrollLeft + (targetRect.left - gridRect.left) - grid.clientWidth / 2 + targetRect.width / 2;
    const desiredTop =
      grid.scrollTop + (targetRect.top - gridRect.top) - grid.clientHeight / 2 + targetRect.height / 2;

    const maxLeft = Math.max(0, grid.scrollWidth - grid.clientWidth);
    const maxTop = Math.max(0, grid.scrollHeight - grid.clientHeight);

    grid.scrollTo({
      left: Math.max(0, Math.min(desiredLeft, maxLeft)),
      top: Math.max(0, Math.min(desiredTop, maxTop)),
      behavior: "smooth",
    });

    return true;
  };

  useEffect(() => {
    const pendingId = pendingCenterEventIdRef.current;
    if (!pendingId || selectedEventId !== pendingId) return;

    const timer = window.setTimeout(() => {
      const centered = centerEventInGrid(pendingId);
      if (centered) {
        pendingCenterEventIdRef.current = null;
        return;
      }

      requestAnimationFrame(() => {
        if (centerEventInGrid(pendingId)) {
          pendingCenterEventIdRef.current = null;
        }
      });
    }, 60);

    return () => window.clearTimeout(timer);
  }, [selectedEventId, selectedDay, currentWeekStart, events]);

  const filteredRooms = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    if (!query) return roomCatalog;
    return roomCatalog.filter((room) => room.toLowerCase().includes(query));
  }, [roomQuery, roomCatalog]);

  const slotStarts = useMemo(() => timeSlots.map((slot) => slot.split("-")[0]), []);
  const slotEnds = useMemo(() => timeSlots.map((slot) => slot.split("-")[1]), []);

  const startToIndex = useMemo(
    () => Object.fromEntries(slotStarts.map((start, index) => [start, index])),
    [slotStarts]
  );

  const endToExclusiveIndex = useMemo(
    () => Object.fromEntries(slotEnds.map((end, index) => [end, index + 1])),
    [slotEnds]
  );

  const visibleEvents = useMemo(
    () => {
      const selectedDayIndex = weekDays.indexOf(selectedDay);
      if (selectedDayIndex < 0) return [];

      const selectedDate = addDays(currentWeekStart, selectedDayIndex);
      const selectedDateValue = dateValue(selectedDate);
      const selectedDateIso = toIsoLocalDate(selectedDate);
      const matchesVisibleDate = (value: string) => {
        if (value === selectedDateIso) return true;
        const parsedValue = parseIsoDateToLocal(value);
        return dateValue(parsedValue) === selectedDateValue;
      };

      return events
        .map((event) => {
          const override = event.overrides?.find((item) => matchesVisibleDate(item.date));
          const effectiveDay = override?.day ?? event.day;
          const effectiveRoom = resolveRoomFromCatalog(override?.room ?? event.room, roomCatalog);
          const effectiveStart = override?.start ?? event.start;
          const effectiveEnd = override?.end ?? event.end;

          return {
            ...event,
            day: effectiveDay,
            room: effectiveRoom,
            start: effectiveStart,
            end: effectiveEnd,
          };
        })
        .filter((event) => {
          if (normalizeDayKey(event.day) !== normalizeDayKey(selectedDay) || !filteredRooms.includes(event.room)) {
            return false;
          }

          const eventStartValue = dateValue(parseIsoDateToLocal(event.startDate));
          const eventEndValue = dateValue(parseIsoDateToLocal(event.endDate));

          return selectedDateValue >= eventStartValue && selectedDateValue <= eventEndValue;
        });
    },
    [events, selectedDay, filteredRooms, currentWeekStart]
  );

  const selectedDayDateIso = useMemo(() => {
    const selectedDayIndex = weekDays.indexOf(selectedDay);
    if (selectedDayIndex < 0) return toIsoLocalDate(currentWeekStart);
    return toIsoLocalDate(addDays(currentWeekStart, selectedDayIndex));
  }, [currentWeekStart, selectedDay]);

  const applyLocalScopedUpdate = (id: string, updatedEvent: ScheduleEvent, targetDate: string, updateScope: UpdateScope) => {
    if (updateScope === "always") {
      setEvents((current) => current.map((event) => (event.id === id ? updatedEvent : event)));
      return;
    }

    setEvents((current) =>
      current.map((event) => {
        if (event.id !== id) return event;

        const currentOverrides = event.overrides ?? [];
        const nextOverrides = [
          ...currentOverrides.filter((item) => item.date !== targetDate),
          {
            date: targetDate,
            day: updatedEvent.day,
            room: updatedEvent.room,
            start: updatedEvent.start,
            end: updatedEvent.end,
          },
        ];

        return {
          ...event,
          overrides: nextOverrides,
        };
      })
    );
  };

  const clearLocalScopedOverride = (id: string, targetDate: string) => {
    setEvents((current) =>
      current.map((event) => {
        if (event.id !== id) return event;

        return {
          ...event,
          overrides: (event.overrides ?? []).filter((item) => item.date !== targetDate),
        };
      })
    );
  };

  const requestScopedUpdate = (id: string, updatedEvent: ScheduleEvent, source: "drag" | "resize") => {
    const [eventIdFromComposite, slotId] = updatedEvent.id.split(":");
    const eventId = updatedEvent.classId || eventIdFromComposite;

    if (!eventId || !slotId) {
      console.warn(`❌ [${source === "drag" ? "Drag" : "Resize"}] No se pudo obtener eventId o slotId`, {
        eventIdFromComposite,
        slotId,
      });
      return;
    }

    const nextUpdate: PendingScopedUpdate = {
      id,
      eventId,
      slotId,
      targetDate: selectedDayDateIso,
      source,
      updatedEvent,
    };

    const isSingleDayReservation = updatedEvent.startDate === updatedEvent.endDate;
    if (isSingleDayReservation) {
      void (async () => {
        // Optimistic UI to avoid visual snap-back while the request is in flight.
        applyLocalScopedUpdate(nextUpdate.id, nextUpdate.updatedEvent, nextUpdate.targetDate, "always");
        setIsApplyingScopedUpdate(true);
        try {
          await fetchApiJson<{ message: string }>(`/api/schedules/events/${nextUpdate.eventId}/${nextUpdate.slotId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              faculty: nextUpdate.updatedEvent.faculty,
              code: nextUpdate.updatedEvent.code,
              subject: nextUpdate.updatedEvent.subject,
              teacher: nextUpdate.updatedEvent.teacher,
              startDate: nextUpdate.updatedEvent.startDate,
              endDate: nextUpdate.updatedEvent.endDate,
              day: nextUpdate.updatedEvent.day,
              room: nextUpdate.updatedEvent.room,
              start: nextUpdate.updatedEvent.start,
              end: nextUpdate.updatedEvent.end,
              updateScope: "always",
            }),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "No se pudo aplicar la actualización";
          window.alert(message);
          try {
            await syncSchedulesFromApi();
          } catch {
            // noop
          }
        } finally {
          setIsApplyingScopedUpdate(false);
        }
      })();
      return;
    }

    // Only show the modal when explicitly dragging (moving) the event, not on resize
    if (source === "drag") {
      // Apply temporary week override so only the selected date changes while modal is open.
      applyLocalScopedUpdate(nextUpdate.id, nextUpdate.updatedEvent, nextUpdate.targetDate, "week");
      setPendingScopedUpdate(nextUpdate);
    }
  };

  const confirmScopedUpdate = async (updateScope: UpdateScope) => {
    if (!pendingScopedUpdate) return;

    const { id, eventId, slotId, targetDate, source, updatedEvent } = pendingScopedUpdate;
    setIsApplyingScopedUpdate(true);

    try {
      await fetchApiJson<{ message: string }>(`/api/schedules/events/${eventId}/${slotId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          faculty: updatedEvent.faculty,
          code: updatedEvent.code,
          subject: updatedEvent.subject,
          teacher: updatedEvent.teacher,
          startDate: updatedEvent.startDate,
          endDate: updatedEvent.endDate,
          day: updatedEvent.day,
          room: updatedEvent.room,
          start: updatedEvent.start,
          end: updatedEvent.end,
          updateScope,
          ...(updateScope === "week" ? { targetDate } : {}),
        }),
      });

      // For week-scoped updates, refresh from API to ensure UI mirrors persisted overrides.
      if (updateScope === "week") {
        await syncSchedulesFromApi();
      } else {
        applyLocalScopedUpdate(id, updatedEvent, targetDate, updateScope);
      }
      setRemoteLoadError(null);
      setPendingScopedUpdate(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la clase en base de datos";
      console.error(`❌ [${source === "drag" ? "Drag" : "Resize"}] Error al actualizar:`, message);
      setRemoteLoadError(message);
      setPendingScopedUpdate(null);
      if (!message.includes("Solapamiento")) {
        window.alert(message);
      }
      try {
        await syncSchedulesFromApi();
      } catch {
        // noop
      }
    } finally {
      setIsApplyingScopedUpdate(false);
    }
  };

  const weekDates = useMemo(() => {
    const map: Record<string, string> = {};
    weekDays.forEach((day, index) => {
      map[day] = String(addDays(currentWeekStart, index).getDate());
    });
    return map;
  }, [currentWeekStart]);

  const weekRangeLabel = useMemo(() => formatWeekRangeLabel(currentWeekStart), [currentWeekStart]);
  const currentWeekEnd = useMemo(() => addDays(currentWeekStart, 6), [currentWeekStart]);
  const pickerMonthDays = useMemo(() => buildMonthGrid(pickerMonthCursor), [pickerMonthCursor]);
  const isTodayInVisibleWeek = dateValue(colombiaToday) >= dateValue(currentWeekStart) && dateValue(colombiaToday) <= dateValue(currentWeekEnd);
  const showCurrentTimeMarker = normalizeDayKey(selectedDay) === normalizeDayKey(getWeekdayName(colombiaToday)) && isTodayInVisibleWeek;

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const selectedReservationType = selectedEvent ? inferReservationType(selectedEvent) : null;

  const timeColWidth = gridViewportWidth > 0 && gridViewportWidth < 640 ? 78 : 96;
  const roomColWidth = useMemo(() => {
    const roomCount = Math.max(filteredRooms.length, 1);
    const minRoomWidth = gridViewportWidth > 0 && gridViewportWidth < 640 ? 140 : 160;
    const maxRoomWidth = 220;

    if (gridViewportWidth <= 0) return 190;

    const availableWidth = Math.max(gridViewportWidth - timeColWidth, 0);
    if (availableWidth <= 0) return 190;

    const fittedWidth = Math.floor(availableWidth / roomCount);
    return Math.max(minRoomWidth, Math.min(maxRoomWidth, fittedWidth));
  }, [filteredRooms.length, gridViewportWidth, timeColWidth]);
  const headerHeight = 64;
  const slotHeight = 44;

  const safeStartIndex = (start: string) => {
    const idx = startToIndex[start] ?? 0;
    return Math.min(Math.max(0, idx), timeSlots.length - 1);
  };

  const eventGeometry = (event: ScheduleEvent, roomList: string[]) => {
    const roomIndex = roomList.findIndex((room) => room === event.room);
    const startIndex = safeStartIndex(event.start);
    const endExclusive = endToExclusiveIndex[event.end] ?? Math.min(timeSlots.length, startIndex + 2);
    const span = Math.max(1, endExclusive - startIndex);

    return {
      roomIndex,
      startIndex,
      span,
      x: timeColWidth + roomIndex * roomColWidth + 4,
      y: headerHeight + startIndex * slotHeight + 4,
      width: roomColWidth - 8,
      height: span * slotHeight - 8,
    };
  };

  const updateEventPosition = (id: string, x: number, y: number, currentSpan: number) => {
    const newRoomIndex = Math.min(
      filteredRooms.length - 1,
      Math.max(0, Math.round((x - 4 - timeColWidth) / roomColWidth))
    );

    const newStartIndex = Math.min(
      timeSlots.length - 1,
      Math.max(0, Math.round((y - 4 - headerHeight) / slotHeight))
    );

    const newSpan = Math.min(currentSpan, timeSlots.length - newStartIndex);
    const endSlotIndex = Math.min(timeSlots.length - 1, newStartIndex + newSpan - 1);

    const originalEvent = events.find((event) => event.id === id);
    if (!originalEvent) return;

    const updatedEvent: ScheduleEvent = {
      ...originalEvent,
      day: selectedDay,
      room: filteredRooms[newRoomIndex],
      start: slotStarts[newStartIndex],
      end: slotEnds[endSlotIndex],
    };

    const sameDay = normalizeDayKey(updatedEvent.day) === normalizeDayKey(originalEvent.day);
    const sameRoom = updatedEvent.room === originalEvent.room;
    const sameStart = updatedEvent.start === originalEvent.start;
    const sameEnd = updatedEvent.end === originalEvent.end;
    if (sameDay && sameRoom && sameStart && sameEnd) {
      return;
    }

    console.log("🔄 [Drag] Actualizando evento:", {
      id,
      newRoom: updatedEvent.room,
      newStart: updatedEvent.start,
      newEnd: updatedEvent.end,
      targetDate: selectedDayDateIso,
      source: "drag",
    });

    requestScopedUpdate(id, updatedEvent, "drag");
  };

  const handleDragStop = (id: string, span: number): RndDragCallback => {
    return (event, data) => {
      // Prevent double-click or accidental/minimal drags
      if ("detail" in event && typeof event.detail === "number" && event.detail > 1) {
        return;
      }
      
      // Require minimum movement (at least 8 pixels) to count as a drag
      // This prevents accidental drags from clicks or double-clicks
      const minMovement = 8;
      if (Math.abs(data.x) < minMovement && Math.abs(data.y) < minMovement) {
        return;
      }
      
      updateEventPosition(id, data.x, data.y, span);
    };
  };

  const handleResizeStop = (id: string): RndResizeCallback => {
    return (_event, _direction, ref, _delta, position) => {
      const newRoomIndex = Math.min(
        filteredRooms.length - 1,
        Math.max(0, Math.round((position.x - 4 - timeColWidth) / roomColWidth))
      );
      const newStartIndex = Math.min(
        timeSlots.length - 1,
        Math.max(0, Math.round((position.y - 4 - headerHeight) / slotHeight))
      );

      const current = events.find((event) => event.id === id);
      if (!current) return;

      const resizedHeight = ref.offsetHeight;
      const snappedSpan = Math.max(1, Math.round((resizedHeight + 8) / slotHeight));
      const maxSpan = timeSlots.length - newStartIndex;
      const finalSpan = Math.min(maxSpan, snappedSpan);
      const endSlotIndex = Math.min(timeSlots.length - 1, newStartIndex + finalSpan - 1);

      const updatedEvent: ScheduleEvent = {
        ...current,
        day: selectedDay,
        room: filteredRooms[newRoomIndex],
        start: slotStarts[newStartIndex],
        end: slotEnds[endSlotIndex],
      };

      requestScopedUpdate(id, updatedEvent, "resize");
    };
  };

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCreatingEvent) {
      return;
    }

    setCreateError(null);

    const candidateStartDate =
      newEvent.reservationType === "momentanea" ? newEvent.oneDayDate : newEvent.startDate;
    const candidateEndDate =
      newEvent.reservationType === "momentanea" ? newEvent.oneDayDate : newEvent.endDate;
    const forcedMomentaneaDay =
      newEvent.reservationType === "momentanea" && candidateStartDate
        ? getWeekdayName(parseIsoDateToLocal(candidateStartDate))
        : null;

    if (candidateStartDate && candidateEndDate && candidateStartDate > candidateEndDate) {
      const message = "Rango de fechas invalido: la fecha de inicio no puede ser mayor que la fecha de fin.";
      setCreateError(message);
      return;
    }

    if (!newEvent.slots.length) {
      const message = "Debes agregar al menos un horario.";
      setCreateError(message);
      return;
    }

    for (let i = 0; i < newEvent.slots.length; i++) {
      const slot = newEvent.slots[i];
      const effectiveDay = forcedMomentaneaDay ?? slot.day;

      if (!effectiveDay) {
        const message = "Debes seleccionar un dia.";
        setCreateError(message);
        return;
      }

      if (!slot.room) {
        const message = "Debes seleccionar un salon.";
        setCreateError(message);
        return;
      }

      if (!slot.start || !slot.end) {
        const message = "Debes seleccionar hora inicio y hora fin.";
        setCreateError(message);
        return;
      }

      if (!roomCatalog.includes(slot.room)) {
        const message = `Salon invalido en horario ${i + 1}: debes seleccionar un salon de la lista disponible.`;
        setCreateError(message);
        return;
      }

      const slotStartIndex = startToIndex[slot.start] ?? -1;
      const slotEndExclusive = endToExclusiveIndex[slot.end] ?? -1;

      if (slotStartIndex < 0 || slotEndExclusive < 0 || slotEndExclusive <= slotStartIndex) {
        const message = `Horario invalido en bloque ${i + 1}: la hora fin debe ser mayor que la hora inicio.`;
        setCreateError(message);
        return;
      }

      const overlappingClass = events.find((existing) => {
        if (existing.day !== effectiveDay || existing.room !== slot.room) {
          return false;
        }

        if (
          candidateStartDate &&
          candidateEndDate &&
          !dateRangesOverlap(candidateStartDate, candidateEndDate, existing.startDate, existing.endDate)
        ) {
          return false;
        }

        const existingStart = startToIndex[existing.start] ?? -1;
        const existingEnd = endToExclusiveIndex[existing.end] ?? -1;

        if (existingStart < 0 || existingEnd < 0) return false;

        return slotStartIndex < existingEnd && existingStart < slotEndExclusive;
      });

      if (overlappingClass) {
        const message = `Conflicto detectado: ya existe "${overlappingClass.code} | ${overlappingClass.subject}" en ${slot.room} (${effectiveDay}) para ese horario.`;
        setCreateError(message);
        return;
      }

      const overlapInForm = newEvent.slots.some((other, index) => {
        if (index === i) return false;
        const otherEffectiveDay = forcedMomentaneaDay ?? other.day;
        if (otherEffectiveDay !== effectiveDay || other.room !== slot.room) return false;

        const otherStart = startToIndex[other.start] ?? -1;
        const otherEnd = endToExclusiveIndex[other.end] ?? -1;

        if (otherStart < 0 || otherEnd < 0) return false;
        return slotStartIndex < otherEnd && otherStart < slotEndExclusive;
      });

      if (overlapInForm) {
        const message = `Hay solape entre los horarios del formulario en ${slot.room} (${effectiveDay}).`;
        setCreateError(message);
        return;
      }
    }

    if (newEvent.reservationType === "normal") {
      if (!newEvent.faculty || !newEvent.code || !newEvent.subject || !newEvent.teacher) {
        const message = "Completa Facultad, Codigo, Materia y Docente para la reserva normal.";
        setCreateError(message);
        return;
      }
    }

    if (newEvent.reservationType === "momentanea" && !newEvent.subject.trim()) {
      const message = "En reserva por dia debes indicar el motivo o nombre de la reserva.";
      setCreateError(message);
      return;
    }

    if (newEvent.reservationType === "iglesia") {
      if (!newEvent.churchGroup.trim() || !newEvent.churchEvent.trim() || !newEvent.churchContact.trim()) {
        const message = "Para reserva de iglesia completa grupo, actividad y contacto.";
        setCreateError(message);
        return;
      }

      if (!newEvent.startDate || !newEvent.endDate) {
        const message = "Para reserva de iglesia debes seleccionar fecha de inicio y fecha de fin.";
        setCreateError(message);
        return;
      }
    }

    const baseStartDate =
      newEvent.reservationType === "momentanea" ? newEvent.oneDayDate : newEvent.startDate;
    const baseEndDate =
      newEvent.reservationType === "momentanea" ? newEvent.oneDayDate : newEvent.endDate;

    const normalizedFaculty =
      newEvent.reservationType === "normal"
        ? newEvent.faculty
        : newEvent.reservationType === "momentanea"
          ? "Reserva por dia"
          : "Reserva iglesia";

    const normalizedCode =
      newEvent.reservationType === "normal"
        ? newEvent.code
        : newEvent.reservationType === "momentanea"
          ? "RESERVA-DIA"
          : "RESERVA-IGLESIA";

    const normalizedSubject =
      newEvent.reservationType === "normal"
        ? newEvent.subject
        : newEvent.reservationType === "momentanea"
          ? newEvent.subject
          : `${newEvent.churchGroup} - ${newEvent.churchEvent}`;

    const normalizedTeacher =
      newEvent.reservationType === "normal"
        ? newEvent.teacher
        : newEvent.reservationType === "momentanea"
          ? newEvent.teacher || "Reserva temporal"
          : newEvent.churchContact;

    const payloadSlots = newEvent.slots.map((slot) => ({
      day: forcedMomentaneaDay ?? slot.day,
      room: slot.room,
      start: slot.start,
      end: slot.end,
    }));
    const anchorSlot = payloadSlots[0] ?? null;

    setIsCreatingEvent(true);

    try {
      const createResponse = await fetchApiJson<{ message: string; eventId: string }>("/api/schedules/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationType: newEvent.reservationType,
          faculty: normalizedFaculty || "Sin facultad",
          code: normalizedCode || "SIN-CODIGO",
          subject: normalizedSubject || "CLASE NUEVA",
          teacher: normalizedTeacher || "DOCENTE PENDIENTE",
          startDate: baseStartDate,
          endDate: baseEndDate,
          slots: payloadSlots,
        }),
      });

      const normalizeColor = (value: string): ScheduleEvent["color"] => {
        if (value === "blue" || value === "emerald" || value === "amber" || value === "violet" || value === "red") {
          return value;
        }

        return "blue";
      };

      const [eventsBody, roomsBody] = await Promise.all([
        fetchApiJson<{ events?: ScheduleEvent[] }>("/api/schedules/events", { cache: "no-store" }),
        fetchApiJson<{ rooms?: string[] }>("/api/schedules/rooms", { cache: "no-store" }),
      ]);

      const loadedEvents = (eventsBody.events ?? []).map((eventItem) => ({
        ...eventItem,
        color: normalizeColor(eventItem.color),
      }));

      setEvents(loadedEvents);

      const loadedRooms = (roomsBody.rooms ?? []).filter((room) => typeof room === "string" && room.trim().length > 0);
      if (loadedRooms.length > 0) {
        setRoomCatalog(loadedRooms);
      }

      const createdEventByAnchor =
        loadedEvents.find((eventItem) => {
          if (eventItem.classId !== createResponse.eventId) return false;
          if (!anchorSlot) return false;
          return (
            normalizeDayKey(eventItem.day) === normalizeDayKey(anchorSlot.day) &&
            eventItem.room === anchorSlot.room &&
            eventItem.start === anchorSlot.start &&
            eventItem.end === anchorSlot.end
          );
        }) ?? null;

      const createdEvent =
        createdEventByAnchor ??
        loadedEvents.find((eventItem) => eventItem.classId === createResponse.eventId) ??
        loadedEvents.find((eventItem) => {
          if (eventItem.startDate !== baseStartDate) return false;
          if (eventItem.endDate !== baseEndDate) return false;
          if (eventItem.subject !== (normalizedSubject || "CLASE NUEVA")) return false;
          return true;
        });

      const anchorDayLabel =
        weekDays.find((dayLabel) => normalizeDayKey(dayLabel) === normalizeDayKey(anchorSlot?.day ?? "")) ??
        createdEvent?.day ??
        getWeekdayName(parseIsoDateToLocal(baseStartDate));

      setRoomQuery("");
      setCurrentWeekStart(startOfWeekMonday(parseIsoDateToLocal(baseStartDate)));
      setSelectedDay(anchorDayLabel);
      setSelectedEventId(createdEvent?.id ?? null);
      pendingCenterEventIdRef.current = createdEvent?.id ?? null;
      resetCreateForm();
      setIsCreateOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la clase en base de datos";
      setCreateError(message);
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const startEditEvent = () => {
    if (!selectedEvent) return;

    const resolvedRoom = resolveRoomFromCatalog(selectedEvent.room, roomCatalog);

    setEditEvent({
      faculty: selectedEvent.faculty,
      code: selectedEvent.code,
      subject: selectedEvent.subject,
      teacher: selectedEvent.teacher,
      startDate: selectedEvent.startDate,
      endDate: selectedEvent.endDate,
      day: selectedEvent.day,
      room: resolvedRoom,
      start: selectedEvent.start,
      end: selectedEvent.end,
    });
    setEditError(null);
    setIsSavingEdit(false);
    setIsEditMode(true);
  };

  const saveEditEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEvent) return;
    if (isSavingEdit) return;

    setEditError(null);

    const resolvedEditRoom = resolveRoomFromCatalog(editEvent.room, roomCatalog);

    if (!roomCatalog.includes(resolvedEditRoom)) {
      const message = "Salon invalido: debes seleccionar un salon de la lista disponible.";
      setEditError(message);
      window.alert(message);
      return;
    }

    const newStartIndex = startToIndex[editEvent.start] ?? -1;
    const newEndExclusive = endToExclusiveIndex[editEvent.end] ?? -1;

    if (newStartIndex < 0 || newEndExclusive < 0 || newEndExclusive <= newStartIndex) {
      const message = "Horario invalido: la hora fin debe ser mayor que la hora inicio.";
      setEditError(message);
      window.alert(message);
      return;
    }

    const overlappingClass = events.find((existing) => {
      if (existing.id === selectedEvent.id) return false;
      if (existing.day !== editEvent.day || existing.room !== resolvedEditRoom) return false;

      if (!dateRangesOverlap(editEvent.startDate, editEvent.endDate, existing.startDate, existing.endDate)) {
        return false;
      }

      const existingStart = startToIndex[existing.start] ?? -1;
      const existingEnd = endToExclusiveIndex[existing.end] ?? -1;

      if (existingStart < 0 || existingEnd < 0) return false;
      return newStartIndex < existingEnd && existingStart < newEndExclusive;
    });

    if (overlappingClass) {
      const message = `Conflicto detectado: ya existe "${overlappingClass.code} | ${overlappingClass.subject}" en ${resolvedEditRoom} para ese horario.`;
      setEditError(message);
      window.alert(message);
      return;
    }

    const [eventIdFromComposite, slotId] = selectedEvent.id.split(":");
    const eventId = selectedEvent.classId || eventIdFromComposite;

    if (!eventId || !slotId) {
      const message = "No se pudo identificar la clase a modificar.";
      setEditError(message);
      window.alert(message);
      return;
    }

    setIsSavingEdit(true);

    void (async () => {
      try {
        await fetchApiJson<{ message: string }>(`/api/schedules/events/${eventId}/${slotId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            faculty: editEvent.faculty,
            code: editEvent.code,
            subject: editEvent.subject,
            teacher: editEvent.teacher,
            startDate: editEvent.startDate,
            endDate: editEvent.endDate,
            day: editEvent.day,
            room: resolvedEditRoom,
            start: editEvent.start,
            end: editEvent.end,
          }),
        });

        const normalizeColor = (value: string): ScheduleEvent["color"] => {
          if (value === "blue" || value === "emerald" || value === "amber" || value === "violet" || value === "red") {
            return value;
          }
          return "blue";
        };

        const [eventsBody, roomsBody] = await Promise.all([
          fetchApiJson<{ events?: ScheduleEvent[] }>("/api/schedules/events", { cache: "no-store" }),
          fetchApiJson<{ rooms?: string[] }>("/api/schedules/rooms", { cache: "no-store" }),
        ]);

        const loadedEvents = (eventsBody.events ?? []).map((item) => ({
          ...item,
          color: normalizeColor(item.color),
        }));
        setEvents(loadedEvents);

        const loadedRooms = normalizeLoadedRooms(
          (roomsBody.rooms ?? []).filter((room) => typeof room === "string" && room.trim().length > 0)
        );
        if (loadedRooms.length > 0) {
          setRoomCatalog(loadedRooms);
        }

        setSelectedDay(editEvent.day);
        setSelectedEventId(null);
        setEditError(null);
        setIsSavingEdit(false);
        setIsEditMode(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo modificar la clase en base de datos";
        setEditError(message);
        window.alert(message);
        setIsSavingEdit(false);
      }
    })();
  };

  const deleteSelectedEvent = () => {
    if (!selectedEvent || isDeletingEvent) return;
    const accepted = window.confirm(`Eliminar la clase \"${selectedEvent.code} | ${selectedEvent.subject}\"?`);
    if (!accepted) return;

    const [eventIdFromComposite, slotId] = selectedEvent.id.split(":");
    const eventId = selectedEvent.classId || eventIdFromComposite;

    if (!eventId || !slotId) {
      const message = "No se pudo identificar la clase a eliminar.";
      setEditError(message);
      window.alert(message);
      return;
    }

    void (async () => {
      setIsDeletingEvent(true);
      try {
        await fetchApiJson<{ message: string }>(`/api/schedules/events/${eventId}/${slotId}`, {
          method: "DELETE",
        });

        const normalizeColor = (value: string): ScheduleEvent["color"] => {
          if (value === "blue" || value === "emerald" || value === "amber" || value === "violet" || value === "red") {
            return value;
          }
          return "blue";
        };

        const [eventsBody, roomsBody] = await Promise.all([
          fetchApiJson<{ events?: ScheduleEvent[] }>("/api/schedules/events", { cache: "no-store" }),
          fetchApiJson<{ rooms?: string[] }>("/api/schedules/rooms", { cache: "no-store" }),
        ]);

        const loadedEvents = (eventsBody.events ?? []).map((item) => ({
          ...item,
          color: normalizeColor(item.color),
        }));
        setEvents(loadedEvents);

        const loadedRooms = (roomsBody.rooms ?? []).filter((room) => typeof room === "string" && room.trim().length > 0);
        if (loadedRooms.length > 0) {
          setRoomCatalog(loadedRooms);
        }

        setSelectedEventId(null);
        setIsEditMode(false);
        setEditError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo eliminar la clase en base de datos";
        setEditError(message);
        window.alert(message);
      } finally {
        setIsDeletingEvent(false);
      }
    })();
  };

  const canConfirmDeleteAll = deleteAllConfirmText.trim().toLowerCase() === "confirmar";

  const searchAvailableRooms = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const requestedCapacity = Number(availableRoomForm.capacity);
    if (!Number.isFinite(requestedCapacity) || requestedCapacity <= 0) {
      setAvailableRoomsError("Debes ingresar una capacidad valida.");
      return;
    }

    if (availableRoomForm.end <= availableRoomForm.start) {
      setAvailableRoomsError("La hora fin debe ser mayor a la hora inicio.");
      return;
    }

    setIsSearchingAvailableRooms(true);
    setAvailableRoomsError(null);

    try {
      const params = new URLSearchParams({
        date: availableRoomForm.date,
        start: availableRoomForm.start,
        end: availableRoomForm.end,
        capacity: String(requestedCapacity),
      });

      const response = await fetchApiJson<{ rooms?: AvailableRoomResult[] }>(`/api/schedules/rooms/available?${params.toString()}`);
      const rooms = Array.isArray(response.rooms) ? response.rooms : [];
      setAvailableRoomsResult(rooms);
    } catch (error) {
      setAvailableRoomsError(error instanceof Error ? error.message : "No se pudo buscar salones disponibles.");
      setAvailableRoomsResult([]);
    } finally {
      setIsSearchingAvailableRooms(false);
    }
  };

  const confirmDeleteAllSchedules = async () => {
    if (!canConfirmDeleteAll || isDeletingAll) return;

    setIsDeletingAll(true);
    setDeleteAllError(null);

    try {
      await fetchApiJson<{ message: string }>("/api/schedules/all", {
        method: "DELETE",
      });

      setEvents([]);
      setSelectedEventId(null);
      setIsEditMode(false);
      setDeleteAllConfirmText("");
      setIsDeleteAllOpen(false);
    } catch (error) {
      setDeleteAllError(error instanceof Error ? error.message : "No se pudo eliminar el horario");
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="relative z-10 mb-5 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-5">
        {remoteLoadError ? (
          <div className="mb-4 rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <span className="text-lg font-bold text-red-600">⚠️</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 mb-1">Error al actualizar clase</p>
                <p className="text-sm text-red-800 whitespace-pre-wrap">{remoteLoadError}</p>
              </div>
              <button
                onClick={() => setRemoteLoadError(null)}
                className="flex-shrink-0 px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <h1 className="text-base font-bold sm:text-lg">Horario Edificio Bolivar Rave</h1>
          
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-1 lg:justify-center lg:gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#295786]/10 px-3 py-1 text-xs font-semibold text-[#295786] whitespace-nowrap">
                {weekRangeLabel}
              </span>
              <div className="relative" ref={weekPickerRef}>
                <button
                  type="button"
                  onClick={() =>
                    setIsWeekPickerOpen((open) => {
                      const next = !open;
                      if (next) {
                        setPickerMonthCursor(startOfMonth(currentWeekStart));
                      }
                      return next;
                    })
                  }
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
                  title="Seleccionar semana"
                  aria-label="Seleccionar semana"
                >
                  <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                </button>

                {isWeekPickerOpen ? (
                  <div className="absolute left-0 top-11 z-40 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setPickerMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        ←
                      </button>
                      <p className="text-sm font-semibold text-slate-800">
                        {monthNames[pickerMonthCursor.getMonth()]} {pickerMonthCursor.getFullYear()}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPickerMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        →
                      </button>
                    </div>

                    <div className="mb-2 grid grid-cols-7 gap-1">
                      {pickerWeekDays.map((day) => (
                        <div key={`picker-day-${day}`} className="text-center text-[11px] font-semibold text-slate-500">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {pickerMonthDays.map((day) => {
                        const isCurrentMonth = day.getMonth() === pickerMonthCursor.getMonth();
                        const inSelectedWeek = dateValue(day) >= dateValue(currentWeekStart) && dateValue(day) <= dateValue(currentWeekEnd);
                        const isSelectedDay = getWeekdayName(day) === selectedDay && inSelectedWeek;
                        const isToday = dateValue(day) === dateValue(colombiaToday);

                        return (
                          <button
                            key={`picker-date-${day.toISOString()}`}
                            type="button"
                            onClick={() => {
                              const monday = startOfWeekMonday(day);
                              setCurrentWeekStart(monday);
                              setSelectedDay(getWeekdayName(day));
                              setIsWeekPickerOpen(false);
                            }}
                            className={`relative h-8 rounded-md text-xs font-medium transition ${
                              isCurrentMonth ? "text-slate-700 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-50"
                            } ${inSelectedWeek ? "bg-[#295786]/10" : ""} ${isSelectedDay ? "ring-2 ring-[#295786]" : ""} ${isToday ? "font-bold text-[#295786]" : ""}`}
                            title={isToday ? "Hoy (Colombia)" : undefined}
                          >
                            {day.getDate()}
                            {isToday ? <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#295786]" /> : null}
                          </button>
                        );
                      })}
                    </div>

                  </div>
                ) : null}
              </div>
            </div>
            
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 flex-nowrap overflow-x-auto">
              {weekDays.map((day, index) => {
                const thisDayDate = addDays(currentWeekStart, index);
                const isToday = dateValue(thisDayDate) === dateValue(colombiaToday);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                      selectedDay === day ? "bg-[#295786] text-white" : "text-slate-600 hover:bg-white"
                    } ${isToday ? "ring-1 ring-[#295786]/60" : ""}`}
                    title={isToday ? "Hoy (Colombia)" : undefined}
                  >
                    {day.slice(0, 3)} {weekDates[day]}
                    {isToday ? <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#295786] align-middle" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <input
              type="text"
              value={roomQuery}
              onChange={(e) => setRoomQuery(e.target.value)}
              placeholder="Filtrar salón..."
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none ring-[#295786]/30 focus:ring sm:w-56"
            />
            <button
              type="button"
              onClick={() => {
                setAvailableRoomsError(null);
                setAvailableRoomsResult([]);
                setIsAvailableSearchOpen(true);
              }}
              className="h-10 w-full rounded-lg border border-[#295786]/25 bg-[#295786] px-3 text-xs font-semibold text-white transition hover:bg-[#1f456a] sm:w-auto"
            >
              Buscar salón disponible
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section className="relative isolate self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div ref={gridScrollRef} className="overflow-auto" style={{ maxHeight: "75vh" }}>
            <div
              className="relative min-w-max"
              style={{ width: timeColWidth + filteredRooms.length * roomColWidth }}
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `${timeColWidth}px repeat(${filteredRooms.length}, ${roomColWidth}px)`,
                  gridTemplateRows: `${headerHeight}px repeat(${timeSlots.length}, ${slotHeight}px)`,
                }}
              >
                <div className="sticky top-0 left-0 z-30 flex items-center border-r border-b border-slate-200 bg-slate-50 px-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  HORA
                </div>

                {filteredRooms.map((room, roomIndex) => (
                  <div
                    key={`header-${room}-${roomIndex}`}
                    className="sticky top-0 z-20 border-r border-b border-slate-200 bg-white px-3 py-2"
                    suppressHydrationWarning
                  >
                    <p className="line-clamp-2 text-xs font-semibold text-slate-700">{room}</p>
                  </div>
                ))}

                {timeSlots.map((slot, rowIndex) => (
                  <Fragment key={`row-${slot}`}>
                    <div
                      className={`sticky left-0 z-20 border-r border-b px-3 py-2 text-xs font-medium ${
                        rowIndex === currentTimeSlotIndex && showCurrentTimeMarker
                          ? "border-r-red-600 border-b-red-400 border-t-4 border-t-red-600 bg-red-100 font-bold text-red-900"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                      style={{ gridRow: rowIndex + 2, gridColumn: 1 }}
                    >
                      {(() => {
                        const [slotStart = "", slotEnd = ""] = slot.split("-");
                        return `${toAmPmLabel(slotStart)} - ${toAmPmLabel(slotEnd)}`;
                      })()}
                    </div>

                    {filteredRooms.map((room, roomIndex) => (
                      <button
                        key={`${slot}-${room}-${roomIndex}`}
                        type="button"
                        className={`border-r border-b transition-colors ${
                          rowIndex === currentTimeSlotIndex && showCurrentTimeMarker
                            ? "border-t-4 border-t-red-600 bg-red-100 hover:bg-red-200"
                            : "border-slate-100 hover:bg-[#295786]/5"
                        }`}
                        style={{ gridRow: rowIndex + 2, gridColumn: roomIndex + 2 }}
                        onClick={() => setSelectedEventId(null)}
                        title={`${room} - ${(() => {
                          const [slotStart = "", slotEnd = ""] = slot.split("-");
                          return `${toAmPmLabel(slotStart)} - ${toAmPmLabel(slotEnd)}`;
                        })()}`}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>

              {visibleEvents.map((event) => {
                const geom = eventGeometry(event, filteredRooms);
                if (geom.roomIndex < 0) return null;

                const isEventSelected = selectedEventId === event.id;
                const hasEnoughSpace = geom.span >= 4;
                const reservationType = inferReservationType(event);
                const reservationBadge =
                  reservationType === "momentanea"
                    ? "RESERVA DIA"
                    : reservationType === "iglesia"
                      ? "RESERVA IGLESIA"
                      : null;

                return (
                  <Rnd
                    key={event.id}
                    bounds="parent"
                    dragGrid={[roomColWidth, slotHeight]}
                    resizeGrid={[roomColWidth, slotHeight]}
                    disableDragging={!isEventSelected}
                    size={{ width: geom.width, height: geom.height }}
                    position={{ x: geom.x, y: geom.y }}
                    enableResizing={
                      isEventSelected
                        ? {
                            top: true,
                            right: false,
                            bottom: true,
                            left: false,
                            topRight: false,
                            bottomRight: false,
                            bottomLeft: false,
                            topLeft: false,
                          }
                        : {
                            top: false,
                            right: false,
                            bottom: false,
                            left: false,
                            topRight: false,
                            bottomRight: false,
                            bottomLeft: false,
                            topLeft: false,
                          }
                    }
                    onDragStop={handleDragStop(event.id, geom.span)}
                    onResizeStop={handleResizeStop(event.id)}
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setIsEditMode(false);
                      setEditError(null);
                    }}
                    className={`z-10 overflow-hidden rounded-lg border-l-4 p-2 text-left shadow-sm transition hover:shadow-md ${getEventVisualClass(event)} ${
                      isEventSelected ? "ring-2 ring-[#295786] cursor-grab active:cursor-grabbing" : "cursor-pointer"
                    }`}
                    minHeight={slotHeight - 8}
                    minWidth={roomColWidth - 8}
                  >
                    <div data-schedule-event-id={event.id} className="h-full">
                      {reservationBadge ? (
                        <p className="mb-1 inline-flex rounded-full border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-700">
                          {reservationBadge}
                        </p>
                      ) : null}
                      <p className={`text-[11px] font-semibold opacity-80 ${hasEnoughSpace ? "whitespace-normal break-words" : "truncate"}`}>
                        {event.faculty}
                      </p>
                      <p className={`text-sm font-bold ${hasEnoughSpace ? "whitespace-normal break-words" : "truncate"}`}>
                        {event.code} | {event.subject}
                      </p>
                      <p className={`mt-1 text-[11px] font-medium ${hasEnoughSpace ? "whitespace-normal break-words" : "truncate"}`}>
                        {event.teacher}
                      </p>
                      <p className={`text-[11px] ${hasEnoughSpace ? "whitespace-normal" : "truncate"}`}>
                        {event.start} - {event.end}
                      </p>
                    </div>
                  </Rnd>
                );
              })}
            </div>
          </div>
        </section>

        <div className="h-fit self-start xl:sticky xl:top-24">
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setIsCreateOpen(true);
            }}
            className="mb-3 w-full rounded-lg bg-[#295786] px-4 py-3 text-sm font-semibold text-white"
          >
            Agregar nueva clase
          </button>

          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Detalle interactivo</h2>
            <p className="mt-2 text-sm text-slate-600">
              Arrastra bloques para mover clase de salon/hora. Redimensiona arriba o abajo para ampliar/reducir horas.
            </p>

            {selectedEvent ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {!isEditMode ? (
                  <>
                    {isDeletingEvent ? (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Eliminando clase, por favor espera...
                      </div>
                    ) : null}
                    <p className="text-xs font-semibold text-[#295786]">{selectedEvent.day}</p>
                    <p className="mt-1 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {reservationTypeLabels[selectedReservationType ?? "normal"]}
                    </p>
                    <h3 className="mt-1 text-base font-bold">{selectedEvent.code} | {selectedEvent.subject}</h3>
                    <p className="mt-2 text-sm text-slate-600">Facultad: {selectedEvent.faculty}</p>
                    <p className="text-sm text-slate-600">Docente: {selectedEvent.teacher}</p>
                    <p className="text-sm text-slate-600">Salón: {selectedEvent.room}</p>
                    <p className="text-sm text-slate-600">Horario: {selectedEvent.start} - {selectedEvent.end}</p>
                    <p className="text-sm text-slate-600">Rango: {selectedEvent.startDate} a {selectedEvent.endDate}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={startEditEvent}
                        disabled={isDeletingEvent}
                        className="rounded-lg bg-[#295786] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        Modificar datos
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedEvent}
                        disabled={isDeletingEvent}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isDeletingEvent ? "Eliminando..." : "Eliminar clase"}
                      </button>
                    </div>
                  </>
                ) : (
                  <form className="space-y-3" onSubmit={saveEditEvent}>
                  {isSavingEdit && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      Guardando cambios, por favor espera...
                    </div>
                  )}

                  {editError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {editError}
                    </div>
                  )}

                  {selectedReservationType === "normal" ? (
                    <select
                      required
                      value={editEvent.faculty}
                      onChange={(e) => setEditEvent((s) => ({ ...s, faculty: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {!faculties.includes(editEvent.faculty) ? (
                        <option value={editEvent.faculty}>{editEvent.faculty}</option>
                      ) : null}
                      {faculties.map((faculty) => (
                        <option key={`edit-faculty-${faculty}`} value={faculty}>
                          {faculty}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      readOnly
                      value={reservationTypeLabels[selectedReservationType ?? "normal"]}
                      className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                      aria-label="Tipo de reserva"
                    />
                  )}
                  <input
                    required
                    value={editEvent.code}
                    onChange={(e) => setEditEvent((s) => ({ ...s, code: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Código"
                  />
                  <input
                    required
                    value={editEvent.subject}
                    onChange={(e) => setEditEvent((s) => ({ ...s, subject: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Materia"
                  />
                  <input
                    required
                    value={editEvent.teacher}
                    onChange={(e) => setEditEvent((s) => ({ ...s, teacher: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Docente"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      required
                      value={editEvent.startDate}
                      onChange={(e) => setEditEvent((s) => ({ ...s, startDate: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="date"
                      required
                      value={editEvent.endDate}
                      onChange={(e) => setEditEvent((s) => ({ ...s, endDate: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editEvent.day}
                      onChange={(e) => setEditEvent((s) => ({ ...s, day: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {weekDays.map((day) => (
                        <option key={`edit-day-${day}`} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editEvent.room}
                      onChange={(e) => setEditEvent((s) => ({ ...s, room: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {roomCatalog.map((room, index) => (
                        <option key={`edit-room-${index}-${room}`} value={room}>
                          {room}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editEvent.start}
                      onChange={(e) => setEditEvent((s) => ({ ...s, start: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {slotStarts.map((slot) => (
                        <option key={`edit-start-${slot}`} value={slot}>
                          {toAmPmLabel(slot)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editEvent.end}
                      onChange={(e) => setEditEvent((s) => ({ ...s, end: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      {slotEnds.map((slot) => (
                        <option key={`edit-end-${slot}`} value={slot}>
                          {toAmPmLabel(slot)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSavingEdit || isDeletingEvent}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#295786] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSavingEdit ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" aria-hidden="true" />
                      ) : null}
                      {isSavingEdit ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingEdit || isDeletingEvent}
                      onClick={() => {
                        setIsEditMode(false);
                        setEditError(null);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isSavingEdit || isDeletingEvent}
                      onClick={deleteSelectedEvent}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDeletingEvent ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No hay evento seleccionado. Haz click en un bloque para ver su informacion.
              </div>
            )}
          </aside>

          <aside className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Leyenda de colores</h2>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600 uppercase">Por facultad</p>
                <div className="space-y-2">
                  {facultyLegend.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded border-2 ${item.tone}`} />
                      <span className="text-xs text-slate-600">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <p className="mb-2 text-xs font-semibold text-slate-600 uppercase">Por tipo de reserva</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-8 rounded border-2 border-slate-400 bg-gradient-to-br from-blue-50 to-blue-100" />
                    <span className="text-xs text-slate-600">Reserva semestre</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-5 w-8 rounded border-2 border-dashed border-amber-700 bg-white" />
                    <span className="text-xs text-slate-600">Reserva por día</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-5 w-8 rounded border-2 border-slate-900 bg-white" />
                    <span className="text-xs text-slate-600">Fuera del ámbito</span>
                  </div>
                  <div className="ml-10 text-xs text-slate-600">académico</div>
                </div>
              </div>
            </div>
          </aside>

          <button
            type="button"
            onClick={() => {
              setDeleteAllError(null);
              setDeleteAllConfirmText("");
              setIsDeleteAllOpen(true);
            }}
            className="mt-3 w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100"
          >
            Eliminar horario completo
          </button>
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={createEvent} aria-busy={isCreatingEvent} className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Agregar nueva clase</h3>
            <p className="mt-1 text-sm text-slate-500">
              Formato antiguo: Facultad : CODIGO | MATERIA | DOCENTE | FECHA INICIO | FECHA FIN
            </p>

            {isCreatingEvent && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" aria-hidden="true" />
                Guardando clase, por favor espera...
              </div>
            )}

            {createError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de reserva</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={newEvent.reservationType}
                  onChange={(e) =>
                    setNewEvent((s) => ({
                      ...s,
                      reservationType: e.target.value as ReservationType,
                    }))
                  }
                >
                  <option value="normal">Reserva normal (semestre)</option>
                  <option value="momentanea">Reserva por dia (momentanea)</option>
                  <option value="iglesia">Reserva fuera del ambito academico (iglesia)</option>
                </select>
              </div>

              {newEvent.reservationType === "normal" ? (
                <>
                  <select
                    required
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={newEvent.faculty}
                    onChange={(e) => setNewEvent((s) => ({ ...s, faculty: e.target.value }))}
                  >
                    {faculties.map((faculty) => (
                      <option key={`create-faculty-${faculty}`} value={faculty}>
                        {faculty}
                      </option>
                    ))}
                  </select>
                  <input required placeholder="Codigo" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.code} onChange={(e) => setNewEvent((s) => ({ ...s, code: e.target.value }))} />
                  <input required placeholder="Materia" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={newEvent.subject} onChange={(e) => setNewEvent((s) => ({ ...s, subject: e.target.value }))} />
                  <input required placeholder="Docente" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={newEvent.teacher} onChange={(e) => setNewEvent((s) => ({ ...s, teacher: e.target.value }))} />
                  <input required type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.startDate} onChange={(e) => setNewEvent((s) => ({ ...s, startDate: e.target.value }))} />
                  <input required type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.endDate} onChange={(e) => setNewEvent((s) => ({ ...s, endDate: e.target.value }))} />
                </>
              ) : null}

              {newEvent.reservationType === "momentanea" ? (
                <>
                  <input required placeholder="Motivo de la reserva" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={newEvent.subject} onChange={(e) => setNewEvent((s) => ({ ...s, subject: e.target.value }))} />
                  <input placeholder="Responsable (opcional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={newEvent.teacher} onChange={(e) => setNewEvent((s) => ({ ...s, teacher: e.target.value }))} />
                  <input required type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={newEvent.oneDayDate} onChange={(e) => setNewEvent((s) => ({ ...s, oneDayDate: e.target.value }))} />
                </>
              ) : null}

              {newEvent.reservationType === "iglesia" ? (
                <>
                  <input required placeholder="Nombre del grupo" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.churchGroup} onChange={(e) => setNewEvent((s) => ({ ...s, churchGroup: e.target.value }))} />
                  <input required placeholder="Actividad" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.churchEvent} onChange={(e) => setNewEvent((s) => ({ ...s, churchEvent: e.target.value }))} />
                  <input required placeholder="Contacto responsable" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={newEvent.churchContact} onChange={(e) => setNewEvent((s) => ({ ...s, churchContact: e.target.value }))} />
                  <input required type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.startDate} onChange={(e) => setNewEvent((s) => ({ ...s, startDate: e.target.value }))} />
                  <input required type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.endDate} onChange={(e) => setNewEvent((s) => ({ ...s, endDate: e.target.value }))} />
                </>
              ) : null}

              <div className="sm:col-span-2 mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Horarios de esta clase</p>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                    onClick={() =>
                      setNewEvent((s) => ({
                        ...s,
                        slots: [...s.slots, getInitialSlot()],
                      }))
                    }
                  >
                    + Agregar horario
                  </button>
                </div>

                <div className="space-y-3">
                  {newEvent.slots.map((slot, index) => (
                    <div key={`new-slot-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-500">Horario {index + 1}</p>
                        {newEvent.slots.length > 1 ? (
                          <button
                            type="button"
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700"
                            onClick={() =>
                              setNewEvent((s) => ({
                                ...s,
                                slots: s.slots.filter((_, slotIndex) => slotIndex !== index),
                              }))
                            }
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={slot.day}
                          onChange={(e) =>
                            setNewEvent((s) => ({
                              ...s,
                              slots: s.slots.map((currentSlot, slotIndex) =>
                                slotIndex === index ? { ...currentSlot, day: e.target.value } : currentSlot
                              ),
                            }))
                          }
                        >
                          <option value="">Selecciona dia</option>
                          {weekDays.map((day) => (
                            <option key={`day-${index}-${day}`} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>

                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={slot.room}
                          onChange={(e) =>
                            setNewEvent((s) => ({
                              ...s,
                              slots: s.slots.map((currentSlot, slotIndex) =>
                                slotIndex === index ? { ...currentSlot, room: e.target.value } : currentSlot
                              ),
                            }))
                          }
                        >
                          <option value="">Selecciona salon</option>
                          {roomCatalog.map((room, roomIndex) => (
                            <option key={`room-${index}-${roomIndex}`} value={room}>
                              {room}
                            </option>
                          ))}
                        </select>

                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={slot.start}
                          onChange={(e) =>
                            setNewEvent((s) => ({
                              ...s,
                              slots: s.slots.map((currentSlot, slotIndex) =>
                                slotIndex === index ? { ...currentSlot, start: e.target.value } : currentSlot
                              ),
                            }))
                          }
                        >
                          <option value="">Selecciona hora inicio</option>
                          {slotStarts.map((slotStart) => (
                            <option key={`slot-start-${index}-${slotStart}`} value={slotStart}>
                              {toAmPmLabel(slotStart)}
                            </option>
                          ))}
                        </select>

                        <select
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={slot.end}
                          onChange={(e) =>
                            setNewEvent((s) => ({
                              ...s,
                              slots: s.slots.map((currentSlot, slotIndex) =>
                                slotIndex === index ? { ...currentSlot, end: e.target.value } : currentSlot
                              ),
                            }))
                          }
                        >
                          <option value="">Selecciona hora fin</option>
                          {slotEnds.map((slotEnd) => (
                            <option key={`slot-end-${index}-${slotEnd}`} value={slotEnd}>
                              {toAmPmLabel(slotEnd)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isCreatingEvent}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  resetCreateForm();
                  setIsCreateOpen(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingEvent}
                className="inline-flex items-center gap-2 rounded-lg bg-[#295786] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isCreatingEvent ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" aria-hidden="true" />
                ) : null}
                {isCreatingEvent ? "Guardando..." : "Guardar clase"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isAvailableSearchOpen && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Buscar salón disponible</h3>
                <p className="mt-1 text-sm text-slate-600">Indica día, rango de horas y cantidad de personas.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvailableSearchOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={searchAvailableRooms} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <input
                type="date"
                required
                value={availableRoomForm.date}
                onChange={(e) => setAvailableRoomForm((prev) => ({ ...prev, date: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                required
                value={availableRoomForm.start}
                onChange={(e) => setAvailableRoomForm((prev) => ({ ...prev, start: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {slotStarts.map((slotStart) => (
                  <option key={`available-start-${slotStart}`} value={slotStart}>
                    {toAmPmLabel(slotStart)}
                  </option>
                ))}
              </select>
              <select
                required
                value={availableRoomForm.end}
                onChange={(e) => setAvailableRoomForm((prev) => ({ ...prev, end: e.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {slotEnds.map((slotEnd) => (
                  <option key={`available-end-${slotEnd}`} value={slotEnd}>
                    {toAmPmLabel(slotEnd)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                required
                value={availableRoomForm.capacity}
                onChange={(e) => setAvailableRoomForm((prev) => ({ ...prev, capacity: e.target.value }))}
                placeholder="Personas"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />

              <div className="sm:col-span-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSearchingAvailableRooms}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#295786] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSearchingAvailableRooms ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" aria-hidden="true" />
                  ) : null}
                  {isSearchingAvailableRooms ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </form>

            {availableRoomsError ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{availableRoomsError}</p>
            ) : null}

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
              {availableRoomsResult.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                  {isSearchingAvailableRooms ? "Buscando salones..." : "Aun no hay resultados. Ejecuta una busqueda."}
                </p>
              ) : (
                availableRoomsResult.map((room) => (
                  <div key={`${room.room}-${room.floor}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{room.room}</p>
                      <p className="text-xs text-slate-500">Piso {room.floor > 0 ? room.floor : "N/D"} • Capacidad {room.capacity}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRoomQuery(room.room);
                        setIsAvailableSearchOpen(false);
                      }}
                      className="rounded-md border border-[#295786]/30 px-3 py-1.5 text-xs font-semibold text-[#295786] hover:bg-[#295786]/10"
                    >
                      Filtrar este salón
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isDeleteAllOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Eliminar todo el horario</h3>
            <p className="mt-2 text-sm text-slate-600">
              Esta accion elimina todos los eventos y bloques horarios actuales. Escribe <strong>confirmar</strong> para continuar.
            </p>

            <input
              type="text"
              value={deleteAllConfirmText}
              onChange={(e) => setDeleteAllConfirmText(e.target.value)}
              placeholder="Escribe confirmar"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            {deleteAllError ? (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deleteAllError}</p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isDeletingAll) return;
                  setIsDeleteAllOpen(false);
                  setDeleteAllConfirmText("");
                  setDeleteAllError(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllSchedules}
                disabled={!canConfirmDeleteAll || isDeletingAll}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingAll ? "Eliminando..." : "Confirmar eliminacion"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingScopedUpdate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Aplicar cambio de horario</h3>
            <p className="mt-2 text-sm text-slate-600">
              Elige si este cambio se aplica solo a esta semana o a todas las semanas del evento.
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-800">Vista previa</p>
              <p className="mt-1">Día: {pendingScopedUpdate.updatedEvent.day}</p>
              <p>Salón: {pendingScopedUpdate.updatedEvent.room}</p>
              <p>Horario: {pendingScopedUpdate.updatedEvent.start} - {pendingScopedUpdate.updatedEvent.end}</p>
              <p>Fecha actual: {pendingScopedUpdate.targetDate}</p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  // Revert only the temporary week override when user cancels.
                  if (pendingScopedUpdate) {
                    clearLocalScopedOverride(pendingScopedUpdate.id, pendingScopedUpdate.targetDate);
                  }
                  setPendingScopedUpdate(null);
                }}
                disabled={isApplyingScopedUpdate}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmScopedUpdate("week");
                }}
                disabled={isApplyingScopedUpdate}
                className="rounded-lg border border-[#295786]/30 bg-[#295786]/10 px-4 py-2 text-sm font-semibold text-[#295786] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingScopedUpdate ? "Aplicando..." : "Solo esta semana"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmScopedUpdate("always");
                }}
                disabled={isApplyingScopedUpdate}
                className="rounded-lg bg-[#295786] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isApplyingScopedUpdate ? "Aplicando..." : "Para siempre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
