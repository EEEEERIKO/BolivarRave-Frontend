"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

type AuditorioReservaApi = {
  id: string;
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
  horarios: Array<{
    id: string;
    fechaEspecifica: string;
    horaInicio: string;
    horaFin: string;
  }>;
};

type PublicEvent = {
  id: string;
  title: string;
  periodStartDate: string;
  periodEndDate: string;
  color: "blue" | "emerald" | "amber";
  scheduleBlocks: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  }>;
};

type PublicScheduleMode = "" | "single" | "multi";

type PublicScheduleBlock = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const DAY_MS = 24 * 60 * 60 * 1000;

const eventStyles: Record<PublicEvent["color"], string> = {
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
  return Math.round((stripTime(dateA).getTime() - stripTime(dateB).getTime()) / DAY_MS);
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

function formatDateShort(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" });
}

function formatTimeAmPm(value: string) {
  if (!value) return "";
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = ((hours + 11) % 12) + 1;
  return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function toMinutes(value: string) {
  const [hoursText, minutesText] = value.split(":").map(Number);
  return (hoursText ?? 0) * 60 + (minutesText ?? 0);
}

function getEventBounds(event: PublicEvent) {
  const dates = event.scheduleBlocks.map((block) => parseISODate(block.date).getTime());
  return { start: new Date(Math.min(...dates)), end: new Date(Math.max(...dates)) };
}

function getWeekSegments(week: Date[], events: PublicEvent[]) {
  if (week.length < 7) return [];

  const weekStart = stripTime(week[0]);
  const weekEnd = stripTime(week[6]);
  const weekKeyToIndex = Object.fromEntries(week.map((date, index) => [toDateKey(date), index]));

  const baseSegments: Array<{ event: PublicEvent; startCol: number; endCol: number }> = [];

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
      if (current === previous + 1) previous = current;
      else {
        baseSegments.push({ event, startCol: rangeStart, endCol: previous });
        rangeStart = current;
        previous = current;
      }
    }

    baseSegments.push({ event, startCol: rangeStart, endCol: previous });
  });

  baseSegments.sort((a, b) => (a.startCol === b.startCol ? b.endCol - a.endCol : a.startCol - b.startCol));

  const laneEnds: number[] = [];
  const positioned: Array<{ event: PublicEvent; startCol: number; endCol: number; lane: number }> = [];

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

function getEndTimeOptions(startTime: string) {
  const slots = Array.from({ length: ((23 * 60 + 30) - (5 * 60)) / 30 + 1 }, (_, index) => {
    const totalMinutes = 5 * 60 + index * 30;
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minute = String(totalMinutes % 60).padStart(2, "0");
    const value = `${hour}:${minute}`;
    return { value, label: formatTimeAmPm(value) };
  });

  return slots.filter((slot) => !startTime || slot.value > startTime);
}

function getTimeOptions() {
  return Array.from({ length: ((23 * 60 + 30) - (5 * 60)) / 30 + 1 }, (_, index) => {
    const totalMinutes = 5 * 60 + index * 30;
    const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const minute = String(totalMinutes % 60).padStart(2, "0");
    const value = `${hour}:${minute}`;
    return { value, label: formatTimeAmPm(value) };
  });
}

function overlapsByTime(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

function getDatesBetweenKeys(startKey: string, endKey: string) {
  const start = parseISODate(startKey);
  const end = parseISODate(endKey);
  const days: Date[] = [];

  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    days.push(new Date(date));
  }

  return days;
}

function buildScheduleBlocksForRange(startKey: string, endKey: string, previousBlocks: PublicScheduleBlock[] = []) {
  const dates = getDatesBetweenKeys(startKey, endKey);
  const baseStartTime = previousBlocks[0]?.startTime ?? "08:00";
  const baseEndTime = previousBlocks[0]?.endTime ?? "10:00";

  return dates.map((date, index) => {
    const dateKey = toDateKey(date);
    const existing = previousBlocks.find((block) => block.date === dateKey);

    return (
      existing ?? {
        id: `public-b${index + 1}-${Date.now()}`,
        date: dateKey,
        startTime: baseStartTime,
        endTime: baseEndTime,
      }
    );
  });
}

function buildSingleScheduleBlock(dateKey: string, previousBlocks: PublicScheduleBlock[] = []) {
  const first = previousBlocks[0] ?? {
    id: `public-b1-${Date.now()}`,
    date: dateKey,
    startTime: "08:00",
    endTime: "10:00",
  };

  return [{ ...first, date: dateKey }];
}

