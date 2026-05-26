"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";
import { readAuthSession } from "@/lib/auth-session";
import { useWebSocketSchedules } from "@/lib/use-websocket-schedules";
import toast from "react-hot-toast";
import { confirmToast } from "@/lib/toast-dialog";

type AuditorioEstado = "Pendiente" | "Aprobada" | "Cancelada";

type ScheduleBlock = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

type AuditoriumEvent = {
  id: string;
  title: string;
  organizer: string;
  periodStartDate: string;
  periodEndDate: string;
  status: AuditorioEstado;
  attendees: number;
  needsScreen: boolean;
  needsSound: boolean;
  needsMonitor: boolean;
  needsProjector: boolean;
  needsWaterFilter: boolean;
  assignedWorkers: Array<{
    staffId: string;
    cedula: string;
    numeroStaff: number;
    nombreCompleto: string;
    rol: string;
    estado: string;
  }>;
  observations: string;
  color: "blue" | "emerald" | "amber";
  scheduleBlocks: ScheduleBlock[];
};

type AuditorioReservaApi = {
  id: string;
  nombreEvento: string;
  organizador: string;
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
  numeroAsistentes: number;
  requierePantalla: boolean;
  requiereSonido: boolean;
  requiereMonitor: boolean;
  requiereProyector: boolean;
  requiereFiltroAgua: boolean;
  observaciones: string | null;
  estado: AuditorioEstado;
  fechaCreacion: string;
  encargados?: Array<{
    staffId: string;
    cedula: string;
    numeroStaff: number;
    nombreCompleto: string;
    rol: string;
    estado: string;
  }>;
  horarios: Array<{
    id: string;
    fechaEspecifica: string;
    horaInicio: string;
    horaFin: string;
  }>;
};

type StaffApi = {
  id: string;
  cedula: string;
  numeroStaff: number;
  rol: string;
  nombres: string;
  apellidos: string;
  estado: string;
};

type NewEventFormState = {
  title: string;
  organizer: string;
  startDate: string;
  endDate: string;
  status: AuditorioEstado | "";
  attendees: string;
  needsScreen: boolean;
  needsSound: boolean;
  needsMonitor: boolean;
  needsProjector: boolean;
  needsWaterFilter: boolean;
  assignedStaffIds: string[];
  observations: string;
  scheduleBlocks: ScheduleBlock[];
};

type FormFieldErrors = Record<string, string>;

type WeekSegment = {
  event: AuditoriumEvent;
  startCol: number;
  endCol: number;
  lane: number;
};

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const DAY_MS = 24 * 60 * 60 * 1000;

const eventStyles: Record<AuditoriumEvent["color"], string> = {
  blue: "bg-blue-100 text-blue-900",
  emerald: "bg-emerald-100 text-emerald-900",
  amber: "bg-amber-100 text-amber-900",
};

function parseISODate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(dateA: Date, dateB: Date) {
  const a = stripTime(dateA).getTime();
  const b = stripTime(dateB).getTime();
  return Math.round((a - b) / DAY_MS);
}

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

function buildMonthGrid(monthDate: Date) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = addDays(monthStart, -mondayIndex(monthStart));
  const gridEnd = addDays(monthEnd, 6 - mondayIndex(monthEnd));

  const days: Date[] = [];
  for (let date = new Date(gridStart); date <= gridEnd; date = addDays(date, 1)) {
    days.push(new Date(date));
  }
  return days;
}

