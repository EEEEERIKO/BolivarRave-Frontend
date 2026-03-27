"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
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

const DAY_COLORS: Record<ScheduleItem["day"], string> = {
  Monday: "#295786",
  Tuesday: "#1f8f6a",
  Wednesday: "#c7801d",
  Thursday: "#7c4d9e",
  Friday: "#cd3f3f",
};

const DAY_LABELS: Record<ScheduleItem["day"], string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
};

const ALL_DAYS: ScheduleItem["day"][] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOURS = Array.from({ length: 14 }, (_, idx) => 7 + idx);

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
  Wednesday: "Miercoles",
  Thursday: "Jueves",
  Friday: "Viernes",
};

const toMinutes = (time: string) => {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
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
      ? weekday
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

export default function Home() {
  const [query, setQuery] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "empty" | "professors" | "rooms">("all");
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [importsHistory, setImportsHistory] = useState<ImportHistoryItem[]>([]);
  const [roomsCatalog, setRoomsCatalog] = useState<string[]>([]);
  const [roomsByFloor, setRoomsByFloor] = useState<Array<{ floor: number; rooms: RoomsInfoRoom[] }>>([]);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    let cancelled = false;

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

        const floors = (roomsInfoBody?.roomsByFloor ?? [])
          .map((group) => {
            const floor = group[0]?.piso ?? null;
            return floor ? { floor, rooms: group } : null;
          })
          .filter((entry): entry is { floor: number; rooms: RoomsInfoRoom[] } => entry !== null)
          .sort((a, b) => a.floor - b.floor);

        setRoomsByFloor(floors);
        setSelectedFloor((prev) => prev ?? floors[0]?.floor ?? null);
      } catch {
        if (cancelled) return;
        setScheduleItems([]);
        setRoomsCatalog([]);
        setImportsHistory([]);
        setRoomsByFloor([]);
        setSelectedFloor(null);
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

  const roomUniverse = useMemo(() => {
    if (roomsCatalog.length > 0) return roomsCatalog;
    return Array.from(new Set(scheduleItems.map((item) => item.room))).sort();
  }, [roomsCatalog, scheduleItems]);

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
            currentMinutes < toMinutes(item.end)
        )
        .map((item) => item.room)
    );
  }, [todayDay, scheduleItems, currentMinutes, todayIso]);

  const roomsInClassNow = activeRoomsNow.size;
  const roomsAvailableNow = Math.max(totalRooms - roomsInClassNow, 0);

  const uniqueWeeklyClasses = useMemo(
    () => new Set(scheduleItems.map((item) => item.classId)).size,
    [scheduleItems]
  );

  const latestImport = importsHistory[0];
  const pendingConflicts = Math.max(
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

  const kpis = [
    {
      title: "Rooms in Class Now",
      value: String(roomsInClassNow),
      chip: totalRooms > 0 ? `${Math.round((roomsInClassNow / totalRooms) * 100)}% Active` : "No rooms",
      chipClasses: "bg-green-50 text-green-600 dark:bg-green-900/20",
    },
    {
      title: "Rooms Available",
      value: String(roomsAvailableNow),
      chip: "Ready for Booking",
      chipClasses: "bg-[#295786]/10 text-[#295786]",
    },
    {
      title: "Total Weekly Classes",
      value: uniqueWeeklyClasses.toLocaleString("en-US"),
      chip: "From database",
      chipClasses: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
    {
      title: "Last Import",
      value: latestImport ? new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit" }).format(new Date(latestImport.imported_at)) : "N/A",
      chip: latestImport ? latestImport.status : "No history",
      chipClasses: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
  ];

  const immediateActions = useMemo(() => {
    const actions: Array<{ title: string; detail: string; level: string; icon: string; classes: string }> = [];

    if (pendingConflicts > 0) {
      actions.push({
        title: `Resolve ${pendingConflicts} schedule conflict${pendingConflicts === 1 ? "" : "s"}`,
        detail: "Revisa conflictos pendientes en la ultima importacion.",
        level: "High",
        icon: "warning",
        classes: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20",
      });
    }

    if (!isLoadingData && scheduleItems.length === 0) {
      actions.push({
        title: "No schedule loaded",
        detail: "Importa un archivo para comenzar a poblar la agenda.",
        level: "Medium",
        icon: "upload_file",
        classes: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20",
      });
    }

    if (isLoadingData) {
      actions.push({
        title: "Syncing dashboard data",
        detail: "Actualizando eventos e historial desde la base de datos.",
        level: "Low",
        icon: "sync",
        classes: "border-[#295786]/20 bg-[#295786]/5 text-[#295786]",
      });
    }

    if (actions.length === 0) {
      actions.push({
        title: "System running normally",
        detail: "No critical actions pending right now.",
        level: "Info",
        icon: "task_alt",
        classes: "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20",
      });
    }

    return actions.slice(0, 3);
  }, [pendingConflicts, isLoadingData, scheduleItems.length]);

  const todayEvents = useMemo(() => {
    if (!todayDay) return [];
    return scheduleItems.filter((item) => item.day === todayDay && item.startDate <= todayIso && todayIso <= item.endDate);
  }, [scheduleItems, todayDay, todayIso]);

  const peakToday = useMemo(() => {
    if (!todayDay) return "N/A";
    let bestHour = "07:00";
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
    if (todayEvents.length === 0) return "N/A";

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

    if (maxMinutes === 0) return "N/A";

    const winners = [...occupancyByRoom.entries()]
      .filter(([, minutes]) => minutes === maxMinutes)
      .map(([room]) => room)
      .sort((a, b) => a.localeCompare(b));

    return winners.join(", ");
  }, [todayEvents]);

  const todayOverview = [
    { label: "Classes Today", value: String(todayEvents.length), icon: "calendar_today" },
    { label: "Peak Hour", value: peakToday, icon: "schedule" },
    { label: "Rooms Fully Booked", value: String(new Set(todayEvents.map((item) => item.room)).size), icon: "meeting_room" },
    { label: "Most Occupied Room", value: mostOccupiedRoomsToday, icon: "bar_chart" },
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
        const status = `Starts in ${Math.max(diff, 0)} min`;
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
        status: daysAhead === 0 ? "Today" : DAY_LABELS[item.day],
        statusClasses: "bg-slate-100 text-slate-600 dark:bg-slate-800",
      }));
  }, [todayEvents, scheduleItems, currentMinutes, todayDay, todayIso]);

  const recentActivity = useMemo(
    () =>
      importsHistory.slice(0, 4).map((item) => ({
        text: `Import ${item.source_file} (${item.status})`,
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
          conflicts: day === todayDay ? pendingConflicts : 0,
        };
      }),
    [occupancyByHour, totalRooms, pendingConflicts, todayDay]
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
          room: room.nombre,
          label: "In Class" as const,
          classes: "border-red-500/30 bg-red-100 text-red-700 dark:bg-red-900/20",
          textClass: "text-red-600/70",
        };
      }

      if (startingSoon) {
        return {
          room: room.nombre,
          label: "Starting Soon" as const,
          classes: "border-amber-500/30 bg-amber-100 text-amber-700 dark:bg-amber-900/20",
          textClass: "text-amber-600/70",
        };
      }

      return {
        room: room.nombre,
        label: "Available" as const,
        classes: "border-green-500/30 bg-green-100 text-green-700 dark:bg-green-900/20",
        textClass: "text-green-600/70",
      };
    });
  }, [roomsByFloor, selectedFloor, todayDay, currentMinutes]);

  const normalizedSubmittedQuery = normalizeText(submittedQuery);

  const searchResults = useMemo(() => {
    const scored = scheduleItems.map((item) => ({ item, score: scoreMatch(item, normalizedSubmittedQuery) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.day.localeCompare(b.item.day) || a.item.start.localeCompare(b.item.start));

    if (!normalizedSubmittedQuery) return [];
    return scored.slice(0, 12);
  }, [normalizedSubmittedQuery, scheduleItems]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setIsSearchModalOpen(false);
      setSubmittedQuery("");
      return;
    }

    setSubmittedQuery(trimmed);
    setIsSearchModalOpen(true);
  };

  const handleQuickFilter = (type: "empty" | "professors" | "rooms") => {
    setFilterType(type);
    const queries = {
      empty: "available",
      professors: "free professor",
      rooms: "room available",
    };
    setQuery(queries[type]);
    setSubmittedQuery(queries[type]);
    setIsSearchModalOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-xs font-medium tracking-wider text-slate-500 uppercase">{kpi.title}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{kpi.value}</h3>
              <span className={`rounded px-2 py-1 text-xs font-bold ${kpi.chipClasses}`}>{kpi.chip}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-9">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Immediate Actions</h4>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold tracking-wider text-red-700 uppercase dark:bg-red-900/30 dark:text-red-300">
                  {immediateActions.length} pending
                </span>
              </div>
              <div className="space-y-3">
                {immediateActions.map((action) => (
                  <div key={action.title} className={`flex gap-3 rounded-xl border p-4 ${action.classes}`}>
                    <span className="material-symbols-outlined text-base">{action.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{action.title}</p>
                      <p className="text-[11px] opacity-90">{action.detail}</p>
                    </div>
                    <span className="ml-auto h-fit rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-slate-700 dark:bg-slate-950/20 dark:text-slate-100">
                      {action.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 xl:p-5">
              <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Quick Actions</h4>
              <div className="mt-1 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-1 flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-[#295786]/10 text-[#295786]">
                    <span className="material-symbols-outlined">person_search</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Search Rooms / Professors</p>
                    <p className="text-xs text-slate-500">Busca por clase, profesor, salon, dia u hora. Incluye coincidencias similares.</p>
                  </div>
                </div>
                <form onSubmit={handleSearchSubmit} className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ej: Programming, Mendez, Room 405, Tuesday 10:00"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none ring-[#295786]/30 transition focus:ring-4 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#295786] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
                  >
                    Search
                  </button>
                </form>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleQuickFilter("empty")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filterType === "empty" ? "bg-[#295786] text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                  >
                    <span className="material-symbols-outlined text-xs align-text-bottom">event_busy</span> Empty Classes
                  </button>
                  <button
                    onClick={() => handleQuickFilter("professors")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filterType === "professors" ? "bg-[#295786] text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                  >
                    <span className="material-symbols-outlined text-xs align-text-bottom">person_check</span> Free Professors
                  </button>
                  <button
                    onClick={() => handleQuickFilter("rooms")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filterType === "rooms" ? "bg-[#295786] text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                  >
                    <span className="material-symbols-outlined text-xs align-text-bottom">room</span> Available Rooms
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Los resultados se muestran en un modal al ejecutar la busqueda.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">System Health</h4>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-2.5 dark:border-green-900/40 dark:bg-green-900/20">
                <p className="text-[11px] font-bold text-green-700 dark:text-green-300">Schedule Status</p>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/50 dark:text-green-300">Healthy</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Conflicts</p>
                  <p className="mt-1 text-lg font-black text-slate-800 dark:text-slate-100">{pendingConflicts}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">
                  <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Data Integrity</p>
                  <p className="mt-1 text-lg font-black text-slate-800 dark:text-slate-100">{scheduleItems.length > 0 ? "Good" : "Empty"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[#295786]/20 bg-[#295786]/5 p-2.5 text-[#295786]">
                <span className="material-symbols-outlined text-base">sync</span>
                <div>
                  <p className="text-xs font-bold">Last sync</p>
                  <p className="text-[11px] opacity-80">{latestImport ? formatRelativeTime(latestImport.imported_at) : "No imports yet"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:col-span-12 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Hourly Room Occupancy</h4>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold tracking-wider text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-300">Live Data</span>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={occupancyByHour}>
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, Math.max(totalRooms, 1)]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickCount={8} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      fontSize: 12,
                    }}
                  />
                  {ALL_DAYS.map((day) => (
                    <Line
                      key={day}
                      type="monotone"
                      dataKey={day}
                      name={DAY_LABELS[day]}
                      stroke={DAY_COLORS[day]}
                      strokeWidth={2.2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {ALL_DAYS.map((day) => (
                <span key={day} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="size-2 rounded-full" style={{ backgroundColor: DAY_COLORS[day] }} />
                  {DAY_LABELS[day]}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Today Overview</h4>
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

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Next Classes</h4>
            <button className="text-xs font-bold text-[#295786] hover:underline">View All</button>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
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
              <div className="p-4 text-sm text-slate-500">No classes starting in the next 30 minutes.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-5 dark:border-slate-800">
              <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Weekly Building Overview</h4>
              <p className="mt-1 text-[11px] text-slate-500">Compact weekly trend for planning, not real-time operations.</p>
            </div>
            <div className="space-y-2 p-4">
              {compactWeeklyOverview.map((day) => (
                <div key={day.day} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{day.day}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">{day.occupancy}% occupancy</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full bg-[#295786]" style={{ width: `${day.occupancy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-5 dark:border-slate-800">
              <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Recent Activity</h4>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentActivity.map((activity) => (
                <div key={activity.text} className="flex items-start gap-3 p-4">
                  <span className="material-symbols-outlined mt-0.5 text-base text-[#295786]">{activity.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{activity.text}</p>
                    <p className="text-xs text-slate-500">{activity.when}</p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className="p-4 text-sm text-slate-500">No import activity recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Mini Building Map Preview</h4>
            <p className="mt-1 text-xs text-slate-500">Real-time room occupancy status visualization</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {floorNumbers.map((floor) => (
              <button
                key={floor}
                type="button"
                onClick={() => setSelectedFloor(floor)}
                className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase ${selectedFloor === floor ? "bg-white text-[#295786] shadow-sm dark:bg-slate-700" : "text-slate-500 hover:bg-white/50 dark:hover:bg-slate-700/50"}`}
              >
                FL {floor}
              </button>
            ))}
            {floorNumbers.length === 0 && (
              <span className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase">No floors</span>
            )}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {miniMapRooms.map((room) => (
            <div key={room.room} className={`group flex min-h-[98px] cursor-default flex-col justify-between rounded-xl border-2 p-3 ${room.classes}`}>
              <span className="line-clamp-2 text-center text-xs font-black leading-tight md:text-sm">{room.room}</span>
              <span className={`text-center text-[10px] font-bold uppercase ${room.textClass}`}>{room.label || "Available"}</span>
            </div>
          ))}
          {miniMapRooms.length === 0 && (
            <div className="col-span-2 rounded-xl border border-slate-200 p-4 text-sm text-slate-500 md:col-span-4 lg:col-span-6">
              No room data available for this floor.
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-green-500" />
              <span className="text-xs font-medium text-slate-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-red-500" />
              <span className="text-xs font-medium text-slate-600">In Class</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-amber-500" />
              <span className="text-xs font-medium text-slate-600">Starting Soon</span>
            </div>
          </div>
          <button className="w-full rounded-xl bg-[#295786] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#295786]/20 transition-all hover:scale-105 active:scale-95 sm:w-auto">
            Open Full Building Map
          </button>
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
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Search Results</p>
                <p className="text-xs text-slate-500">Query: {submittedQuery}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="max-h-[68vh] space-y-3 overflow-y-auto p-5">
              {searchResults.length === 0 && (
                <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  No encontramos coincidencias para esa busqueda.
                </p>
              )}
              {searchResults.map(({ item }) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.subject}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{item.professor} • {item.room}</p>
                  <p className="mt-1 text-xs font-medium text-[#295786]">{item.day} • {item.start} - {item.end}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