function validatePublicBlocksNoOverlap(blocks: PublicScheduleBlock[]) {
  const orderedBlocks = blocks.slice().sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  for (let index = 0; index < orderedBlocks.length; index += 1) {
    const left = orderedBlocks[index];

    if (toMinutes(left.endTime) <= toMinutes(left.startTime)) {
      return `El bloque ${index + 1} tiene una hora de fin menor o igual a la hora de inicio.`;
    }

    for (let compareIndex = index + 1; compareIndex < orderedBlocks.length; compareIndex += 1) {
      const right = orderedBlocks[compareIndex];
      if (left.date !== right.date) continue;

      if (overlapsByTime(left.startTime, left.endTime, right.startTime, right.endTime)) {
        return `Los bloques del ${formatDateShort(left.date)} se solapan entre ${formatTimeAmPm(left.startTime)} y ${formatTimeAmPm(left.endTime)}.`;
      }
    }
  }

  return null;
}

function formatOverlapMessage(detail: { title: string; date: string; startTime: string; endTime: string }) {
  return `No es posible reservar ese horario porque ya existe un evento.\nCoincide con: ${detail.title}\nFecha: ${formatDateShort(detail.date)}\nHorario: ${formatTimeAmPm(detail.startTime)} - ${formatTimeAmPm(detail.endTime)}`;
}

function hasOverlapWithOtherEvents(scheduleBlocks: PublicScheduleBlock[], events: PublicEvent[]) {
  for (const block of scheduleBlocks) {
    for (const existingEvent of events) {
      for (const existingBlock of existingEvent.scheduleBlocks) {
        if (existingBlock.date !== block.date) continue;
        if (overlapsByTime(block.startTime, block.endTime, existingBlock.startTime, existingBlock.endTime)) {
          return {
            title: existingEvent.title,
            date: existingBlock.date,
            startTime: existingBlock.startTime,
            endTime: existingBlock.endTime,
          };
        }
      }
    }
  }

  return null;
}

function colorFromIndex(index: number): PublicEvent["color"] {
  if (index % 3 === 0) return "blue";
  if (index % 3 === 1) return "emerald";
  return "amber";
}

