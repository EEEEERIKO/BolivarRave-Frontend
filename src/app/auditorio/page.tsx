"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  attendees: number;
  needsScreen: boolean;
  needsSound: boolean;
  observations: string;
  color: "blue" | "emerald" | "amber";
  scheduleBlocks: ScheduleBlock[];
};

type NewEventFormState = {
  title: string;
  organizer: string;
  startDate: string;
  endDate: string;
  attendees: string;
  needsScreen: boolean;
  needsSound: boolean;
  observations: string;
  scheduleBlocks: ScheduleBlock[];
};

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

const initialEvents: AuditoriumEvent[] = [
  {
    id: "aud-1",
    title: "Congreso de Innovacion Educativa",
    organizer: "Vicerrectoria Academica",
    attendees: 240,
    needsScreen: true,
    needsSound: true,
    observations: "Se requiere prueba tecnica el dia anterior.",
    color: "blue",
    scheduleBlocks: [
      { id: "aud-1-b1", date: "2026-03-18", startTime: "08:00", endTime: "12:00" },
      { id: "aud-1-b2", date: "2026-03-19", startTime: "13:00", endTime: "17:00" },
      { id: "aud-1-b3", date: "2026-03-20", startTime: "08:00", endTime: "10:30" },
    ],
  },
  {
    id: "aud-2",
    title: "Ensayo Coral UNAC",
    organizer: "Bienestar Universitario",
    attendees: 90,
    needsScreen: false,
    needsSound: true,
    observations: "Montaje de microfonos inalambricos.",
    color: "emerald",
    scheduleBlocks: [{ id: "aud-2-b1", date: "2026-04-09", startTime: "16:00", endTime: "18:30" }],
  },
  {
    id: "aud-3",
    title: "Charla Chapman Tech Talks",
    organizer: "Facultad de Ingenieria",
    attendees: 160,
    needsScreen: true,
    needsSound: true,
    observations: "Se solicita grabacion de la jornada.",
    color: "amber",
    scheduleBlocks: [{ id: "aud-3-b1", date: "2026-05-15", startTime: "10:00", endTime: "12:00" }],
  },
];

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

function createEmptyFormState(): NewEventFormState {
  return {
    title: "",
    organizer: "",
    startDate: "2026-03-17",
    endDate: "2026-03-17",
    attendees: "",
    needsScreen: false,
    needsSound: false,
    observations: "",
    scheduleBlocks: [
      {
        id: "new-b1",
        date: "2026-03-17",
        startTime: "08:00",
        endTime: "10:00",
      },
    ],
  };
}

