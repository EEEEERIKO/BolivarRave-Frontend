"use client";

import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Rnd, RndDragCallback, RndResizeCallback } from "react-rnd";

type ScheduleEvent = {
  id: string;
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
  color: "blue" | "emerald" | "amber" | "violet";
};

type NewEventForm = {
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

const getInitialNewEvent = (): NewEventForm => ({
  faculty: "",
  code: "",
  subject: "",
  teacher: "",
  startDate: "2026-02-09",
  endDate: "2026-06-12",
  day: "Lunes",
  room: rooms[0],
  start: "08:00",
  end: "10:00",
});

const weekDays = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const shortMonthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const pickerWeekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const rooms = [
  "Aula Foro Union",
  "Aula Foro UNAC",
  "Sala Informatica 1 Bolivar",
  "Sala Informatica 2 Bolivar",
  "Sala de Simulacion 1",
  "Sala de Simulacion 2",
  "Sala de Simulacion 3",
  "Laboratorio de analisis de datos y simulacion financiera",
  "Laboratorio de Desarrollo de Software (LDS)",
  "Laboratorio de Fisica",
  "Laboratorio de Infantil",
  "Laboratorio de Musica",
  "Laboratorio TAPH Bucaramanga",
  "Presencial asistida por tecnologia",
  "Sala de Capacitacion - Lab Industrial",
  "Sala de Informatica ICOLVEN - Primer piso",
  "Sala de Informatica ICOLVEN - Segundo piso",
  "Sala de Produccion y Picking- Lab Industrial",
  "Salon 16 TAPH",
  "Salon 18 TAPH",
  "Salon 19 TAPH",
  "Salon 20 TAPH",
  "Salon 21 TAPH",
  "Salon 22 TAPH",
  "Salon 29 TAPH",
  "Salon 200",
  "Salon 201",
  "Salon 202",
  "Salon 203",
  "Salon 205",
  "Salon 206",
  "Salon 301",
  "Salon 302",
  "Salon 303",
  "Salon 304",
  "Salon 305",
  "Salon 401",
  "Salon 402",
  "Salon 406",
  "Salon 505",
  "Salon 506",
  "Salon Academia de Musica 103",
  "Salon Academia de Musica 104",
  "Salon Academia de Musica 105",
  "Salon Academia de Musica 107",
  "Salon Academia de Musica 108",
  "Salon Academia de Musica 109",
  "Salon Academia de Musica 200",
  "Salon Academia de Musica 203",
  "Salon Academia de Musica 204",
  "Salon Academia de Musica 205",
  "Salon Academia de Musica 206",
  "Salon Academia de Musica 301",
  "Salon Academia de Musica 303",
  "Salon Academia de Musica 304",
  "Salon Academia de Musica 305",
  "Aula Interamericana 501",
  "Aula Interamericana 502",
  "Aula Interamericana 503",
  "Solicitar salon a Planeacion",
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

const initialEvents: ScheduleEvent[] = [
  {
    id: "ev-1",
    day: "Lunes",
    room: "Salon 301",
    start: "08:00",
    end: "10:00",
    faculty: "Ingenieria",
    code: "APH 23613",
    subject: "SALVAMENTO Y RESCATE II",
    teacher: "ESPINOSA ECHAVARRIA JESUS",
    startDate: "2026-02-09",
    endDate: "2026-06-12",
    color: "blue",
  },
  {
    id: "ev-2",
    day: "Martes",
    room: "Laboratorio de Desarrollo de Software (LDS)",
    start: "10:00",
    end: "12:00",
    faculty: "Teologia y Religion",
    code: "MERT-1101",
    subject: "EL HECHO RELIGIOSO 1",
    teacher: "DOCENTE PENDIENTE ASIGNAR FTR 2",
    startDate: "2026-02-09",
    endDate: "2026-06-12",
    color: "emerald",
  },
  {
    id: "ev-3",
    day: "Miercoles",
    room: "Sala de Simulacion 2",
    start: "14:00",
    end: "15:30",
    faculty: "Humanidades",
    code: "HUM-203",
    subject: "ETICA EN TECNOLOGIA",
    teacher: "Prof. Jamila",
    startDate: "2026-02-09",
    endDate: "2026-06-12",
    color: "amber",
  },
];

const eventStyles: Record<ScheduleEvent["color"], string> = {
  blue: "bg-blue-100 border-blue-600 text-blue-900",
  emerald: "bg-emerald-100 border-emerald-600 text-emerald-900",
  amber: "bg-amber-100 border-amber-600 text-amber-900",
  violet: "bg-violet-100 border-violet-600 text-violet-900",
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

export default function SchedulesPage() {
  const weekPickerRef = useRef<HTMLDivElement>(null);

  const colombiaToday = useMemo(() => getColombiaToday(), []);
  const [selectedDay, setSelectedDay] = useState(getWeekdayName(colombiaToday));
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeekMonday(colombiaToday));
  const [currentTimeSlotIndex, setCurrentTimeSlotIndex] = useState(() => getCurrentTimeSlotIndex(timeSlots));
  const [isWeekPickerOpen, setIsWeekPickerOpen] = useState(false);
  const [pickerMonthCursor, setPickerMonthCursor] = useState(startOfMonth(colombiaToday));
  const [roomQuery, setRoomQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>(initialEvents);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState<NewEventForm>(getInitialNewEvent);
  const [editEvent, setEditEvent] = useState<NewEventForm>(getInitialNewEvent);

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

  const resetCreateForm = () => {
    setCreateError(null);
    setNewEvent(getInitialNewEvent());
  };

  const filteredRooms = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) => room.toLowerCase().includes(query));
  }, [roomQuery]);

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
    () => events.filter((event) => event.day === selectedDay && filteredRooms.includes(event.room)),
    [events, selectedDay, filteredRooms]
  );

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
  const showCurrentTimeMarker = selectedDay === getWeekdayName(colombiaToday) && isTodayInVisibleWeek;

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  const timeColWidth = 130;
  const roomColWidth = 220;
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

    setEvents((current) =>
      current.map((event) => {
        if (event.id !== id) return event;

        return {
          ...event,
          day: selectedDay,
          room: filteredRooms[newRoomIndex],
          start: slotStarts[newStartIndex],
          end: slotEnds[endSlotIndex],
        };
      })
    );
  };

  const handleDragStop = (id: string, span: number): RndDragCallback => {
    return (_event, data) => {
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

      setEvents((all) =>
        all.map((event) => {
          if (event.id !== id) return event;
          return {
            ...event,
            day: selectedDay,
            room: filteredRooms[newRoomIndex],
            start: slotStarts[newStartIndex],
            end: slotEnds[endSlotIndex],
          };
        })
      );
    };
  };

  const createEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!rooms.includes(newEvent.room)) {
      const message = "Salon invalido: debes seleccionar un salon de la lista disponible.";
      setCreateError(message);
      window.alert(message);
      return;
    }

    const newStartIndex = startToIndex[newEvent.start] ?? -1;
    const newEndExclusive = endToExclusiveIndex[newEvent.end] ?? -1;

    if (newStartIndex < 0 || newEndExclusive < 0 || newEndExclusive <= newStartIndex) {
      const message = "Horario invalido: la hora fin debe ser mayor que la hora inicio.";
      setCreateError(message);
      window.alert(message);
      return;
    }

    const overlappingClass = events.find((existing) => {
      if (existing.day !== newEvent.day || existing.room !== newEvent.room) {
        return false;
      }

      const existingStart = startToIndex[existing.start] ?? -1;
      const existingEnd = endToExclusiveIndex[existing.end] ?? -1;

      if (existingStart < 0 || existingEnd < 0) return false;

      return newStartIndex < existingEnd && existingStart < newEndExclusive;
    });

    if (overlappingClass) {
      const message = `Conflicto detectado: ya existe "${overlappingClass.code} | ${overlappingClass.subject}" en ${newEvent.room} para ese horario.`;
      setCreateError(message);
      window.alert(message);
      return;
    }

    const id = `ev-${Date.now()}`;
    setEvents((current) => [
      ...current,
      {
        id,
        day: newEvent.day,
        room: newEvent.room,
        start: newEvent.start,
        end: newEvent.end,
        faculty: newEvent.faculty || "Sin facultad",
        code: newEvent.code || "SIN-CODIGO",
        subject: newEvent.subject || "CLASE NUEVA",
        teacher: newEvent.teacher || "DOCENTE PENDIENTE",
        startDate: newEvent.startDate,
        endDate: newEvent.endDate,
        color: "blue",
      },
    ]);

    setSelectedDay(newEvent.day);
    setSelectedEventId(id);
    resetCreateForm();
    setIsCreateOpen(false);
  };

  const startEditEvent = () => {
    if (!selectedEvent) return;

    setEditEvent({
      faculty: selectedEvent.faculty,
      code: selectedEvent.code,
      subject: selectedEvent.subject,
      teacher: selectedEvent.teacher,
      startDate: selectedEvent.startDate,
      endDate: selectedEvent.endDate,
      day: selectedEvent.day,
      room: selectedEvent.room,
      start: selectedEvent.start,
      end: selectedEvent.end,
    });
    setEditError(null);
    setIsEditMode(true);
  };

  const saveEditEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEvent) return;

    if (!rooms.includes(editEvent.room)) {
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
      if (existing.day !== editEvent.day || existing.room !== editEvent.room) return false;

      const existingStart = startToIndex[existing.start] ?? -1;
      const existingEnd = endToExclusiveIndex[existing.end] ?? -1;

      if (existingStart < 0 || existingEnd < 0) return false;
      return newStartIndex < existingEnd && existingStart < newEndExclusive;
    });

    if (overlappingClass) {
      const message = `Conflicto detectado: ya existe "${overlappingClass.code} | ${overlappingClass.subject}" en ${editEvent.room} para ese horario.`;
      setEditError(message);
      window.alert(message);
      return;
    }

    setEvents((all) =>
      all.map((item) => {
        if (item.id !== selectedEvent.id) return item;
        return {
          ...item,
          faculty: editEvent.faculty,
          code: editEvent.code,
          subject: editEvent.subject,
          teacher: editEvent.teacher,
          startDate: editEvent.startDate,
          endDate: editEvent.endDate,
          day: editEvent.day,
          room: editEvent.room,
          start: editEvent.start,
          end: editEvent.end,
        };
      })
    );

    setSelectedDay(editEvent.day);
    setEditError(null);
    setIsEditMode(false);
  };

  const deleteSelectedEvent = () => {
    if (!selectedEvent) return;
    const accepted = window.confirm(`Eliminar la clase \"${selectedEvent.code} | ${selectedEvent.subject}\"?`);
    if (!accepted) return;

    setEvents((all) => all.filter((item) => item.id !== selectedEvent.id));
    setSelectedEventId(null);
    setIsEditMode(false);
    setEditError(null);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="sticky top-20 z-30 mb-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold">Academic Planner - Schedules</h1>
            <span className="rounded-full bg-[#295786]/10 px-3 py-1 text-xs font-semibold text-[#295786]">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {weekDays.map((day, index) => {
                const thisDayDate = addDays(currentWeekStart, index);
                const isToday = dateValue(thisDayDate) === dateValue(colombiaToday);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
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

            <input
              type="text"
              value={roomQuery}
              onChange={(e) => setRoomQuery(e.target.value)}
              placeholder="Filtrar salon..."
              className="h-10 w-56 rounded-lg border border-slate-200 px-3 text-sm outline-none ring-[#295786]/30 focus:ring"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
        <section className="relative isolate overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-auto" style={{ maxHeight: "75vh" }}>
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
                      {slot}
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
                        title={`${room} - ${slot}`}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>

              {visibleEvents.map((event) => {
                const geom = eventGeometry(event, filteredRooms);
                if (geom.roomIndex < 0) return null;

                const hasEnoughSpace = geom.span >= 4;

                return (
                  <Rnd
                    key={event.id}
                    bounds="parent"
                    dragGrid={[roomColWidth, slotHeight]}
                    resizeGrid={[roomColWidth, slotHeight]}
                    size={{ width: geom.width, height: geom.height }}
                    position={{ x: geom.x, y: geom.y }}
                    enableResizing={{
                      top: true,
                      right: false,
                      bottom: true,
                      left: false,
                      topRight: false,
                      bottomRight: false,
                      bottomLeft: false,
                      topLeft: false,
                    }}
                    onDragStop={handleDragStop(event.id, geom.span)}
                    onResizeStop={handleResizeStop(event.id)}
                    onClick={() => {
                      setSelectedEventId(event.id);
                      setIsEditMode(false);
                      setEditError(null);
                    }}
                    className={`z-10 overflow-hidden rounded-lg border-l-4 p-2 text-left shadow-sm transition hover:shadow-md ${eventStyles[event.color]} ${
                      selectedEventId === event.id ? "ring-2 ring-[#295786]" : ""
                    }`}
                    minHeight={slotHeight - 8}
                    minWidth={roomColWidth - 8}
                  >
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
                  </Rnd>
                );
              })}
            </div>
          </div>
        </section>

        <div className="h-fit xl:sticky xl:top-24">
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
                    <p className="text-xs font-semibold text-[#295786]">{selectedEvent.day}</p>
                    <h3 className="mt-1 text-base font-bold">{selectedEvent.code} | {selectedEvent.subject}</h3>
                    <p className="mt-2 text-sm text-slate-600">Facultad: {selectedEvent.faculty}</p>
                    <p className="text-sm text-slate-600">Docente: {selectedEvent.teacher}</p>
                    <p className="text-sm text-slate-600">Salon: {selectedEvent.room}</p>
                    <p className="text-sm text-slate-600">Horario: {selectedEvent.start} - {selectedEvent.end}</p>
                    <p className="text-sm text-slate-600">Rango: {selectedEvent.startDate} a {selectedEvent.endDate}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={startEditEvent}
                        className="rounded-lg bg-[#295786] px-3 py-2 text-sm font-semibold text-white"
                      >
                        Modificar datos
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedEvent}
                        className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                      >
                        Eliminar clase
                      </button>
                    </div>
                  </>
                ) : (
                  <form className="space-y-3" onSubmit={saveEditEvent}>
                  {editError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {editError}
                    </div>
                  )}

                  <input
                    required
                    value={editEvent.faculty}
                    onChange={(e) => setEditEvent((s) => ({ ...s, faculty: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Facultad"
                  />
                  <input
                    required
                    value={editEvent.code}
                    onChange={(e) => setEditEvent((s) => ({ ...s, code: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Codigo"
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
                      {rooms.map((room, index) => (
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
                          {slot}
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
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button type="submit" className="rounded-lg bg-[#295786] px-3 py-2 text-sm font-semibold text-white">
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditMode(false);
                        setEditError(null);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedEvent}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Eliminar
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
        </div>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={createEvent} className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Agregar nueva clase</h3>
            <p className="mt-1 text-sm text-slate-500">
              Formato antiguo: Facultad : CODIGO | MATERIA | DOCENTE | FECHA INICIO | FECHA FIN
            </p>

            {createError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input required placeholder="Facultad" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.faculty} onChange={(e) => setNewEvent((s) => ({ ...s, faculty: e.target.value }))} />
              <input required placeholder="Codigo" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.code} onChange={(e) => setNewEvent((s) => ({ ...s, code: e.target.value }))} />
              <input required placeholder="Materia" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={newEvent.subject} onChange={(e) => setNewEvent((s) => ({ ...s, subject: e.target.value }))} />
              <input required placeholder="Docente" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" value={newEvent.teacher} onChange={(e) => setNewEvent((s) => ({ ...s, teacher: e.target.value }))} />
              <input required type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.startDate} onChange={(e) => setNewEvent((s) => ({ ...s, startDate: e.target.value }))} />
              <input required type="date" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.endDate} onChange={(e) => setNewEvent((s) => ({ ...s, endDate: e.target.value }))} />
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.day} onChange={(e) => setNewEvent((s) => ({ ...s, day: e.target.value }))}>
                {weekDays.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.room} onChange={(e) => setNewEvent((s) => ({ ...s, room: e.target.value }))}>
                {rooms.map((room, index) => <option key={`${room}-${index}`} value={room}>{room}</option>)}
              </select>
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.start} onChange={(e) => setNewEvent((s) => ({ ...s, start: e.target.value }))}>
                {slotStarts.map((slot) => <option key={`s-${slot}`} value={slot}>{slot}</option>)}
              </select>
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={newEvent.end} onChange={(e) => setNewEvent((s) => ({ ...s, end: e.target.value }))}>
                {slotEnds.map((slot) => <option key={`e-${slot}`} value={slot}>{slot}</option>)}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                onClick={() => {
                  resetCreateForm();
                  setIsCreateOpen(false);
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="rounded-lg bg-[#295786] px-4 py-2 text-sm font-semibold text-white">
                Guardar clase
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