export default function PublicAuditorioPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(startOfMonth(getColombiaToday()));
  const [visibleMonthCount, setVisibleMonthCount] = useState(1);
  const [scheduleMode, setScheduleMode] = useState<PublicScheduleMode>("");

  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scheduleBlocks, setScheduleBlocks] = useState<PublicScheduleBlock[]>([]);
  const [activePublicScheduleDateKey, setActivePublicScheduleDateKey] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendees, setAttendees] = useState(1);
  const [needsScreen, setNeedsScreen] = useState(false);
  const [needsSound, setNeedsSound] = useState(false);
  const [needsMonitor, setNeedsMonitor] = useState(false);
  const [needsProjector, setNeedsProjector] = useState(false);
  const [needsWaterFilter, setNeedsWaterFilter] = useState(false);
  const [notes, setNotes] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");

  const formRef = useRef<HTMLDivElement>(null);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  const openNativeDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    input.click();
  };

  const handleDateInputClick = (input: HTMLInputElement | null) => {
    if (!input || typeof input.showPicker !== "function") return;

    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/auditorio/public/reservas", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("No se pudieron cargar las reservas públicas.");
        }

        const data = (await response.json()) as { reservas?: AuditorioReservaApi[] };
        if (!mounted) return;

        const loaded = (data.reservas ?? []).map((reserva, index) => ({
          id: reserva.id,
          title: "Evento",
          periodStartDate: reserva.fechaInicioPeriodo,
          periodEndDate: reserva.fechaFinPeriodo,
          color: colorFromIndex(index),
          scheduleBlocks: reserva.horarios
            .slice()
            .sort((a, b) => a.fechaEspecifica.localeCompare(b.fechaEspecifica) || a.horaInicio.localeCompare(b.horaInicio))
            .map((block) => ({
              id: block.id,
              date: block.fechaEspecifica,
              startTime: block.horaInicio,
              endTime: block.horaFin,
            })),
        }));

        setEvents(loaded);
        setSelectedEventId((current) => current ?? loaded[0]?.id ?? null);
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las reservas públicas.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const syncVisibleMonthCount = () => {
      setVisibleMonthCount(1);
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
      events.reduce<Record<string, PublicEvent[]>>((acc, event) => {
        event.scheduleBlocks.forEach((block) => {
          const key = toDateKey(parseISODate(block.date));
          if (!acc[key]) acc[key] = [];
          if (!acc[key].some((existing) => existing.id === event.id)) acc[key].push(event);
        });
        return acc;
      }, {}),
    [events]
  );

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  const selectedEventDates = selectedEvent
    ? selectedEvent.scheduleBlocks.slice().sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    : [];

  const minimumReservationDateKey = toDateKey(addDays(getColombiaToday(), 8));
  const visibleScheduleDates = scheduleMode === "multi"
    ? startDate && endDate
      ? getDatesBetweenKeys(startDate, endDate)
      : []
    : startDate
      ? [parseISODate(startDate)]
      : [];
  const orderedPublicScheduleBlocks = scheduleBlocks.slice().sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const activePublicScheduleBlock =
    scheduleBlocks.find((block) => block.date === activePublicScheduleDateKey) ?? orderedPublicScheduleBlocks[0] ?? null;

  const equipmentOptions = [
    { label: "Pantalla", checked: needsScreen, onChange: setNeedsScreen },
    { label: "Sonido", checked: needsSound, onChange: setNeedsSound },
    { label: "Monitor", checked: needsMonitor, onChange: setNeedsMonitor },
    { label: "Proyector", checked: needsProjector, onChange: setNeedsProjector },
    { label: "Filtro de agua", checked: needsWaterFilter, onChange: setNeedsWaterFilter },
  ] as const;
  const selectedEquipmentLabels = equipmentOptions.filter((option) => option.checked).map((option) => option.label);

  const resetPublicForm = () => {
    setScheduleMode("");
    setStartDate("");
    setEndDate("");
    setScheduleBlocks([]);
    setActivePublicScheduleDateKey(null);
    setTitle("");
    setEmail("");
    setConfirmEmail("");
    setStartTime("08:00");
    setEndTime("10:00");
    setAttendees(1);
    setNeedsScreen(false);
    setNeedsSound(false);
    setNeedsMonitor(false);
    setNeedsProjector(false);
    setNeedsWaterFilter(false);
    setNotes("");
    setRequesterName("");
    setRequesterPhone("");
  };

  const setScheduleModeAndAdjust = (mode: PublicScheduleMode) => {
    setScheduleMode(mode);

    if (mode === "single") {
      const nextDate = startDate || minimumReservationDateKey;
      setStartDate(nextDate);
      setEndDate(nextDate);
      setScheduleBlocks((current) => buildSingleScheduleBlock(nextDate, current));
      setActivePublicScheduleDateKey(nextDate);
      return;
    }

    if (mode === "multi") {
      const nextStart = startDate || minimumReservationDateKey;
      const nextEnd = endDate || toDateKey(addDays(parseISODate(nextStart), 1));
      const normalizedEnd = nextEnd < nextStart ? nextStart : nextEnd;
      setStartDate(nextStart);
      setEndDate(normalizedEnd);
      setScheduleBlocks((current) => buildScheduleBlocksForRange(nextStart, normalizedEnd, current));
      setActivePublicScheduleDateKey(nextStart);
      return;
    }

    setScheduleBlocks([]);
    setActivePublicScheduleDateKey(null);
  };

  const updateSingleScheduleBlock = (field: keyof PublicScheduleBlock, value: string) => {
    setScheduleBlocks((current) => {
      const first = current[0] ?? {
        id: `public-b1-${Date.now()}`,
        date: startDate || minimumReservationDateKey,
        startTime: "08:00",
        endTime: "10:00",
      };

      const nextBlock = { ...first, [field]: value };
      if (field === "date") {
        setStartDate(value);
        setEndDate(value);
        setActivePublicScheduleDateKey(value);
      }

      return [nextBlock];
    });
  };

  const updateMultiScheduleBlock = (blockId: string, field: keyof PublicScheduleBlock, value: string) => {
    setScheduleBlocks((current) =>
      current.map((block) =>
        block.id === blockId
          ? {
              ...block,
              [field]: value,
            }
          : block
      )
    );
  };

  const syncPublicRangeBlocks = (nextStart: string, nextEnd: string) => {
    const normalizedEnd = nextEnd < nextStart ? nextStart : nextEnd;
    setStartDate(nextStart);
    setEndDate(normalizedEnd);
    setScheduleBlocks((current) => buildScheduleBlocksForRange(nextStart, normalizedEnd, current));
  };

  const openForm = () => {
    setIsCreateOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!title.trim() || !email.trim() || !confirmEmail.trim()) {
      setFormError("Completa el nombre del evento y el correo.");
      return;
    }

    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setFormError("Los correos no coinciden.");
      return;
    }

    if (!scheduleMode) {
      setFormError("Selecciona si el evento es de un solo día o varios días.");
      return;
    }

    if (!startDate) {
      setFormError("Selecciona la fecha de inicio.");
      return;
    }

    if (!requesterName.trim()) {
      setFormError("Escribe el nombre del solicitante.");
      return;
    }

    if (!requesterPhone.trim()) {
      setFormError("Escribe el número de teléfono del solicitante.");
      return;
    }

    if (scheduleMode === "multi" && !endDate) {
      setFormError("Selecciona la fecha de fin.");
      return;
    }

    if (startDate < minimumReservationDateKey || (scheduleMode === "multi" && endDate < minimumReservationDateKey)) {
      setFormError("No es posible solicitar eventos con menos de 8 días de anticipación.");
      return;
    }

    if (scheduleMode === "multi" && endDate < startDate) {
      setFormError("La fecha de fin debe ser igual o posterior a la fecha de inicio.");
      return;
    }

    if (scheduleMode === "multi" && endDate === startDate) {
      setFormError("Para varios días debes seleccionar un rango de al menos 2 días.");
      return;
    }

    const fallbackBlocks = scheduleMode === "single"
      ? buildSingleScheduleBlock(startDate, scheduleBlocks)
      : buildScheduleBlocksForRange(startDate, endDate || startDate, scheduleBlocks);

    const validBlocks = (scheduleBlocks.length > 0 ? scheduleBlocks : fallbackBlocks).filter(
      (block) => block.date && block.startTime && block.endTime
    );

    const invalidBlock = validatePublicBlocksNoOverlap(validBlocks);
    if (invalidBlock) {
      setFormError(invalidBlock);
      return;
    }

    const overlapWith = hasOverlapWithOtherEvents(validBlocks, events);
    if (overlapWith) {
      toast.error(formatOverlapMessage(overlapWith));
      return;
    }

    if (validBlocks.some((block) => block.date < minimumReservationDateKey)) {
      setFormError("No es posible solicitar eventos con menos de 8 días de anticipación.");
      return;
    }

    if (validBlocks.some((block) => block.endTime <= block.startTime)) {
      setFormError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/auditorio/public/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreEvento: title.trim(),
          correo: email.trim(),
          confirmarCorreo: confirmEmail.trim(),
          solicitanteNombre: requesterName.trim(),
          solicitanteTelefono: requesterPhone.trim(),
            fechaInicioPeriodo: scheduleMode === "single" ? startDate : startDate,
            fechaFinPeriodo: scheduleMode === "single" ? startDate : endDate || startDate,
          numeroAsistentes: Number(attendees) || 1,
          requierePantalla: needsScreen,
          requiereSonido: needsSound,
          requiereMonitor: needsMonitor,
          requiereProyector: needsProjector,
          requiereFiltroAgua: needsWaterFilter,
          observaciones: notes.trim() || null,
            horarios: validBlocks.map((block) => ({
              fechaEspecifica: block.date,
              horaInicio: block.startTime,
              horaFin: block.endTime,
            })),
        }),
      });

      const responseBody = (await response.json().catch(() => null)) as { error?: string; message?: string; registeredEmailSent?: boolean } | null;

      if (!response.ok) {
        const body = responseBody;
        throw new Error(body?.error ?? body?.message ?? "No se pudo enviar la solicitud.");
      }

      if (responseBody?.registeredEmailSent === false) {
        toast.error("La solicitud se registró, pero no se pudo enviar el correo de confirmación. La administración podrá revisarla igualmente.");
      } else {
        toast.success("Solicitud enviada. Se registró correctamente y recibirás un correo mientras la administración revisa la solicitud.");
      }
      resetPublicForm();
      setIsCreateOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo enviar la solicitud.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] px-6 py-8 text-[#2a3439] sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#2a3439] mb-2">Auditorio G.W. Chapman</h1>
            <p className="text-[#566166] text-lg">Consulta los horarios públicos y solicita una reserva. La solicitud será revisada por la adminisración de los edificios académicos.</p>
          </div>
          <div className="bg-gradient-to-br from-[#3a5f94] to-[#2d5387] text-[#f6f7ff] p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center min-w-[280px]">
            <div className="text-3xl font-extrabold tracking-tight mb-1">UNAC</div>
            <div className="text-xs font-medium opacity-90 uppercase tracking-widest text-center">Corporación Universitaria Adventista de Colombia</div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 items-start">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-[#2a3439]">Horarios públicos</h3>
              </div>

              {loadError ? <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{loadError}</p> : null}
              {isLoading && !selectedEvent ? <p className="text-sm text-[#566166]">Cargando reservas...</p> : null}

              <div className="space-y-8">
                {monthsToShow.map((monthDate) => {
                  const days = buildMonthGrid(monthDate);
                  const weeks = chunkWeeks(days);
                  return (
                    <article key={toDateKey(monthDate)} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <div>
                          <h4 className="text-lg font-bold text-[#2a3439]">{monthNames[monthDate.getMonth()]} {monthDate.getFullYear()}</h4>
                          <p className="text-xs text-[#566166]">Calendario público del auditorio</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">←</button>
                          <button type="button" onClick={() => setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">→</button>
                        </div>
                      </div>

                      <div className="border-b border-slate-100 bg-[#f8fbfd] px-2 py-2">
                        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-widest text-[#566166]">
                          {weekDays.map((day) => <span key={day}>{day}</span>)}
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {weeks.map((week, weekIndex) => {
                          const segments = getWeekSegments(week, events);
                          const laneCount = Math.max(1, ...segments.map((segment) => segment.lane + 1));
                          const weekHasCurrentMonthDay = week.some((day) => day.getMonth() === monthDate.getMonth());
                          const laneAreaHeight = laneCount * 24;

                          return (
                            <div key={`${toDateKey(monthDate)}-week-${weekIndex}`} className={`relative overflow-hidden px-1.5 py-1.5 ${!weekHasCurrentMonthDay ? "bg-[#fbfdff]" : "bg-white"}`}>
                              <div className="grid grid-cols-7 gap-1">
                                {week.map((day) => {
                                  const key = toDateKey(day);
                                  const inCurrentMonth = day.getMonth() === monthDate.getMonth();
                                  const isToday = key === toDateKey(getColombiaToday());
                                  const dayEventsCount = (eventMapByDay[key] ?? []).length;

                                  return (
                                    <div
                                      key={key}
                                      className={`min-h-[122px] rounded-xl border px-2 py-2 transition ${inCurrentMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-[#f9fafb] text-slate-400"} ${isToday ? "ring-1 ring-[#295786]" : ""}`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex flex-col">
                                          <span className={`text-sm font-semibold ${isToday ? "text-[#295786]" : "text-slate-700"}`}>{day.getDate()}</span>
                                        </div>
                                      </div>

                                      <div style={{ height: laneAreaHeight + 6 }} />
                                      {dayEventsCount > 0 ? <p className="text-[10px] font-medium text-slate-500">{dayEventsCount} evento(s)</p> : null}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="pointer-events-none absolute inset-x-0 top-10 px-1.5">
                                <div className="grid grid-cols-7 gap-1" style={{ gridTemplateRows: `repeat(${laneCount}, minmax(0, 20px))` }}>
                                  {segments.map((segment) => {
                                    const isSelected = selectedEventId === segment.event.id;
                                    return (
                                      <button
                                        key={`${segment.event.id}-${weekIndex}-${segment.startCol}`}
                                        type="button"
                                        onClick={() => setSelectedEventId(segment.event.id)}
                                        className={`pointer-events-auto truncate rounded px-2 py-1 text-left text-[10px] font-semibold shadow-sm transition hover:brightness-95 ${eventStyles[segment.event.color]} ${isSelected ? "ring-1 ring-[#295786]" : ""}`}
                                        style={{
                                          gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`,
                                          gridRow: `${segment.lane + 1}`,
                                        }}
                                      >
                                        Evento
                                      </button>
                                    );
                                  })}
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
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
            <div className="bg-[#f0f4f7] rounded-3xl p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[#2a3439]">Detalle del evento</h3>
                <span className="bg-[#d5e3ff] text-[#2c5287] px-3 py-1 rounded-full text-xs font-bold">Público</span>
              </div>

              {selectedEvent ? (
                <div className="space-y-3 text-sm text-[#2a3439]">
                  <p><span className="font-semibold">Titulo:</span> Evento</p>
                  <p><span className="font-semibold">Duracion:</span> {diffDays(getEventBounds(selectedEvent).end, getEventBounds(selectedEvent).start) + 1} dia(s)</p>
                  <div className="space-y-2">
                    <p className="font-semibold">Horarios:</p>
                    {selectedEventDates.map((block) => (
                      <div key={block.id} className="rounded-2xl border border-white/70 bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#2a3439]">
                          <span className="material-symbols-outlined text-[18px] text-[#3a5f94]">calendar_month</span>
                          <span>{formatDateShort(block.date)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-[#566166]">
                          <span className="material-symbols-outlined text-[18px] text-[#3a5f94]">schedule</span>
                          <span>{formatTimeAmPm(block.startTime)} - {formatTimeAmPm(block.endTime)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#566166]">Selecciona un bloque en el calendario para ver sus horarios.</p>
              )}
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#2a3439]">Reservar evento</h3>
                  <p className="text-sm text-[#566166]">La solicitud quedará pendiente para validación.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="group flex w-full items-center justify-between rounded-2xl border border-[#295786] bg-gradient-to-br from-[#3a5f94] to-[#2d5387] px-5 py-4 text-left text-white shadow-[0_14px_30px_rgba(41,87,134,0.22)] transition hover:brightness-105"
              >
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15 text-white">
                    <span className="material-symbols-outlined text-[26px]">event_available</span>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-white">Reservar evento</p>
                    <p className="text-sm text-white/85">Solicita tu reserva en unos segundos</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[28px] text-white transition group-hover:translate-x-1">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 p-4 backdrop-blur-[2px]">
          <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#faf8ff] shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 md:px-8">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-full p-2 text-[#295786] transition hover:bg-[#d5e3ff]"
                  aria-label="Volver"
                >
                  <span className="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
                <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[#295786] md:text-[22px]">Solicitar reserva pública</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-[#295786] transition hover:bg-[#d5e3ff]"
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

              <form className="grid grid-cols-12 gap-6" onSubmit={submitRequest}>
                <div className="col-span-12 lg:col-span-7 space-y-6">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-6 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">info</span>
                      Información de la solicitud
                    </h3>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="md:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Nombre del evento</span>
                        <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej: Seminario de investigación" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10" required />
                      </label>

                      <label>
                        <span className="mb-2 block text-sm font-medium text-slate-700">Correo</span>
                        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@ejemplo.com" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10" required />
                      </label>

                      <label>
                        <span className="mb-2 block text-sm font-medium text-slate-700">Confirmar correo</span>
                        <input type="email" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} placeholder="repite el correo" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10" required />
                      </label>

                      <label className="md:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Nombre del solicitante</span>
                        <input type="text" value={requesterName} onChange={(event) => setRequesterName(event.target.value)} placeholder="Nombre completo" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10" required />
                      </label>

                      <label>
                        <span className="mb-2 block text-sm font-medium text-slate-700">Teléfono del solicitante</span>
                        <input type="tel" value={requesterPhone} onChange={(event) => setRequesterPhone(event.target.value)} placeholder="(317) 555-0123" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10" required />
                      </label>

                      <label>
                        <span className="mb-2 block text-sm font-medium text-slate-700">Asistentes estimados</span>
                        <input type="number" min={1} value={attendees} onChange={(event) => setAttendees(Number(event.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10" />
                      </label>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 bg-[#f8fbfd] p-4">
                      <span className="block text-sm font-semibold text-[#295786]">¿Evento de un solo día o varios días?</span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setScheduleModeAndAdjust("single")}
                          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                            scheduleMode === "single"
                              ? "bg-[#295786] text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Un solo día
                        </button>

                        <button
                          type="button"
                          onClick={() => setScheduleModeAndAdjust("multi")}
                          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                            scheduleMode === "multi"
                              ? "bg-[#295786] text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          Varios días
                        </button>
                      </div>
                    </div>

                    {scheduleMode === "single" ? (
                      <div className="mt-4">
                        <label>
                          <span className="mb-2 block text-sm font-medium text-slate-700">Fecha</span>
                          <div
                            role="button"
                            tabIndex={0}
                            onPointerDown={(event) => {
                              if (event.target === event.currentTarget) {
                                openNativeDatePicker(startDateInputRef.current);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openNativeDatePicker(startDateInputRef.current);
                              }
                            }}
                            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm outline-none transition focus-within:border-[#295786] focus-within:ring-4 focus-within:ring-[#295786]/10"
                          >
                            <input
                              ref={startDateInputRef}
                              type="date"
                              min={minimumReservationDateKey}
                              value={startDate}
                              onClick={() => handleDateInputClick(startDateInputRef.current)}
                              onChange={(event) => {
                                const value = event.target.value;
                                setStartDate(value);
                                setEndDate(value);
                                setActivePublicScheduleDateKey(value);
                                setScheduleBlocks((current) => buildSingleScheduleBlock(value, current));
                              }}
                              className="w-full bg-transparent text-sm text-slate-900 outline-none"
                              required
                            />
                          </div>
                        </label>
                      </div>
                    ) : null}

                    {scheduleMode === "multi" ? (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label>
                          <span className="mb-2 block text-sm font-medium text-slate-700">Fecha de inicio</span>
                          <div
                            role="button"
                            tabIndex={0}
                            onPointerDown={(event) => {
                              if (event.target === event.currentTarget) {
                                openNativeDatePicker(startDateInputRef.current);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openNativeDatePicker(startDateInputRef.current);
                              }
                            }}
                            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm outline-none transition focus-within:border-[#295786] focus-within:ring-4 focus-within:ring-[#295786]/10"
                          >
                            <input
                              ref={startDateInputRef}
                              type="date"
                              min={minimumReservationDateKey}
                              value={startDate}
                              onClick={() => handleDateInputClick(startDateInputRef.current)}
                              onChange={(event) => syncPublicRangeBlocks(event.target.value, endDate || event.target.value)}
                              className="w-full bg-transparent text-sm text-slate-900 outline-none"
                              required
                            />
                          </div>
                        </label>

                        <label>
                          <span className="mb-2 block text-sm font-medium text-slate-700">Fecha de fin</span>
                          <div
                            role="button"
                            tabIndex={0}
                            onPointerDown={(event) => {
                              if (event.target === event.currentTarget) {
                                openNativeDatePicker(endDateInputRef.current);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openNativeDatePicker(endDateInputRef.current);
                              }
                            }}
                            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm outline-none transition focus-within:border-[#295786] focus-within:ring-4 focus-within:ring-[#295786]/10"
                          >
                            <input
                              ref={endDateInputRef}
                              type="date"
                              min={startDate || minimumReservationDateKey}
                              value={endDate}
                              onClick={() => handleDateInputClick(endDateInputRef.current)}
                              onChange={(event) => syncPublicRangeBlocks(startDate || event.target.value, event.target.value)}
                              className="w-full bg-transparent text-sm text-slate-900 outline-none"
                              required
                            />
                          </div>
                        </label>
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">schedule</span>
                      Días y Horarios Intercalados
                    </h3>

                    <div className="space-y-4">
                      {scheduleMode === "" ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-[#fafcff] px-4 py-8 text-center">
                          <p className="text-sm text-slate-500">Selecciona "Un solo día" o "Varios días" arriba para configurar los días y horarios.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {scheduleMode === "single" ? (
                            <div className="rounded-2xl border border-dashed border-[#c7d4ea] bg-[#f7f9ff] p-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-700">Horario del día</p>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#295786] shadow-sm">Un solo bloque</span>
                              </div>

                              {scheduleBlocks.slice(0, 1).map((block) => (
                                <div key={block.id} className="grid gap-3 md:grid-cols-2 md:items-end">
                                  <label>
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de inicio</span>
                                    <select
                                      value={block.startTime}
                                      onChange={(event) => updateSingleScheduleBlock("startTime", event.target.value)}
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10"
                                    >
                                      <option value="">Selecciona hora</option>
                                      {getTimeOptions().map((option) => (
                                        <option key={`public-single-start-${block.id}-${option.value}`} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>
                                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de fin</span>
                                    <select
                                      value={block.endTime}
                                      onChange={(event) => updateSingleScheduleBlock("endTime", event.target.value)}
                                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10"
                                    >
                                      <option value="">Selecciona hora</option>
                                      {getEndTimeOptions(block.startTime).map((option) => (
                                        <option key={`public-single-end-${block.id}-${option.value}`} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              ))}
                            </div>
                          ) : visibleScheduleDates.length > 0 ? (
                            <>
                              <div className="rounded-2xl border border-dashed border-[#c7d4ea] bg-[#f7f9ff] p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-slate-700">Días del rango</p>
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#295786] shadow-sm">
                                    {activePublicScheduleDateKey ? formatDateLabel(parseISODate(activePublicScheduleDateKey)) : "Sin día activo"}
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {visibleScheduleDates.map((date) => {
                                    const dateKey = toDateKey(date);
                                    const isActive = activePublicScheduleDateKey === dateKey;

                                    return (
                                      <button
                                        key={dateKey}
                                        type="button"
                                        onClick={() => setActivePublicScheduleDateKey(dateKey)}
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
                              </div>

                              {activePublicScheduleBlock ? (
                                <div className="rounded-2xl border border-dashed border-[#c7d4ea] bg-[#f7f9ff] p-4">
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#295786] shadow-sm">
                                      {formatDateLabel(parseISODate(activePublicScheduleBlock.date))}
                                    </div>
                                    <span className="text-xs font-medium text-slate-500">Día activo</span>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                                    <label>
                                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de inicio</span>
                                      <select
                                        value={activePublicScheduleBlock.startTime}
                                        onChange={(event) => updateMultiScheduleBlock(activePublicScheduleBlock.id, "startTime", event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10"
                                      >
                                        <option value="">Selecciona hora</option>
                                        {getTimeOptions().map((option) => (
                                          <option key={`public-multi-start-${activePublicScheduleBlock.id}-${option.value}`} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label>
                                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de fin</span>
                                      <select
                                        value={activePublicScheduleBlock.endTime}
                                        onChange={(event) => updateMultiScheduleBlock(activePublicScheduleBlock.id, "endTime", event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10"
                                      >
                                        <option value="">Selecciona hora</option>
                                        {getEndTimeOptions(activePublicScheduleBlock.startTime).map((option) => (
                                          <option key={`public-multi-end-${activePublicScheduleBlock.id}-${option.value}`} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => setActivePublicScheduleDateKey(null)}
                                      className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-50 hover:text-[#295786]"
                                      title="Quitar selección"
                                    >
                                      <span className="material-symbols-outlined text-[20px]">delete</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                                  Selecciona un día del rango para ver y editar su horario.
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-[#fafcff] px-4 py-8 text-center">
                              <p className="text-sm text-slate-500">Aún no hay intervalos definidos.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                      Equipamiento
                    </h3>

                    <div className="grid gap-3 md:grid-cols-2">
                      {equipmentOptions.map((option) => (
                        <label key={option.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#fafcff] p-3 transition hover:bg-[#f4f7ff]">
                          <input type="checkbox" checked={option.checked} onChange={(event) => option.onChange(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#295786] focus:ring-[#295786]" />
                          <span className="text-sm font-medium text-slate-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">notes</span>
                      Notas Adicionales
                    </h3>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Observaciones</span>
                      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Cuéntanos brevemente para qué necesitas el auditorio." className="min-h-[140px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#295786] focus:ring-4 focus:ring-[#295786]/10" />
                    </label>
                  </section>
                </div>

                <div className="col-span-12 lg:col-span-5 space-y-6">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-[#295786]">
                      <span className="material-symbols-outlined text-[22px]">event_available</span>
                      Resumen
                    </h3>

                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-[#f8fbfd] p-4 text-sm text-slate-700">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          <p className="text-s font-extrabold uppercase tracking-[0.12em] text-slate-600">Evento</p>
                          <p className="mt-1 text-sm font-medium uppercase text-slate-700">{title || "Evento"}</p>
                        </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Correo</p>
                          <p className="mt-1 break-all text-sm font-medium text-slate-700">{email || "Sin registrar"}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Asistentes</p>
                          <p className="mt-1 text-sm font-medium text-slate-700">{attendees || 1}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Asegúrate de escribir bien el correo. Ahí te comunicaremos toda la información de tu solicitud.
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Equipamiento</p>
                        {selectedEquipmentLabels.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedEquipmentLabels.map((item) => (
                              <span key={item} className="rounded-full bg-[#d5e3ff] px-3 py-1 text-xs font-semibold text-[#2c5287]">
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm font-medium text-slate-500">Sin equipamiento seleccionado</p>
                        )}
                      </div>


                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fecha inicio</p>
                          <p className="mt-1 text-sm font-medium text-slate-700">{startDate ? formatDateShort(startDate) : "Sin seleccionar"}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fecha fin</p>
                          <p className="mt-1 text-sm font-medium text-slate-700">{endDate ? formatDateShort(endDate) : (startDate ? formatDateShort(startDate) : "Sin seleccionar")}</p>
                        </div>
                      </div>

                      {scheduleMode === "single" ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Horario</p>
                          <div className="mt-2 rounded-xl border border-slate-200 bg-[#f8fbfd] px-3 py-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Día</p>
                            <p className="mt-1 text-sm font-medium text-slate-700">{startDate ? formatDateShort(startDate) : "Sin seleccionar"}</p>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-[#f8fbfd] px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de inicio</p>
                              <p className="mt-1 text-sm font-medium text-slate-700">{scheduleBlocks[0]?.startTime ? formatTimeAmPm(scheduleBlocks[0].startTime) : "--"}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-[#f8fbfd] px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de fin</p>
                              <p className="mt-1 text-sm font-medium text-slate-700">{scheduleBlocks[0]?.endTime ? formatTimeAmPm(scheduleBlocks[0].endTime) : "--"}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <p className="font-semibold text-slate-700">Horario</p>
                            {visibleScheduleDates.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {visibleScheduleDates.map((date) => {
                                  const dateKey = toDateKey(date);
                                  const isActive = activePublicScheduleDateKey === dateKey || (!activePublicScheduleDateKey && dateKey === toDateKey(visibleScheduleDates[0]));

                                  return (
                                    <button
                                      key={dateKey}
                                      type="button"
                                      onClick={() => setActivePublicScheduleDateKey(dateKey)}
                                      className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                                        isActive
                                          ? "bg-[#295786] text-white"
                                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                      }`}
                                    >
                                      {formatDateShort(dateKey)}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-slate-500">Sin días configurados.</p>
                            )}
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Día activo</p>
                            <p className="mt-1 text-sm font-medium text-slate-700">
                              {activePublicScheduleDateKey ? formatDateShort(activePublicScheduleDateKey) : (visibleScheduleDates[0] ? formatDateShort(toDateKey(visibleScheduleDates[0])) : "Sin seleccionar")}
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="rounded-xl border border-slate-200 bg-[#f8fbfd] px-3 py-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de inicio</p>
                                <p className="mt-1 text-sm font-medium text-slate-700">{activePublicScheduleBlock?.startTime ? formatTimeAmPm(activePublicScheduleBlock.startTime) : "--"}</p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-[#f8fbfd] px-3 py-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Hora de fin</p>
                                <p className="mt-1 text-sm font-medium text-slate-700">{activePublicScheduleBlock?.endTime ? formatTimeAmPm(activePublicScheduleBlock.endTime) : "--"}</p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 rounded-xl border border-[#295786] px-5 py-3 text-sm font-medium text-[#295786] transition hover:bg-[#d5e3ff]">
                        Cancelar
                      </button>
                      <button type="submit" disabled={isSaving} className="flex-1 rounded-xl bg-[#295786] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(41,87,134,0.24)] transition hover:bg-[#1f4a74] disabled:cursor-not-allowed disabled:opacity-70">
                        {isSaving ? "Enviando..." : "Solicitar reserva"}
                      </button>
                    </div>
                  </section>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
