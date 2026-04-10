"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";
import { useWebSocketSchedules } from "@/lib/use-websocket-schedules";

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
  horarios: Array<{
    id: string;
    fechaEspecifica: string;
    horaInicio: string;
    horaFin: string;
  }>;
};

type NewEventFormState = {
  title: string;
  organizer: string;
  startDate: string;
  endDate: string;
  status: AuditorioEstado;
  attendees: string;
  needsScreen: boolean;
  needsSound: boolean;
  needsMonitor: boolean;
  needsProjector: boolean;
  needsWaterFilter: boolean;
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

function getEventScheduleSummary(event: AuditoriumEvent) {
  return event.scheduleBlocks
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .map((block) => `${block.date} ${block.startTime}-${block.endTime}`)
    .join(" | ");
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

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function overlapsByTime(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

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
    status: "Pendiente",
    attendees: "",
    needsScreen: false,
    needsSound: false,
    needsMonitor: false,
    needsProjector: false,
    needsWaterFilter: false,
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

  const colombiaToday = useMemo(() => getColombiaToday(), []);
  const defaultDateKey = useMemo(() => toDateKey(colombiaToday), [colombiaToday]);

  const [events, setEvents] = useState<AuditoriumEvent[]>([]);
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
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(colombiaToday.getFullYear());
  const [visibleMonthCount, setVisibleMonthCount] = useState(2);

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
      return loaded[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        await syncReservas();
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
  }, [syncReservas]);

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
    observaciones: state.observations.trim() || null,
    estado: state.status,
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
      observations: selectedEvent.observations,
      scheduleBlocks: selectedEvent.scheduleBlocks.map((block, index) => ({
        ...block,
        id: `edit-b${index + 1}-${Date.now()}`,
      })),
    });
    setIsCreateOpen(true);
  };

  function openCreateModal() {
    setEditingEventId(null);
    setFormError(null);
    setFieldErrors({});
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
  }

  function moveEventToDate(eventId: string, newStartDate: Date) {
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
      window.alert(formatOverlapMessage(overlapWith));
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
        window.alert(message);
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

  function addScheduleBlock() {
    clearFieldError("scheduleBlocks");
    setFormState((current) => ({
      ...current,
      scheduleBlocks: [
        ...current.scheduleBlocks,
        {
          id: `new-b${current.scheduleBlocks.length + 1}-${Date.now()}`,
          date: current.startDate || defaultDateKey,
          startTime: "08:00",
          endTime: "10:00",
        },
      ],
    }));
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la reserva";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const deleteSelectedEvent = async () => {
    if (!selectedEvent || isDeleting) return;

    const accepted = window.confirm(`Eliminar la reserva "${selectedEvent.title}"?`);
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
      window.alert(message);
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
      window.alert(message);
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
                                    onDragOver={(event) => {
                                      event.preventDefault();
                                      setDragOverDateKey(key);
                                    }}
                                    onDragLeave={() => {
                                      if (dragOverDateKey === key) setDragOverDateKey(null);
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      const eventId = event.dataTransfer.getData("text/aud-event-id");
                                      if (eventId) {
                                        moveEventToDate(eventId, parseISODate(key));
                                        setSelectedEventId(eventId);
                                      }
                                      setDragOverDateKey(null);
                                    }}
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
                                      draggable
                                      onDragStart={(event) => {
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
          <button
            type="button"
            onClick={openCreateModal}
            className="mb-3 w-full rounded-lg bg-[#295786] px-4 py-3 text-base font-bold text-white transition hover:bg-[#1f466d]"
          >
            Agregar evento
          </button>

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
                  <span className="font-semibold">Fechas:</span> {formatDateLabel(getEventBounds(selectedEvent).start)} - {formatDateLabel(getEventBounds(selectedEvent).end)}
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
                <p>
                  <span className="font-semibold">Horarios:</span> {getEventScheduleSummary(selectedEvent)}
                </p>
                <p>
                  <span className="font-semibold">Observaciones:</span> {selectedEvent.observations || "Sin observaciones"}
                </p>
                <p className="text-xs text-slate-500">Tip: arrastra la barra del evento y sueltala en otro dia para moverla.</p>

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
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Selecciona un evento para ver sus detalles.</p>
            )}
          </aside>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEventId ? "Editar evento del auditorio" : "Agregar evento al auditorio"}
              </h2>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={isSaving}
                className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            {formError ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleCreateEventSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Nombre del evento
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(event) => {
                      clearFieldError("title");
                      setFormState((current) => ({ ...current, title: event.target.value }));
                    }}
                    className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${fieldErrors.title ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                    required
                  />
                  {fieldErrors.title ? <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p> : null}
                </label>

                <label className="text-sm text-slate-700">
                  Quien lo organiza
                  <input
                    type="text"
                    value={formState.organizer}
                    onChange={(event) => {
                      clearFieldError("organizer");
                      setFormState((current) => ({ ...current, organizer: event.target.value }));
                    }}
                    className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${fieldErrors.organizer ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                    required
                  />
                  {fieldErrors.organizer ? <p className="mt-1 text-xs text-red-600">{fieldErrors.organizer}</p> : null}
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm text-slate-700">
                  Fecha inicio
                  <input
                    type="date"
                    value={formState.startDate}
                    onChange={(event) => {
                      clearFieldError("startDate");
                      setFormState((current) => ({ ...current, startDate: event.target.value }));
                    }}
                    className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${fieldErrors.startDate ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                  />
                  {fieldErrors.startDate ? <p className="mt-1 text-xs text-red-600">{fieldErrors.startDate}</p> : null}
                </label>

                <label className="text-sm text-slate-700">
                  Fecha fin
                  <input
                    type="date"
                    value={formState.endDate}
                    onChange={(event) => {
                      clearFieldError("endDate");
                      setFormState((current) => ({ ...current, endDate: event.target.value }));
                    }}
                    className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${fieldErrors.endDate ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                  />
                  {fieldErrors.endDate ? <p className="mt-1 text-xs text-red-600">{fieldErrors.endDate}</p> : null}
                </label>

                <label className="text-sm text-slate-700">
                  Estado
                  <select
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        status: event.target.value as AuditorioEstado,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Aprobada">Aprobada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </label>

                <label className="text-sm text-slate-700">
                  Numero de asistentes
                  <input
                    type="number"
                    min={1}
                    value={formState.attendees}
                    onChange={(event) => {
                      clearFieldError("attendees");
                      setFormState((current) => ({ ...current, attendees: event.target.value }));
                    }}
                    className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${fieldErrors.attendees ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                  />
                  {fieldErrors.attendees ? <p className="mt-1 text-xs text-red-600">{fieldErrors.attendees}</p> : null}
                </label>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-semibold text-slate-800">Que necesitan</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.needsScreen}
                      onChange={(event) => setFormState((current) => ({ ...current, needsScreen: event.target.checked }))}
                    />
                    Pantalla
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.needsSound}
                      onChange={(event) => setFormState((current) => ({ ...current, needsSound: event.target.checked }))}
                    />
                    Sonido
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.needsMonitor}
                      onChange={(event) => setFormState((current) => ({ ...current, needsMonitor: event.target.checked }))}
                    />
                    Monitor
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.needsProjector}
                      onChange={(event) => setFormState((current) => ({ ...current, needsProjector: event.target.checked }))}
                    />
                    Proyector
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.needsWaterFilter}
                      onChange={(event) => setFormState((current) => ({ ...current, needsWaterFilter: event.target.checked }))}
                    />
                    Filtro de Agua
                  </label>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Dias y horarios intercalados</p>
                  <button
                    type="button"
                    onClick={addScheduleBlock}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Agregar dia/horario
                  </button>
                </div>

                <div className="space-y-2">
                  {formState.scheduleBlocks.map((block, index) => {
                    const blockDateError = fieldErrors[`block-${block.id}-date`];
                    const blockStartError = fieldErrors[`block-${block.id}-startTime`];
                    const blockEndError = fieldErrors[`block-${block.id}-endTime`];
                    const blockRangeError = fieldErrors[`block-${block.id}-range`];

                    return (
                      <div key={block.id} className="rounded-md border border-slate-200 p-2">
                        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                          <input
                            type="date"
                            value={block.date}
                            onChange={(event) => updateScheduleBlock(block.id, "date", event.target.value)}
                            className={`rounded-md border px-2 py-1.5 text-sm ${blockDateError ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                          />
                          <input
                            type="time"
                            value={block.startTime}
                            onChange={(event) => updateScheduleBlock(block.id, "startTime", event.target.value)}
                            className={`rounded-md border px-2 py-1.5 text-sm ${blockStartError || blockRangeError ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                          />
                          <input
                            type="time"
                            value={block.endTime}
                            onChange={(event) => updateScheduleBlock(block.id, "endTime", event.target.value)}
                            className={`rounded-md border px-2 py-1.5 text-sm ${blockEndError || blockRangeError ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeScheduleBlock(block.id)}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Quitar
                          </button>
                        </div>
                        {blockDateError || blockStartError || blockEndError || blockRangeError ? (
                          <p className="mt-1 text-xs text-red-600">
                            {blockDateError ?? blockStartError ?? blockEndError ?? blockRangeError}
                          </p>
                        ) : null}
                        {index < formState.scheduleBlocks.length - 1 ? <div className="mt-2 border-t border-slate-100" /> : null}
                      </div>
                    );
                  })}
                </div>
                {fieldErrors.scheduleBlocks ? (
                  <p className="mt-2 text-xs text-red-600 whitespace-pre-line">{fieldErrors.scheduleBlocks}</p>
                ) : null}
              </div>

              <label className="block text-sm text-slate-700">
                Observaciones
                <textarea
                  value={formState.observations}
                  onChange={(event) => setFormState((current) => ({ ...current, observations: event.target.value }))}
                  className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isSaving}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-md bg-[#295786] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f466d] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? "Guardando..." : editingEventId ? "Guardar cambios" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