export default function AuditorioPage() {
  const monthPickerRef = useRef<HTMLDivElement>(null);

  const colombiaToday = useMemo(() => getColombiaToday(), []);
  const [events, setEvents] = useState<AuditoriumEvent[]>(initialEvents);
  const [selectedEventId, setSelectedEventId] = useState<string | null>("aud-1");
  const [monthCursor, setMonthCursor] = useState(new Date(2026, 2, 1));
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formState, setFormState] = useState<NewEventFormState>(createEmptyFormState());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(2026);

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

  const monthsToShow = useMemo(
    () => [0, 1].map((offset) => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + offset, 1)),
    [monthCursor]
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

  const periodLabel = `${monthNames[monthsToShow[0].getMonth()]} ${monthsToShow[0].getFullYear()} - ${monthNames[monthsToShow[1].getMonth()]} ${monthsToShow[1].getFullYear()}`;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  function openCreateModal() {
    setFormState(createEmptyFormState());
    setIsCreateOpen(true);
  }

  function openMonthPicker() {
    setPickerYear(monthCursor.getFullYear());
    setIsMonthPickerOpen(true);
  }

  function closeCreateModal() {
    setIsCreateOpen(false);
  }

  function moveEventToDate(eventId: string, newStartDate: Date) {
    setEvents((current) =>
      current.map((event) => {
        if (event.id !== eventId) return event;

        const originalDates = event.scheduleBlocks
          .map((block) => parseISODate(block.date))
          .sort((a, b) => a.getTime() - b.getTime());

        if (originalDates.length === 0) return event;

        const originalStart = originalDates[0];
        const delta = diffDays(newStartDate, originalStart);

        return {
          ...event,
          scheduleBlocks: event.scheduleBlocks.map((block) => ({
            ...block,
            date: toDateKey(addDays(parseISODate(block.date), delta)),
          })),
        };
      })
    );
  }

  function updateScheduleBlock(blockId: string, field: keyof ScheduleBlock, value: string) {
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
    setFormState((current) => ({
      ...current,
      scheduleBlocks: [
        ...current.scheduleBlocks,
        {
          id: `new-b${current.scheduleBlocks.length + 1}-${Date.now()}`,
          date: current.startDate || "2026-03-17",
          startTime: "08:00",
          endTime: "10:00",
        },
      ],
    }));
  }

  function removeScheduleBlock(blockId: string) {
    setFormState((current) => {
      if (current.scheduleBlocks.length === 1) return current;
      return {
        ...current,
        scheduleBlocks: current.scheduleBlocks.filter((block) => block.id !== blockId),
      };
    });
  }

  function handleCreateEventSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validBlocks = formState.scheduleBlocks.filter(
      (block) => block.date && block.startTime && block.endTime && block.endTime > block.startTime
    );

    if (!formState.title.trim() || !formState.organizer.trim() || validBlocks.length === 0) {
      alert("Completa nombre, organizador y al menos un horario valido.");
      return;
    }

    const colorPalette: AuditoriumEvent["color"][] = ["blue", "emerald", "amber"];
    const nextColor = colorPalette[events.length % colorPalette.length];

    const normalizedBlocks = validBlocks
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .map((block, index) => ({
        ...block,
        id: `evt-${Date.now()}-b${index + 1}`,
      }));

    const newEvent: AuditoriumEvent = {
      id: `evt-${Date.now()}`,
      title: formState.title.trim(),
      organizer: formState.organizer.trim(),
      attendees: Number(formState.attendees) || 0,
      needsScreen: formState.needsScreen,
      needsSound: formState.needsSound,
      observations: formState.observations.trim(),
      color: nextColor,
      scheduleBlocks: normalizedBlocks,
    };

    setEvents((current) => [...current, newEvent]);
    setSelectedEventId(newEvent.id);
    setIsCreateOpen(false);
  }

  return (
    <div className="p-6">
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Calendario Auditorio Chapman</h1>
            <p className="text-sm text-slate-500">Panel de calendario del Auditorio GW Chapman</p>
          </div>
        </div>
      </div>

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
                  <span className="font-semibold">Recursos:</span>{" "}
                  {[selectedEvent.needsScreen ? "Pantalla" : null, selectedEvent.needsSound ? "Sonido" : null].filter(Boolean).join(", ") || "Ninguno"}
                </p>
                <p>
                  <span className="font-semibold">Horarios:</span> {getEventScheduleSummary(selectedEvent)}
                </p>
                <p>
                  <span className="font-semibold">Observaciones:</span> {selectedEvent.observations || "Sin observaciones"}
                </p>
                <p className="text-xs text-slate-500">Tip: arrastra la barra del evento y sueltala en otro dia para moverla.</p>
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
              <h2 className="text-lg font-bold text-slate-900">Agregar evento al auditorio</h2>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-md border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleCreateEventSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Nombre del evento
                  <input
                    type="text"
                    value={formState.title}
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Quien lo organiza
                  <input
                    type="text"
                    value={formState.organizer}
                    onChange={(event) => setFormState((current) => ({ ...current, organizer: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm text-slate-700">
                  Fecha inicio
                  <input
                    type="date"
                    value={formState.startDate}
                    onChange={(event) => setFormState((current) => ({ ...current, startDate: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Fecha fin
                  <input
                    type="date"
                    value={formState.endDate}
                    onChange={(event) => setFormState((current) => ({ ...current, endDate: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Numero de asistentes
                  <input
                    type="number"
                    min={0}
                    value={formState.attendees}
                    onChange={(event) => setFormState((current) => ({ ...current, attendees: event.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
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
                  {formState.scheduleBlocks.map((block) => (
                    <div key={block.id} className="grid gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                      <input
                        type="date"
                        value={block.date}
                        onChange={(event) => updateScheduleBlock(block.id, "date", event.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="time"
                        value={block.startTime}
                        onChange={(event) => updateScheduleBlock(block.id, "startTime", event.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="time"
                        value={block.endTime}
                        onChange={(event) => updateScheduleBlock(block.id, "endTime", event.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeScheduleBlock(block.id)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
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
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-[#295786] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1f466d]">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