function chunkWeeks(days: Date[]) {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function formatDateLabel(date: Date) {
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function getEventBounds(event: AuditoriumEvent) {
  const dates = event.scheduleBlocks.map((block) => parseISODate(block.date).getTime());
  const minTime = Math.min(...dates);
  const maxTime = Math.max(...dates);
  return { start: new Date(minTime), end: new Date(maxTime) };
}

function getEventResourcesLabel(event: AuditoriumEvent) {
  const resources = [
    event.needsScreen ? "Pantalla" : null,
    event.needsSound ? "Sonido" : null,
    event.needsMonitor ? "Monitor" : null,
    event.needsProjector ? "Proyector" : null,
    event.needsWaterFilter ? "Filtro de agua" : null,
  ].filter((resource): resource is string => Boolean(resource));

  if (resources.length === 0) {
    return "Sin recursos adicionales";
  }

  if (resources.length === 1) {
    return resources[0];
  }

  if (resources.length === 2) {
    return `${resources[0]} y ${resources[1]}`;
  }

  return `${resources.slice(0, -1).join(", ")} y ${resources[resources.length - 1]}`;
}

function getStaffPhotoUrl(cedula: string) {
  return `/api/staff-photo/${encodeURIComponent(cedula)}`;
}

function getStaffInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function overlapsByTime(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

function formatTimeAmPm(value: string) {
  if (!value) return "";

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

const TIME_SLOT_OPTIONS = Array.from({ length: ((23 * 60 + 30) - (5 * 60)) / 30 + 1 }, (_, index) => {
  const totalMinutes = 5 * 60 + index * 30;
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minute = String(totalMinutes % 60).padStart(2, "0");
  const value = `${hour}:${minute}`;

  return {
    value,
    label: formatTimeAmPm(value),
  };
});

function colorFromEstado(estado: AuditorioEstado): AuditoriumEvent["color"] {
  if (estado === "Aprobada") return "emerald";
  if (estado === "Pendiente") return "amber";
  return "blue";
}

function mapReservaToEvent(reserva: AuditorioReservaApi): AuditoriumEvent {
  return {
    id: reserva.id,
    title: reserva.nombreEvento,
    organizer: reserva.organizador,
    periodStartDate: reserva.fechaInicioPeriodo,
    periodEndDate: reserva.fechaFinPeriodo,
    status: reserva.estado,
    attendees: reserva.numeroAsistentes,
    needsScreen: reserva.requierePantalla,
    needsSound: reserva.requiereSonido,
    needsMonitor: reserva.requiereMonitor,
    needsProjector: reserva.requiereProyector,
    needsWaterFilter: reserva.requiereFiltroAgua,
    assignedWorkers: reserva.encargados ?? [],
    observations: reserva.observaciones ?? "",
    color: colorFromEstado(reserva.estado),
    scheduleBlocks: reserva.horarios
      .slice()
      .sort((a, b) => a.fechaEspecifica.localeCompare(b.fechaEspecifica) || a.horaInicio.localeCompare(b.horaInicio))
      .map((block) => ({
        id: block.id,
        date: block.fechaEspecifica,
        startTime: block.horaInicio,
        endTime: block.horaFin,
      })),
  };
}

function getWeekSegments(week: Date[], events: AuditoriumEvent[]) {
  if (week.length < 7) return [];

  const weekStart = stripTime(week[0]);
  const weekEnd = stripTime(week[6]);
  const weekKeyToIndex = Object.fromEntries(week.map((date, index) => [toDateKey(date), index]));

  const baseSegments: Array<{ event: AuditoriumEvent; startCol: number; endCol: number }> = [];

  events.forEach((event) => {
    const activeIndices = Array.from(
      new Set(
        event.scheduleBlocks
          .map((block) => stripTime(parseISODate(block.date)))
          .filter((date) => date >= weekStart && date <= weekEnd)
          .map((date) => weekKeyToIndex[toDateKey(date)])
          .filter((index): index is number => typeof index === "number")
      )
    ).sort((a, b) => a - b);

    if (activeIndices.length === 0) return;

    let rangeStart = activeIndices[0];
    let previous = activeIndices[0];

    for (let i = 1; i < activeIndices.length; i += 1) {
      const current = activeIndices[i];
      if (current === previous + 1) {
        previous = current;
      } else {
        baseSegments.push({ event, startCol: rangeStart, endCol: previous });
        rangeStart = current;
        previous = current;
      }
    }

    baseSegments.push({ event, startCol: rangeStart, endCol: previous });
  });

  baseSegments.sort((a, b) => {
    if (a.startCol === b.startCol) return b.endCol - a.endCol;
    return a.startCol - b.startCol;
  });

  const laneEnds: number[] = [];
  const positioned: WeekSegment[] = [];

  baseSegments.forEach((segment) => {
    let lane = 0;
    while (lane < laneEnds.length && segment.startCol <= laneEnds[lane]) {
      lane += 1;
    }

    if (lane === laneEnds.length) laneEnds.push(segment.endCol);
    else laneEnds[lane] = segment.endCol;

    positioned.push({ ...segment, lane });
  });

  return positioned;
}

function createEmptyFormState(defaultDate: string): NewEventFormState {
  return {
    title: "",
    organizer: "",
    startDate: defaultDate,
    endDate: defaultDate,
    status: "",
    attendees: "",
    needsScreen: false,
    needsSound: false,
    needsMonitor: false,
    needsProjector: false,
    needsWaterFilter: false,
    assignedStaffIds: [],
    observations: "",
    scheduleBlocks: [
      {
        id: "new-b1",
        date: defaultDate,
        startTime: "08:00",
        endTime: "10:00",
      },
    ],
  };
}

export default function AuditorioPage() {
  const monthPickerRef = useRef<HTMLDivElement>(null);
  const session = readAuthSession();
  const canManageAuditorio = session?.role === "admin";

  const colombiaToday = useMemo(() => getColombiaToday(), []);
  const defaultDateKey = useMemo(() => toDateKey(colombiaToday), [colombiaToday]);

  const [events, setEvents] = useState<AuditoriumEvent[]>([]);
  const [staffCatalog, setStaffCatalog] = useState<StaffApi[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(startOfMonth(colombiaToday));
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formState, setFormState] = useState<NewEventFormState>(createEmptyFormState(defaultDateKey));
  const [scheduleMode, setScheduleMode] = useState<"" | "single" | "multi">("");
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(colombiaToday.getFullYear());
  const [visibleMonthCount, setVisibleMonthCount] = useState(2);
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>("");

  const syncReservas = useCallback(async () => {
    const response = await fetchApiJson<{ reservas?: AuditorioReservaApi[] }>("/api/auditorio/reservas", {
      cache: "no-store",
    });

    const loaded = (response.reservas ?? []).map(mapReservaToEvent);
    setEvents(loaded);

    setSelectedEventId((current) => {
      if (current && loaded.some((event) => event.id === current)) {
        return current;
      }
      return null;
    });
  }, []);

  const syncStaffCatalog = useCallback(async () => {
    if (!canManageAuditorio) {
      setStaffCatalog([]);
      return;
    }

    const response = await fetchApiJson<{ staff?: StaffApi[] }>("/api/staff", {
      cache: "no-store",
    });

    setStaffCatalog(response.staff ?? []);
  }, [canManageAuditorio]);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        await Promise.all([syncReservas(), syncStaffCatalog()]);
      } catch (error) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "No se pudo cargar reservas del auditorio";
        setLoadError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [syncReservas, syncStaffCatalog]);

  const handleRealtimeRefresh = useCallback(() => {
    syncReservas().catch((error) => {
      const message = error instanceof Error ? error.message : "No se pudo actualizar auditorio en tiempo real";
      setLoadError(message);
    });
  }, [syncReservas]);

  useWebSocketSchedules({
    onScheduleRefresh: handleRealtimeRefresh,
  });

  // Fallback de auto-actualizacion para no depender solo del socket.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      handleRealtimeRefresh();
    }, 15000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        handleRealtimeRefresh();
      }
    };

    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", handleRealtimeRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", handleRealtimeRefresh);
    };
  }, [handleRealtimeRefresh]);

  // Close month picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };

    if (isMonthPickerOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isMonthPickerOpen]);

  useEffect(() => {
    const syncVisibleMonthCount = () => {
      setVisibleMonthCount(window.innerWidth < 768 ? 1 : 2);
    };

    syncVisibleMonthCount();
    window.addEventListener("resize", syncVisibleMonthCount);

    return () => window.removeEventListener("resize", syncVisibleMonthCount);
  }, []);

  const monthsToShow = useMemo(
    () => Array.from({ length: visibleMonthCount }, (_, offset) => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + offset, 1)),
    [monthCursor, visibleMonthCount]
  );

  const eventMapByDay = useMemo(
    () =>
      events.reduce<Record<string, AuditoriumEvent[]>>((acc, event) => {
        event.scheduleBlocks.forEach((block) => {
          const key = toDateKey(parseISODate(block.date));
          if (!acc[key]) acc[key] = [];
          if (!acc[key].some((existing) => existing.id === event.id)) acc[key].push(event);
        });
        return acc;
      }, {}),
    [events]
  );

  const periodLabel =
    monthsToShow.length === 1
      ? `${monthNames[monthsToShow[0].getMonth()]} ${monthsToShow[0].getFullYear()}`
      : `${monthNames[monthsToShow[0].getMonth()]} ${monthsToShow[0].getFullYear()} - ${monthNames[monthsToShow[1].getMonth()]} ${monthsToShow[1].getFullYear()}`;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;
  const visibleMultiDates = scheduleMode === "multi" ? getDatesBetweenKeys(formState.startDate, formState.endDate) : [];
  const selectedScheduleDateKeys = new Set(formState.scheduleBlocks.map((block) => block.date));
  const orderedScheduleBlocks = [...formState.scheduleBlocks].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
  );

  const formatOverlapMessage = (detail: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => {
    const readableDate = formatDateLabel(parseISODate(detail.date));
    return `No pudimos guardar esta reserva porque el auditorio ya esta ocupado.\n\nCoincide con: ${detail.title}\nFecha: ${readableDate}\nHorario: ${detail.startTime} - ${detail.endTime}\n\nElige otro horario o ajusta la reserva existente.`;
  };

  const hasOverlapWithOtherEvents = (
    scheduleBlocks: ScheduleBlock[],
    ignoreEventId: string | null = null
  ) => {
    for (const block of scheduleBlocks) {
      for (const existing of events) {
        if (ignoreEventId && existing.id === ignoreEventId) continue;

        for (const existingBlock of existing.scheduleBlocks) {
          if (existingBlock.date !== block.date) continue;
          if (overlapsByTime(block.startTime, block.endTime, existingBlock.startTime, existingBlock.endTime)) {
            return {
              title: existing.title,
              date: existingBlock.date,
              startTime: existingBlock.startTime,
              endTime: existingBlock.endTime,
            };
          }
        }
      }
    }

    return null;
  };

  const mapFormToPayload = (state: NewEventFormState) => ({
    nombreEvento: state.title.trim(),
    organizador: state.organizer.trim(),
    fechaInicioPeriodo: state.startDate,
    fechaFinPeriodo: state.endDate,
    numeroAsistentes: Number(state.attendees) || 1,
    requierePantalla: state.needsScreen,
    requiereSonido: state.needsSound,
    requiereMonitor: state.needsMonitor,
    requiereProyector: state.needsProjector,
    requiereFiltroAgua: state.needsWaterFilter,
    encargadoStaffIds: Array.from(new Set(state.assignedStaffIds)),
    observaciones: state.observations.trim() || null,
    estado: state.status as AuditorioEstado,
    horarios: state.scheduleBlocks
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .map((block) => ({
        fechaEspecifica: block.date,
        horaInicio: block.startTime,
        horaFin: block.endTime,
      })),
  });

  const clearFieldError = (key: string) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const openEditModal = () => {
    if (!canManageAuditorio) return;
    if (!selectedEvent) return;

    setEditingEventId(selectedEvent.id);
    setFormError(null);
    setFieldErrors({});
    setFormState({
      title: selectedEvent.title,
      organizer: selectedEvent.organizer,
      startDate: selectedEvent.periodStartDate,
      endDate: selectedEvent.periodEndDate,
      status: selectedEvent.status,
      attendees: String(selectedEvent.attendees),
      needsScreen: selectedEvent.needsScreen,
      needsSound: selectedEvent.needsSound,
      needsMonitor: selectedEvent.needsMonitor,
      needsProjector: selectedEvent.needsProjector,
      needsWaterFilter: selectedEvent.needsWaterFilter,
      assignedStaffIds: selectedEvent.assignedWorkers.map((worker) => worker.staffId),
      observations: selectedEvent.observations,
      scheduleBlocks: selectedEvent.scheduleBlocks.map((block, index) => ({
        ...block,
        id: `edit-b${index + 1}-${Date.now()}`,
      })),
    });
    const isSingle = selectedEvent.periodStartDate === selectedEvent.periodEndDate && selectedEvent.scheduleBlocks.length <= 1;
    setScheduleMode(isSingle ? "single" : "multi");
    setIsCreateOpen(true);
  };

  function openCreateModal() {
    if (!canManageAuditorio) return;
    setEditingEventId(null);
    setFormError(null);
    setFieldErrors({});
    setScheduleMode("");
    setFormState(createEmptyFormState(defaultDateKey));
    setIsCreateOpen(true);
  }

  function openMonthPicker() {
    setPickerYear(monthCursor.getFullYear());
    setIsMonthPickerOpen(true);
  }

  function closeCreateModal() {
    if (isSaving) return;
    setIsCreateOpen(false);
    setEditingEventId(null);
    setFormError(null);
    setFieldErrors({});
    setScheduleMode("");
  }

  function moveEventToDate(eventId: string, newStartDate: Date) {
    if (!canManageAuditorio) return;
    const sourceEvent = events.find((event) => event.id === eventId);
    if (!sourceEvent) return;

    const originalDates = sourceEvent.scheduleBlocks
      .map((block) => parseISODate(block.date))
      .sort((a, b) => a.getTime() - b.getTime());

    if (originalDates.length === 0) return;

    const delta = diffDays(newStartDate, originalDates[0]);
    const shiftedBlocks = sourceEvent.scheduleBlocks.map((block) => ({
      ...block,
      date: toDateKey(addDays(parseISODate(block.date), delta)),
    }));
    const shiftedPeriodStart = toDateKey(addDays(parseISODate(sourceEvent.periodStartDate), delta));
    const shiftedPeriodEnd = toDateKey(addDays(parseISODate(sourceEvent.periodEndDate), delta));

    const overlapWith = hasOverlapWithOtherEvents(shiftedBlocks, eventId);
    if (overlapWith) {
      toast.error(formatOverlapMessage(overlapWith));
      return;
    }

    const previousEvents = events;
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId
          ? {
              ...event,
              periodStartDate: shiftedPeriodStart,
              periodEndDate: shiftedPeriodEnd,
              scheduleBlocks: shiftedBlocks,
            }
          : event
      )
    );

    void (async () => {
      try {
        await fetchApiJson<{ message: string }>(`/api/auditorio/reservas/${eventId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombreEvento: sourceEvent.title,
            organizador: sourceEvent.organizer,
            fechaInicioPeriodo: shiftedPeriodStart,
            fechaFinPeriodo: shiftedPeriodEnd,
            numeroAsistentes: sourceEvent.attendees,
            requierePantalla: sourceEvent.needsScreen,
            requiereSonido: sourceEvent.needsSound,
            requiereMonitor: sourceEvent.needsMonitor,
            requiereProyector: sourceEvent.needsProjector,
            requiereFiltroAgua: sourceEvent.needsWaterFilter,
            encargadoStaffIds: sourceEvent.assignedWorkers.map((worker) => worker.staffId),
            observaciones: sourceEvent.observations || null,
            estado: sourceEvent.status,
            horarios: shiftedBlocks.map((block) => ({
              fechaEspecifica: block.date,
              horaInicio: block.startTime,
              horaFin: block.endTime,
            })),
          }),
        });

        setLoadError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo mover la reserva";
        setLoadError(message);
        toast.error(message);
        setEvents(previousEvents);
      }
    })();
  }

  function updateScheduleBlock(blockId: string, field: keyof ScheduleBlock, value: string) {
    clearFieldError("scheduleBlocks");
    if (field === "date") clearFieldError(`block-${blockId}-date`);
    if (field === "startTime") clearFieldError(`block-${blockId}-startTime`);
    if (field === "endTime") clearFieldError(`block-${blockId}-endTime`);
    clearFieldError(`block-${blockId}-range`);

    setFormState((current) => ({
      ...current,
      scheduleBlocks: current.scheduleBlocks.map((block) =>
        block.id === blockId
          ? {
              ...block,
              [field]: value,
            }
          : block
      ),
    }));
  }

  function setScheduleModeAndAdjust(mode: "single" | "multi") {
    setScheduleMode(mode);
    setFormState((current) => {
      if (mode === "single") {
        const singleDate = current.startDate || defaultDateKey;
        const orderedBlocks = [...current.scheduleBlocks].sort(
          (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
        );
        const first = orderedBlocks[0] ?? { id: `new-b1-${Date.now()}`, date: singleDate, startTime: "08:00", endTime: "10:00" };
        return {
          ...current,
          startDate: singleDate,
          endDate: singleDate,
          scheduleBlocks: [
            {
              ...first,
              date: singleDate,
            },
          ],
        };
      }

      const start = current.startDate || defaultDateKey;
      const end = current.endDate || start;
      return {
        ...current,
        startDate: start,
        endDate: end,
      };
    });
  }

  function getDatesBetweenKeys(startKey: string, endKey: string) {
    const start = parseISODate(startKey);
    const end = parseISODate(endKey);
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    return days;
  }

  function toggleDateSelection(dateKey: string) {
    setFormState((current) => {
      const exists = current.scheduleBlocks.some((b) => b.date === dateKey);
      if (exists) {
        return {
          ...current,
          scheduleBlocks: current.scheduleBlocks.filter((b) => b.date !== dateKey),
        };
      }

      const newBlock: ScheduleBlock = {
        id: `new-b${current.scheduleBlocks.length + 1}-${Date.now()}`,
        date: dateKey,
        startTime: current.scheduleBlocks[0]?.startTime ?? "08:00",
        endTime: current.scheduleBlocks[0]?.endTime ?? "10:00",
      };

      return {
        ...current,
        scheduleBlocks: [...current.scheduleBlocks, newBlock].sort(
          (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
        ),
      };
    });
  }

  function removeScheduleBlock(blockId: string) {
    clearFieldError("scheduleBlocks");
    clearFieldError(`block-${blockId}-date`);
    clearFieldError(`block-${blockId}-startTime`);
    clearFieldError(`block-${blockId}-endTime`);
    clearFieldError(`block-${blockId}-range`);
    setFormState((current) => {
      if (current.scheduleBlocks.length === 1) return current;
      return {
        ...current,
        scheduleBlocks: current.scheduleBlocks.filter((block) => block.id !== blockId),
      };
    });
  }

  async function handleCreateEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAuditorio) {
      setFormError("Solo el perfil Administrador puede crear o editar eventos del auditorio.");
      return;
    }
    if (isSaving) return;

    setFormError(null);

    const errors: FormFieldErrors = {};

    if (!formState.title.trim()) {
      errors.title = "Ingresa el nombre del evento.";
    }

    if (!formState.organizer.trim()) {
      errors.organizer = "Ingresa quién organiza el evento.";
    }

    if (!formState.startDate) {
      errors.startDate = "Selecciona la fecha de inicio.";
    }

    if (!formState.endDate) {
      errors.endDate = "Selecciona la fecha de fin.";
    }

    if (formState.startDate && formState.endDate && formState.endDate < formState.startDate) {
      errors.endDate = "La fecha de fin debe ser igual o posterior a la fecha de inicio.";
    }

    if (!formState.status) {
      errors.status = "Selecciona el estado de la reserva.";
    }

    if (!scheduleMode) {
      errors.scheduleBlocks = "Selecciona si el evento es de un solo día o varios días.";
    }

    const attendees = Number(formState.attendees);
    if (!Number.isFinite(attendees) || attendees < 1) {
      errors.attendees = "El número de asistentes debe ser mayor que 0.";
    }

    formState.scheduleBlocks.forEach((block, index) => {
      const label = `Bloque ${index + 1}`;

      if (!block.date) {
        errors[`block-${block.id}-date`] = `${label}: selecciona una fecha.`;
      }

      if (!block.startTime) {
        errors[`block-${block.id}-startTime`] = `${label}: selecciona hora de inicio.`;
      }

      if (!block.endTime) {
        errors[`block-${block.id}-endTime`] = `${label}: selecciona hora de fin.`;
      }

      if (block.startTime && block.endTime && block.endTime <= block.startTime) {
        errors[`block-${block.id}-range`] = `${label}: la hora de fin debe ser mayor a la hora de inicio.`;
      }

      if (
        block.date &&
        formState.startDate &&
        formState.endDate &&
        (block.date < formState.startDate || block.date > formState.endDate)
      ) {
        errors[`block-${block.id}-date`] = `${label}: la fecha debe estar dentro del periodo general.`;
      }
    });

    const validBlocks = formState.scheduleBlocks.filter(
      (block) => block.date && block.startTime && block.endTime && block.endTime > block.startTime
    );

    if (validBlocks.length === 0) {
      errors.scheduleBlocks = "Agrega al menos un bloque de horario válido para continuar.";
    }

    const duplicateOverlap = hasOverlapWithOtherEvents(validBlocks, editingEventId);
    if (duplicateOverlap) {
      errors.scheduleBlocks = formatOverlapMessage(duplicateOverlap);
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError("Revisa los campos marcados en rojo.");
      return;
    }

    if (!editingEventId && formState.assignedStaffIds.length === 0) {
      const confirmed = await confirmToast("Seguro que quieres crearlo sin asignar a ningún trabajador?", {
        title: "Confirmar creación",
        confirmLabel: "Crear igual",
      });
      if (!confirmed) {
        return;
      }
    }

    setFieldErrors({});
    setIsSaving(true);

    try {
      const payload = mapFormToPayload({ ...formState, scheduleBlocks: validBlocks });

      if (editingEventId) {
        await fetchApiJson<{ message: string }>(`/api/auditorio/reservas/${editingEventId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApiJson<{ message: string; reservaId: string }>("/api/auditorio/reservas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      await syncReservas();
      setIsCreateOpen(false);
      setEditingEventId(null);
      setFormError(null);
      setScheduleMode("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la reserva";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const deleteSelectedEvent = async () => {
    if (!canManageAuditorio) return;
    if (!selectedEvent || isDeleting) return;

    const accepted = await confirmToast(`Eliminar la reserva "${selectedEvent.title}"?`, {
      title: "Eliminar evento",
      confirmLabel: "Eliminar",
    });
    if (!accepted) return;

    setIsDeleting(true);
    try {
      await fetchApiJson<{ message: string }>(`/api/auditorio/reservas/${selectedEvent.id}`, {
        method: "DELETE",
      });

      await syncReservas();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar la reserva";
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }

  const downloadExcelHistory = async () => {
    if (isDownloadingExcel) return;

    try {
      setIsDownloadingExcel(true);
      const response = await fetch("/api/auditorio/reservas/export", {
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `No se pudo descargar el excel (HTTP ${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      const disposition = response.headers.get("content-disposition") ?? "";
      const fileNameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
      const fileName = fileNameMatch?.[1] ?? `historial_auditorio_${Date.now()}.xlsx`;

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo descargar el historial en excel";
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Calendario Auditorio Chapman</h1>
            <p className="text-sm text-slate-500">Panel de calendario del Auditorio GW Chapman</p>
          </div>
          <button
            type="button"
            onClick={() => void downloadExcelHistory()}
            disabled={isDownloadingExcel}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {isDownloadingExcel ? "Descargando..." : "Descargar excel"}
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Cargando reservas del auditorio...
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grupo de meses</p>
              <h2 className="text-lg font-bold text-slate-900">{periodLabel}</h2>
            </div>
            <div className="relative flex items-center gap-2" ref={monthPickerRef}>
              <button
                type="button"
                onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                aria-label="Mes anterior"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="rounded-md bg-[#295786] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#1f466d]"
                aria-label="Mes siguiente"
              >
                →
              </button>
              <button
                type="button"
                onClick={openMonthPicker}
                className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-50"
                aria-label="Abrir selector de mes"
                title="Abrir selector de mes"
              >
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
              </button>

              {isMonthPickerOpen ? (
                <div className="absolute right-0 top-12 z-20 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPickerYear((year) => year - 1)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      ←
                    </button>
                    <p className="text-sm font-semibold text-slate-800">{pickerYear}</p>
                    <button
                      type="button"
                      onClick={() => setPickerYear((year) => year + 1)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      →
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {monthNames.map((monthName, monthIndex) => {
                      const isCurrentMonth = pickerYear === colombiaToday.getFullYear() && monthIndex === colombiaToday.getMonth();
                      const isInSelectedMonths = monthsToShow.some(
                        (m) => m.getFullYear() === pickerYear && m.getMonth() === monthIndex
                      );

                      return (
                        <button
                          key={`${pickerYear}-${monthName}`}
                          type="button"
                          onClick={() => {
                            setMonthCursor(new Date(pickerYear, monthIndex, 1));
                            setIsMonthPickerOpen(false);
                          }}
                          className={`rounded border px-2 py-1.5 text-xs font-medium transition ${
                            isCurrentMonth
                              ? "border-[#295786] bg-[#295786]/10 font-bold text-[#295786]"
                              : isInSelectedMonths
                              ? "border-amber-300 bg-amber-50 text-slate-700 hover:bg-amber-100"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {monthName.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded border border-[#295786] bg-[#295786]/10" />
                      <span className="text-slate-600">Mes actual</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded border border-amber-300 bg-amber-50" />
                      <span className="text-slate-600">Meses mostrados</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {monthsToShow.map((monthDate) => {
              const monthDays = buildMonthGrid(monthDate);
              const monthLabel = `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`;

              return (
                <article key={monthLabel} className="overflow-hidden rounded-lg border border-slate-200">
                  <header className="border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <h3 className="text-sm font-bold text-slate-800">{monthLabel}</h3>
                  </header>

                  <div className="grid grid-cols-7 border-b border-slate-200">
                    {weekDays.map((day) => (
                      <div key={`${monthLabel}-${day}`} className="px-2 py-1 text-center text-[11px] font-bold uppercase text-slate-500">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div>
                    {chunkWeeks(monthDays).map((week, weekIndex) => {
                      const segments = getWeekSegments(week, events);
                      const laneCount = Math.max(1, ...segments.map((segment) => segment.lane + 1));
                      const laneAreaHeight = laneCount * 22;

                      return (
                        <div key={`${monthLabel}-week-${weekIndex}`} className="border-b border-slate-100 last:border-b-0">
                          <div className="relative">
                            <div className="grid grid-cols-7">
                              {week.map((day) => {
                                const key = toDateKey(day);
                                const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                                const isToday = toDateKey(day) === toDateKey(colombiaToday);
                                const dayEventsCount = (eventMapByDay[key] ?? []).length;
                                const isDragTarget = dragOverDateKey === key;

                                return (
                                  <div
                                    key={`${monthLabel}-${key}`}
                                    className={`border-r border-slate-100 p-1.5 last:border-r-0 ${isCurrentMonth ? "bg-white" : "bg-slate-50"} ${
                                      isDragTarget ? "ring-2 ring-inset ring-[#295786]/60" : ""
                                    } ${isToday ? "ring-2 ring-[#295786]" : ""}`}
                                    style={{ minHeight: 74 + laneAreaHeight }}
                                    onDragOver={canManageAuditorio
                                      ? (event) => {
                                          event.preventDefault();
                                          setDragOverDateKey(key);
                                        }
                                      : undefined}
                                    onDragLeave={canManageAuditorio
                                      ? () => {
                                          if (dragOverDateKey === key) setDragOverDateKey(null);
                                        }
                                      : undefined}
                                    onDrop={canManageAuditorio
                                      ? (event) => {
                                          event.preventDefault();
                                          const eventId = event.dataTransfer.getData("text/aud-event-id");
                                          if (eventId) {
                                            moveEventToDate(eventId, parseISODate(key));
                                            setSelectedEventId(eventId);
                                          }
                                          setDragOverDateKey(null);
                                        }
                                      : undefined}
                                  >
                                    {isToday ? (
                                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#295786] text-[11px] font-semibold text-white">
                                        {day.getDate()}
                                      </div>
                                    ) : (
                                      <p className={`text-[11px] font-semibold ${isCurrentMonth ? "text-slate-800" : "text-slate-400"}`}>
                                        {day.getDate()}
                                      </p>
                                    )}
                                    <div style={{ height: laneAreaHeight + 6 }} />
                                    {dayEventsCount > 0 ? (
                                      <p className="text-[10px] font-medium text-slate-500">{dayEventsCount} evento(s)</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="pointer-events-none absolute inset-x-0 top-6 px-1.5">
                              <div className="grid grid-cols-7 gap-1" style={{ gridTemplateRows: `repeat(${laneCount}, minmax(0, 20px))` }}>
                                {segments.map((segment) => {
                                  const isSelected = selectedEventId === segment.event.id;
                                  return (
                                    <button
                                      key={`${segment.event.id}-${weekIndex}-${segment.startCol}`}
                                      type="button"
                                      draggable={canManageAuditorio}
                                      onDragStart={(event) => {
                                        if (!canManageAuditorio) return;
                                        event.dataTransfer.setData("text/aud-event-id", segment.event.id);
                                        event.dataTransfer.effectAllowed = "move";
                                      }}
                                      onClick={() => setSelectedEventId(segment.event.id)}
                                      className={`pointer-events-auto truncate rounded px-2 py-1 text-left text-[10px] font-semibold shadow-sm transition hover:brightness-95 active:cursor-grabbing ${eventStyles[segment.event.color]} ${
                                        isSelected ? "ring-1 ring-[#295786]" : ""
                                      }`}
                                      style={{
                                        gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                                        gridRow: `${segment.lane + 1}`,
                                      }}
                                    >
                                      {segment.event.title}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="h-fit xl:sticky xl:top-24">
          {canManageAuditorio ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="mb-3 w-full rounded-lg bg-[#295786] px-4 py-3 text-base font-bold text-white transition hover:bg-[#1f466d]"
            >
              Agregar evento
            </button>
          ) : null}

          <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase text-slate-500">Detalle del evento</h3>
            {selectedEvent ? (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Titulo:</span> {selectedEvent.title}
                </p>
                <p>
                  <span className="font-semibold">Estado:</span> {selectedEvent.status}
                </p>
                <p>
                  <span className="font-semibold">Organiza:</span> {selectedEvent.organizer}
                </p>
                <p>
                  <span className="font-semibold">Duracion:</span> {diffDays(getEventBounds(selectedEvent).end, getEventBounds(selectedEvent).start) + 1} dia(s)
                </p>
                <p>
                  <span className="font-semibold">Asistentes:</span> {selectedEvent.attendees}
                </p>
                <p>
                  <span className="font-semibold">Recursos:</span> {getEventResourcesLabel(selectedEvent)}
                </p>
                <div>
                  <p className="font-semibold">Encargado(s):</p>
                  {selectedEvent.assignedWorkers.length > 0 ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedEvent.assignedWorkers.map((worker) => (
                        <div
                          key={`encargado-${worker.staffId}`}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2"
                        >
                          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#295786] text-[11px] font-bold text-white">
                            <img
                              src={getStaffPhotoUrl(worker.cedula)}
                              alt={`Foto de ${worker.nombreCompleto}`}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                const image = event.currentTarget;
                                image.style.display = "none";
                                const fallback = image.parentElement?.querySelector<HTMLElement>("[data-worker-fallback='true']");
                                fallback?.classList.remove("hidden");
                              }}
                              onLoad={(event) => {
                                const image = event.currentTarget;
                                const fallback = image.parentElement?.querySelector<HTMLElement>("[data-worker-fallback='true']");
                                fallback?.classList.add("hidden");
                                image.style.display = "block";
                              }}
                            />
                            <div data-worker-fallback="true" className="hidden items-center justify-center">
                              {getStaffInitials(worker.nombreCompleto)}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{worker.nombreCompleto}</p>
                            <p className="text-xs text-slate-600">{worker.rol}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Sin encargados asignados.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Horarios:</p>
                  <div className="space-y-2">
                    {selectedEvent.scheduleBlocks
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                      .map((block) => (
                        <div
                          key={`detalle-horario-${block.id}`}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-[#295786]">calendar_month</span>
                            <span className="font-semibold">{formatDateLabel(parseISODate(block.date))}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-[#295786]">schedule</span>
                            <span>{formatTimeAmPm(block.startTime)} - {formatTimeAmPm(block.endTime)}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
                <p>
                  <span className="font-semibold">Observaciones:</span> {selectedEvent.observations || "Sin observaciones"}
                </p>
                {canManageAuditorio ? (
                  <p className="text-xs text-slate-500">Tip: arrastra la barra del evento y sueltala en otro dia para moverla.</p>
                ) : null}

                {canManageAuditorio ? (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="rounded-lg bg-[#295786] px-3 py-2 text-sm font-semibold text-white"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void deleteSelectedEvent()}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isDeleting ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Selecciona un evento para ver sus detalles.</p>
            )}
          </aside>
        </div>
      </div>

      {isCreateOpen && canManageAuditorio ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#faf8ff] shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 md:px-8">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isSaving}
                  className="rounded-full p-2 text-[#295786] transition hover:bg-[#d5e3ff] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Volver"
                >
                  <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
                <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[#295786] md:text-[22px]">
                  {editingEventId ? "Editar evento del auditorio" : "Agregar evento al auditorio"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-[#295786] transition hover:bg-[#d5e3ff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
                Cerrar
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              {formError ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
                  {formError}
                </div>
              ) : null}

              <form className="grid grid-cols-12 gap-6" onSubmit={handleCreateEventSubmit}>
                <div className="col-span-12 lg:col-span-8 space-y-6">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-6 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">info</span>
                      Información del Evento
                    </h3>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="md:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Nombre del evento</span>
                        <input
                          type="text"
                          value={formState.title}
                          onChange={(event) => {
                            clearFieldError("title");
                            setFormState((current) => ({ ...current, title: event.target.value }));
                          }}
                          placeholder="Ej: Simposio de Arquitectura Sostenible"
                          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${fieldErrors.title ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                          required
                        />
                        {fieldErrors.title ? <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.title}</p> : null}
                      </label>

                      <label className="md:col-span-1">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Organizador</span>
                        <input
                          type="text"
                          value={formState.organizer}
                          onChange={(event) => {
                            clearFieldError("organizer");
                            setFormState((current) => ({ ...current, organizer: event.target.value }));
                          }}
                          placeholder="Nombre de la entidad o persona"
                          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${fieldErrors.organizer ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                          required
                        />
                        {fieldErrors.organizer ? <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.organizer}</p> : null}
                      </label>

                      <label className="md:col-span-1">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Estado</span>
                        <select
                          value={formState.status}
                          onChange={(event) => {
                            clearFieldError("status");
                            setFormState((current) => ({
                              ...current,
                              status: event.target.value as AuditorioEstado | "",
                            }));
                          }}
                          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${fieldErrors.status ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                        >
                          <option value="" disabled>
                            Selecciona un estado
                          </option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="Aprobada">Aprobada</option>
                        </select>
                        {fieldErrors.status ? <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.status}</p> : null}
                      </label>

                      

                      <label>
                        <span className="mb-2 block text-sm font-medium text-slate-700">Número de asistentes</span>
                        <input
                          type="number"
                          min={1}
                          value={formState.attendees}
                          onChange={(event) => {
                            clearFieldError("attendees");
                            setFormState((current) => ({ ...current, attendees: event.target.value }));
                          }}
                          placeholder="0"
                          className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${fieldErrors.attendees ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                        />
                        {fieldErrors.attendees ? <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.attendees}</p> : null}
                      </label>
                    </div>

                    <div className="md:col-span-2">
                        <span className="mb-2 mt-5 block text-sm font-medium text-slate-700">¿Evento de un solo día o varios días?</span>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setScheduleModeAndAdjust("single")}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
                              scheduleMode === "single" ? "bg-[#295786] text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            Un solo día
                          </button>

                          <button
                            type="button"
                            onClick={() => setScheduleModeAndAdjust("multi")}
                            className={`px-3 py-2 rounded-xl text-sm font-medium transition ${
                              scheduleMode === "multi" ? "bg-[#295786] text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            Varios días
                          </button>
                        </div>
                      </div>

                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">schedule</span>
                      Días y Horarios Intercalados
                    </h3>

                    <div className="space-y-4">
                      {scheduleMode === "" ? (
                        <div className="py-6 text-center">
                          <p className="text-sm text-slate-500">Selecciona "Un solo día" o "Varios días" arriba para configurar los días y horarios.</p>
                        </div>
                      ) : scheduleMode === "single" ? (
                        <div className="space-y-4">
                          <label>
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fecha del evento</span>
                            <input
                              type="date"
                              value={formState.startDate}
                              onChange={(event) => {
                                const nextDate = event.target.value;
                                clearFieldError("startDate");
                                clearFieldError("endDate");
                                clearFieldError("scheduleBlocks");
                                setFormState((current) => {
                                  const firstBlock = current.scheduleBlocks[0] ?? {
                                    id: `new-b1-${Date.now()}`,
                                    date: nextDate,
                                    startTime: "08:00",
                                    endTime: "10:00",
                                  };

                                  return {
                                    ...current,
                                    startDate: nextDate,
                                    endDate: nextDate,
                                    scheduleBlocks: [
                                      {
                                        ...firstBlock,
                                        date: nextDate,
                                      },
                                    ],
                                  };
                                });
                              }}
                              className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${fieldErrors.startDate ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                            />
                            {fieldErrors.startDate ? <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.startDate}</p> : null}
                          </label>

                          <div className="rounded-2xl border border-dashed border-[#c7d4ea] bg-[#f7f9ff] p-4">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-700">Horario del día</p>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#295786] shadow-sm">Un solo bloque</span>
                            </div>

                            {formState.scheduleBlocks.slice(0, 1).map((block) => {
                              const blockStartError = fieldErrors[`block-${block.id}-startTime`];
                              const blockEndError = fieldErrors[`block-${block.id}-endTime`];
                              const blockRangeError = fieldErrors[`block-${block.id}-range`];

                              return (
                                <div key={block.id} className="grid gap-3 md:grid-cols-2 md:items-end">
                                  <label>
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de inicio</span>
                                    <select
                                      value={block.startTime}
                                      onChange={(event) => updateScheduleBlock(block.id, "startTime", event.target.value)}
                                      className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${blockStartError || blockRangeError ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                                    >
                                      <option value="">Selecciona hora</option>
                                      {TIME_SLOT_OPTIONS.map((option) => (
                                        <option key={`single-start-${block.id}-${option.value}`} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de fin</span>
                                    <select
                                      value={block.endTime}
                                      onChange={(event) => updateScheduleBlock(block.id, "endTime", event.target.value)}
                                      className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${blockEndError || blockRangeError ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                                    >
                                      <option value="">Selecciona hora</option>
                                      {TIME_SLOT_OPTIONS.map((option) => (
                                        <option key={`single-end-${block.id}-${option.value}`} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              );
                            })}

                            <p className="mt-3 text-xs text-slate-500">La fecha seleccionada se aplicará a un único bloque horario.</p>
                          </div>

                          {fieldErrors.scheduleBlocks ? (
                            <p className="text-xs font-medium text-red-600 whitespace-pre-line">{fieldErrors.scheduleBlocks}</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <label>
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fecha inicio</span>
                              <input
                                type="date"
                                value={formState.startDate}
                                onChange={(event) => {
                                  clearFieldError("startDate");
                                  clearFieldError("scheduleBlocks");
                                  setFormState((current) => ({
                                    ...current,
                                    startDate: event.target.value,
                                  }));
                                }}
                                className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${fieldErrors.startDate ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                              />
                              {fieldErrors.startDate ? <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.startDate}</p> : null}
                            </label>

                            <label>
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fecha fin</span>
                              <input
                                type="date"
                                value={formState.endDate}
                                onChange={(event) => {
                                  clearFieldError("endDate");
                                  clearFieldError("scheduleBlocks");
                                  setFormState((current) => ({
                                    ...current,
                                    endDate: event.target.value,
                                  }));
                                }}
                                className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${fieldErrors.endDate ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                              />
                              {fieldErrors.endDate ? <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.endDate}</p> : null}
                            </label>
                          </div>

                          <div className="rounded-2xl border border-dashed border-[#c7d4ea] bg-[#f7f9ff] p-4">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-700">Días del rango</p>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#295786] shadow-sm">{selectedScheduleDateKeys.size} seleccionados</span>
                            </div>

                            {visibleMultiDates.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {visibleMultiDates.map((date) => {
                                  const dateKey = toDateKey(date);
                                  const isActive = selectedScheduleDateKeys.has(dateKey);

                                  return (
                                    <button
                                      key={dateKey}
                                      type="button"
                                      onClick={() => toggleDateSelection(dateKey)}
                                      aria-pressed={isActive}
                                      className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                                        isActive
                                          ? "bg-[#295786] text-white shadow-sm"
                                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                      }`}
                                    >
                                      {formatDateLabel(date)}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">Selecciona un rango válido para ver los días disponibles.</p>
                            )}
                          </div>

                          {orderedScheduleBlocks.length > 0 ? (
                            <div className="space-y-3">
                              {orderedScheduleBlocks.map((block, index) => {
                                const blockStartError = fieldErrors[`block-${block.id}-startTime`];
                                const blockEndError = fieldErrors[`block-${block.id}-endTime`];
                                const blockRangeError = fieldErrors[`block-${block.id}-range`];

                                return (
                                  <div key={block.id} className="rounded-2xl border border-dashed border-[#c7d4ea] bg-[#f7f9ff] p-4">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                      <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#295786] shadow-sm">
                                        {formatDateLabel(parseISODate(block.date))}
                                      </div>
                                      <span className="text-xs font-medium text-slate-500">Bloque {index + 1}</span>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                                      <label>
                                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de inicio</span>
                                        <select
                                          value={block.startTime}
                                          onChange={(event) => updateScheduleBlock(block.id, "startTime", event.target.value)}
                                          className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${blockStartError || blockRangeError ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                                        >
                                          <option value="">Selecciona hora</option>
                                          {TIME_SLOT_OPTIONS.map((option) => (
                                            <option key={`multi-start-${block.id}-${option.value}`} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>

                                      <label>
                                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de fin</span>
                                        <select
                                          value={block.endTime}
                                          onChange={(event) => updateScheduleBlock(block.id, "endTime", event.target.value)}
                                          className={`w-full rounded-xl border bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10 ${blockEndError || blockRangeError ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                                        >
                                          <option value="">Selecciona hora</option>
                                          {TIME_SLOT_OPTIONS.map((option) => (
                                            <option key={`multi-end-${block.id}-${option.value}`} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>

                                      <button
                                        type="button"
                                        onClick={() => removeScheduleBlock(block.id)}
                                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-red-600"
                                        title="Quitar"
                                      >
                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                      </button>
                                    </div>

                                    {blockStartError || blockEndError || blockRangeError ? (
                                      <p className="mt-3 text-xs font-medium text-red-600">
                                        {blockStartError ?? blockEndError ?? blockRangeError}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                              Selecciona uno o más días arriba para crear sus horarios.
                            </div>
                          )}

                          {fieldErrors.scheduleBlocks ? (
                            <p className="text-xs font-medium text-red-600 whitespace-pre-line">{fieldErrors.scheduleBlocks}</p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">notes</span>
                      Notas Adicionales
                    </h3>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Observaciones</span>
                      <textarea
                        value={formState.observations}
                        onChange={(event) => setFormState((current) => ({ ...current, observations: event.target.value }))}
                        placeholder="Detalles específicos del montaje, requerimientos especiales de seguridad, etc."
                        className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10"
                      />
                    </label>
                  </section>
                </div>

                <div className="col-span-12 lg:col-span-4 space-y-6">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                      Equipamiento
                    </h3>

                    <div className="grid gap-3">
                      {[
                        ["needsScreen", "Pantalla", "tv"],
                        ["needsSound", "Sonido", "volume_up"],
                        ["needsMonitor", "Monitor", "desktop_windows"],
                        ["needsProjector", "Proyector", "videocam"],
                        ["needsWaterFilter", "Filtro de Agua", "water_drop"],
                      ].map(([key, label, icon]) => (
                        <label
                          key={String(key)}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#fafcff] p-3 transition hover:bg-[#f4f7ff]"
                        >
                          <input
                            type="checkbox"
                            checked={formState[key as keyof Pick<NewEventFormState, "needsScreen" | "needsSound" | "needsMonitor" | "needsProjector" | "needsWaterFilter">] as boolean}
                            onChange={(event) => setFormState((current) => ({ ...current, [key]: event.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300 text-[#295786] focus:ring-[#295786]"
                          />
                          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <span className="material-symbols-outlined text-[#295786]">{icon}</span>
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">group</span>
                      Personal Encargado
                    </h3>

                    {staffCatalog.length > 0 ? (
                      <>
                        <div className="relative mb-4">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                          <input
                            type="text"
                            placeholder="Buscar personal..."
                            value={staffSearchQuery}
                            onChange={(e) => setStaffSearchQuery(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10"
                          />
                        </div>
                        <div className="max-h-[300px] space-y-3 overflow-auto pr-1">
                        {staffCatalog
                          .filter((staffMember) => {
                            const fullName = `${staffMember.nombres} ${staffMember.apellidos}`.toLowerCase();
                            return fullName.includes(staffSearchQuery.toLowerCase());
                          })
                          .map((staffMember) => {
                            const checked = formState.assignedStaffIds.includes(staffMember.id);
                            const label = `${staffMember.nombres} ${staffMember.apellidos}`.trim();

                          return (
                            <label
                              key={`staff-${staffMember.id}`}
                              className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition ${
                                checked ? "border-[#295786] bg-[#d5e3ff]" : "border-slate-200 bg-[#fafcff] hover:bg-[#f4f7ff]"
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#295786] text-[10px] font-bold text-white">
                                  <img
                                    src={getStaffPhotoUrl(staffMember.cedula)}
                                    alt={`Foto de ${label}`}
                                    className="h-full w-full object-cover"
                                    onError={(event) => {
                                      const image = event.currentTarget;
                                      image.style.display = "none";
                                      const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-fallback='true']");
                                      fallback?.classList.remove("hidden");
                                    }}
                                    onLoad={(event) => {
                                      const image = event.currentTarget;
                                      const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-fallback='true']");
                                      fallback?.classList.add("hidden");
                                      image.style.display = "block";
                                    }}
                                  />
                                  <div data-staff-fallback="true" className="hidden items-center justify-center">
                                    {getStaffInitials(label)}
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
                                  <p className="text-xs text-slate-500">{staffMember.rol}</p>
                                </div>
                              </div>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const isChecked = event.target.checked;
                                  setFormState((current) => ({
                                    ...current,
                                    assignedStaffIds: isChecked
                                      ? Array.from(new Set([...current.assignedStaffIds, staffMember.id]))
                                      : current.assignedStaffIds.filter((id) => id !== staffMember.id),
                                  }));
                                }}
                                className="h-5 w-5 rounded-full border-slate-300 text-[#295786] focus:ring-[#295786]"
                              />
                            </label>
                          );
                        })}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No hay personal disponible para asignar.</p>
                    )}
                  </section>

                  

                  

                  <div className="flex gap-3 lg:flex-col">
                    <button
                      type="button"
                      onClick={closeCreateModal}
                      disabled={isSaving}
                      className="flex-1 rounded-xl border border-[#295786] px-5 py-3 text-sm font-medium text-[#295786] transition hover:bg-[#d5e3ff] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Descartar cambios
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 rounded-xl bg-[#295786] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(41,87,134,0.24)] transition hover:bg-[#1f4a74] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSaving ? "Guardando..." : editingEventId ? "Guardar cambios" : "Crear Evento"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
