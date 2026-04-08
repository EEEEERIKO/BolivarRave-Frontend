/* eslint-disable @next/next/no-img-element */
"use client";

import { fetchApiJson } from "@/lib/api-client";
import { getCachedData, setCachedData } from "@/lib/cache-storage";
import { useEffect, useMemo, useRef, useState } from "react";

type StaffView = "directory" | "schedule";
type ContractPlan = "Plan 1" | "Plan 2" | "Plan 3" | "Plan Monitoria" | "Plan Especial";
type WeekDay = "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado";
type StaffAccessRoleId = 1 | 2 | 3;

type BirthDateParts = {
  year: string;
  month: string;
  day: string;
};

type UnavailableClassSlot = {
  id: string;
  day: WeekDay | "";
  startTime: string;
  endTime: string;
};

type StaffEstado = "Active" | "Inactive";

type StaffApi = {
  id: string;
  numeroStaff: number;
  roleId: number;
  rol: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono: string;
  fechaNacimiento: string;
  carrera: string;
  tipoContrato: ContractPlan;
  conocimientoSonido: boolean;
  estado: StaffEstado;
  balanceHoras: number;
  bloqueosClase: Array<{
    id: string;
    diaSemana: string;
    horaInicio: string;
    horaFin: string;
  }>;
};

type WorkWeekDay = WeekDay | "Domingo";

type StaffJornadaItem = {
  id: string;
  staffId: string;
  diaSemana: WorkWeekDay;
  horaEntrada: string;
  horaSalida: string;
  totalHorasDia: number;
};

type StaffJornadaResponse = {
  jornadas?: StaffJornadaItem[];
};

type StaffPausaItem = {
  id: string;
  staffId: string;
  diaSemana: WorkWeekDay;
  tipoPausa: "Comida" | "Descanso";
  horaInicio: string;
  horaFin: string;
};

type StaffPausaResponse = {
  pausas?: StaffPausaItem[];
};

type EditableJornadaItem = {
  id: string;
  diaSemana: WorkWeekDay | "";
  horaEntrada: string;
  horaSalida: string;
  totalHorasDia: string;
};

type EditablePausaItem = {
  id: string;
  diaSemana: WorkWeekDay | "";
  tipoPausa: "Comida" | "Descanso";
  horaInicio: string;
  horaFin: string;
};

const HOURS = [
  "05:00",
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

const TIMELINE_START_MINUTES = 5 * 60;
const TIMELINE_END_MINUTES = 22 * 60;
const TIMELINE_TOTAL_MINUTES = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES;

const WEEK_DAYS: WeekDay[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function calculateHoursDifference(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start < 0 || end < 0 || end <= start) return 0;
  return Number(((end - start) / 60).toFixed(1));
}

const ACADEMIC_DAY_COLUMNS = [
  { key: "lunes", label: "L", dayName: "Lunes" },
  { key: "martes", label: "M", dayName: "Martes" },
  { key: "miercoles", label: "X", dayName: "Miércoles" },
  { key: "jueves", label: "J", dayName: "Jueves" },
  { key: "viernes", label: "V", dayName: "Viernes" },
  { key: "sabado", label: "S", dayName: "Sábado" },
  { key: "domingo", label: "D", dayName: "Domingo" },
] as const;

const ACADEMIC_TIME_SEGMENTS = [
  { key: "morning", start: 6 * 60, end: 12 * 60 },
  { key: "afternoon", start: 12 * 60, end: 18 * 60 },
  { key: "evening", start: 18 * 60, end: 22 * 60 },
] as const;

const ACADEMIC_SEGMENT_ROWS = [
  { label: "Mañana", range: "06:00-12:00" },
  { label: "Tarde", range: "12:00-18:00" },
  { label: "Noche", range: "18:00-22:00" },
] as const;

const DAY_SORT_ORDER: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
};

const BIRTH_MONTH_OPTIONS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
] as const;

const CLASS_TIME_OPTIONS = Array.from({ length: 33 }, (_, index) => {
  const totalMinutes = 6 * 60 + index * 30;
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minute = String(totalMinutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
});

function normalizeDayName(dayName: string): string {
  return dayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function timeToMinutes(value: string): number {
  const [rawHour, rawMinute] = value.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute ?? "0");

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return -1;
  }

  return hour * 60 + minute;
}

function parseBirthDate(value: string): BirthDateParts {
  const [year = "", month = "", day = ""] = (value ?? "").split("-");
  return { year, month, day };
}

function getDaysInMonth(year: string, month: string): number {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return 0;
  }

  return new Date(parsedYear, parsedMonth, 0).getDate();
}

function buildBirthDate(parts: BirthDateParts): string {
  if (!parts.year || !parts.month || !parts.day) {
    return "";
  }

  const daysInMonth = getDaysInMonth(parts.year, parts.month);
  const parsedDay = Number(parts.day);

  if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > daysInMonth) {
    return "";
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

const ACCESS_ROLE_OPTIONS: Array<{ value: StaffAccessRoleId; label: string }> = [
  { value: 1, label: "Administrador" },
  { value: 2, label: "Monitor" },
  { value: 3, label: "Colaborador" },
];

const accessRoleLabelById: Record<StaffAccessRoleId, string> = {
  1: "Administrador",
  2: "Monitor",
  3: "Colaborador",
};

const MASTER_WEEK_DAYS: WorkWeekDay[] = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const PAUSA_TIPOS: Array<"Comida" | "Descanso"> = ["Comida", "Descanso"];
const WORK_DAY_ORDER: Record<WorkWeekDay, number> = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Domingo: 7,
};

const getCurrentWorkWeekDay = (): WorkWeekDay => {
  const currentDay = new Date().getDay();
  const dayMap: WorkWeekDay[] = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return dayMap[currentDay] ?? "Lunes";
};

function StaffScheduleBoard({ staffList, isLoadingStaff }: { staffList: StaffApi[]; isLoadingStaff: boolean }) {
  const [jornadaByStaffId, setJornadaByStaffId] = useState<Record<string, StaffJornadaItem[]>>({});
  const [isLoadingJornadas, setIsLoadingJornadas] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffApi | null>(null);
  const [editorRows, setEditorRows] = useState<EditableJornadaItem[]>([]);
  const [isSavingJornada, setIsSavingJornada] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<WorkWeekDay>(() => getCurrentWorkWeekDay());
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);

  // Sync vertical scrolls between left and right columns
  useEffect(() => {
    const leftCol = leftColumnRef.current;
    const rightCol = rightColumnRef.current;
    if (!leftCol || !rightCol) return;

    const handleLeftScroll = () => {
      rightCol.scrollTop = leftCol.scrollTop;
    };
    const handleRightScroll = () => {
      leftCol.scrollTop = rightCol.scrollTop;
    };

    leftCol.addEventListener("scroll", handleLeftScroll);
    rightCol.addEventListener("scroll", handleRightScroll);
    return () => {
      leftCol.removeEventListener("scroll", handleLeftScroll);
      rightCol.removeEventListener("scroll", handleRightScroll);
    };
  }, []);

  const activeStaffCount = staffList.filter((staff) => staff.estado === "Active").length;
  const hourCells = useMemo(
    () =>
      HOURS.map((hour) => (
        <div key={hour} className="flex h-[56px] items-center justify-center px-4 text-center text-[10px] font-bold leading-none whitespace-nowrap tabular-nums text-[#566166]">
          {hour}
        </div>
      )),
    [],
  );
  const staffWithSchedule = staffList.filter((staff) => (jornadaByStaffId[staff.id]?.length ?? 0) > 0).length;
  const withoutScheduleCount = Math.max(staffList.length - staffWithSchedule, 0);
  const totalHoursScheduled = staffList.reduce((sum, staff) => {
    const total = (jornadaByStaffId[staff.id] ?? []).reduce((acc, row) => acc + row.totalHorasDia, 0);
    return sum + total;
  }, 0);

  const formatDayHoursLabel = (rows: StaffJornadaItem[]) => `${rows.reduce((sum, row) => sum + row.totalHorasDia, 0).toFixed(1)} h`;

  const loadJornadas = async () => {
    if (staffList.length === 0) {
      setJornadaByStaffId({});
      return;
    }

    const staffIds = new Set(staffList.map((staff) => staff.id));
    const cachedJornadas = getCachedData<Record<string, StaffJornadaItem[]>>("jornadas_map");
    const hasCached = Boolean(cachedJornadas && Object.keys(cachedJornadas).length > 0);

    try {
      // Show cached data immediately; revalidate in background.
      if (hasCached && cachedJornadas) {
        const cachedMap: Record<string, StaffJornadaItem[]> = {};
        for (const staffId of staffIds) {
          cachedMap[staffId] = cachedJornadas[staffId] ?? [];
        }
        setJornadaByStaffId(cachedMap);
      }

      setIsLoadingJornadas(!hasCached);
      setScheduleError(null);

      const results = await Promise.all(
        staffList.map(async (staff) => {
          const response = await fetchApiJson<StaffJornadaResponse>(`/api/staff/${staff.id}/jornada-semanal`, {
            cache: "no-store",
          }).catch(() => ({ jornadas: [] }));
          return {
            staffId: staff.id,
            jornadas: Array.isArray(response.jornadas) ? response.jornadas : [],
          };
        }),
      );

      const nextMap: Record<string, StaffJornadaItem[]> = {};
      for (const result of results) {
        nextMap[result.staffId] = result.jornadas;
      }

      setJornadaByStaffId(nextMap);
      setCachedData("jornadas_map", nextMap, { ttl: 10 * 60 * 1000 });
    } catch (error) {
      if (!hasCached) {
        setScheduleError(error instanceof Error ? error.message : "No se pudo cargar la jornada semanal.");
      }
    } finally {
      setIsLoadingJornadas(false);
    }
  };

  useEffect(() => {
    void loadJornadas();
  }, [staffList]);

  const getDefaultRows = () => [
    {
      id: `jornada-${Date.now()}-1`,
      diaSemana: "",
      horaEntrada: "07:00",
      horaSalida: "12:00",
      totalHorasDia: "5",
    },
  ] as EditableJornadaItem[];

  const openEditor = (staff: StaffApi) => {
    const current = jornadaByStaffId[staff.id] ?? [];
    const mappedRows: EditableJornadaItem[] = current.length > 0
      ? [...current]
        .sort((left, right) => {
          const dayDelta = (WORK_DAY_ORDER[left.diaSemana] ?? 99) - (WORK_DAY_ORDER[right.diaSemana] ?? 99);
          if (dayDelta !== 0) return dayDelta;

          const timeDelta = timeToMinutes(left.horaEntrada) - timeToMinutes(right.horaEntrada);
          if (timeDelta !== 0) return timeDelta;

          return left.id.localeCompare(right.id);
        })
        .map((row, index) => ({
          id: row.id || `row-${index}`,
          diaSemana: row.diaSemana,
          horaEntrada: row.horaEntrada,
          horaSalida: row.horaSalida,
          totalHorasDia: String(row.totalHorasDia),
        }))
      : getDefaultRows();

    setEditingStaff(staff);
    setEditorRows(mappedRows);
    setIsEditorOpen(true);
    setScheduleError(null);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingStaff(null);
    setEditorRows([]);
  };

  const addEditorRow = () => {
    setEditorRows((prev) => [
      ...prev,
      {
        id: `jornada-${Date.now()}-${prev.length + 1}`,
        diaSemana: "",
        horaEntrada: "07:00",
        horaSalida: "12:00",
        totalHorasDia: "5",
      },
    ]);
  };

  const removeEditorRow = (rowId: string) => {
    setEditorRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const updateEditorRow = (rowId: string, field: keyof Omit<EditableJornadaItem, "id">, value: string) => {
    setEditorRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value };
        // Auto-calculate totalHorasDia when times change
        if (field === "horaEntrada" || field === "horaSalida") {
          updated.totalHorasDia = String(calculateHoursDifference(updated.horaEntrada, updated.horaSalida));
        }
        return updated;
      })
    );
  };

  const validateEditorRows = () => {
    if (editorRows.length === 0) {
      return "Debes agregar al menos un bloque de jornada.";
    }

    for (const [index, row] of editorRows.entries()) {
      const blockLabel = `Bloque ${index + 1}`;

      if (!row.diaSemana) {
        return `${blockLabel}: debes seleccionar un dia.`;
      }

      if (!row.horaEntrada) {
        return `${blockLabel} (${row.diaSemana}): falta la hora de entrada.`;
      }

      if (!row.horaSalida) {
        return `${blockLabel} (${row.diaSemana}): falta la hora de salida.`;
      }

      if (!row.totalHorasDia) {
        return `${blockLabel} (${row.diaSemana}): no se pudo calcular el total de horas.`;
      }

      const start = timeToMinutes(row.horaEntrada);
      const end = timeToMinutes(row.horaSalida);
      const totalHoras = Number(row.totalHorasDia);

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return `${blockLabel} (${row.diaSemana}): la hora de salida debe ser mayor a la hora de entrada.`;
      }

      if (!Number.isFinite(totalHoras) || totalHoras < 0) {
        return `${blockLabel} (${row.diaSemana}): total de horas invalido.`;
      }

      const bruto = (end - start) / 60;
      if (totalHoras > bruto + 0.01) {
        return `${blockLabel} (${row.diaSemana}): el total de horas excede el rango horario.`;
      }

      for (let j = index + 1; j < editorRows.length; j += 1) {
        const other = editorRows[j];
        if (other.diaSemana !== row.diaSemana) continue;

        const otherStart = timeToMinutes(other.horaEntrada);
        const otherEnd = timeToMinutes(other.horaSalida);
        if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd)) continue;

        const otherLabel = `Bloque ${j + 1}`;
        const isExactDuplicate = start === otherStart && end === otherEnd;
        if (isExactDuplicate) {
          return `${blockLabel} y ${otherLabel} (${row.diaSemana}): tienen el mismo horario duplicado.`;
        }

        const overlaps = start < otherEnd && otherStart < end;
        if (overlaps) {
          return `${blockLabel} y ${otherLabel} (${row.diaSemana}): los horarios se solapan.`;
        }
      }
    }

    return null;
  };

  const saveJornada = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingStaff) {
      return;
    }

    const validationError = validateEditorRows();
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setIsSavingJornada(true);

      await fetchApiJson<{ message: string; staffId: string }>(`/api/staff/${editingStaff.id}/jornada-semanal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jornadas: editorRows.map((row) => ({
            diaSemana: row.diaSemana,
            horaEntrada: row.horaEntrada,
            horaSalida: row.horaSalida,
            totalHorasDia: Number(row.totalHorasDia),
          })),
        }),
      });

      await loadJornadas();
      closeEditor();
      alert("Horario laboral actualizado correctamente.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo guardar la jornada semanal.");
    } finally {
      setIsSavingJornada(false);
    }
  };

  const compactDayLabel = (rows: StaffJornadaItem[]) => {
    const days = rows.map((row) => row.diaSemana);
    return days.join(", ");
  };

  const getBandStyle = (jornada: StaffJornadaItem[]) => {
    if (jornada.length === 0) {
      return { left: "0%", right: "68%" };
    }

    const start = jornada
      .map((row) => timeToMinutes(row.horaEntrada))
      .filter((value) => value >= 0)
      .sort((left, right) => left - right)[0] ?? TIMELINE_START_MINUTES;
    const end = jornada
      .map((row) => timeToMinutes(row.horaSalida))
      .filter((value) => value >= 0)
      .sort((left, right) => right - left)[0] ?? TIMELINE_START_MINUTES + 60;

    const normalizedStart = Math.max(start, TIMELINE_START_MINUTES);
    const normalizedEnd = Math.min(end, TIMELINE_END_MINUTES);
    const leftPct = ((normalizedStart - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100;
    const rightPct = ((TIMELINE_END_MINUTES - normalizedEnd) / TIMELINE_TOTAL_MINUTES) * 100;

    return {
      left: `${Math.max(0, leftPct)}%`,
      right: `${Math.max(0, rightPct)}%`,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2a3439]">Horario maestro semanal del personal</h2>
          <p className="mt-1 text-sm text-[#566166]">Vista diaria • {selectedScheduleDay}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f0f4f7] p-1">
          {MASTER_WEEK_DAYS.map((day) => {
            const isSelected = day === selectedScheduleDay;
            return (
              <button
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${isSelected ? "bg-white text-[#3a5f94] shadow-sm" : "text-[#566166] hover:bg-white/70"}`}
                key={day}
                onClick={() => setSelectedScheduleDay(day)}
                type="button"
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Personal activo</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#2a3439]">{activeStaffCount}</span>
            <span className="text-xs font-bold text-[#3a5f94]">/ {staffList.length} en total</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Sin horario</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#9f403d]">{withoutScheduleCount}</span>
            <span className="text-xs font-medium text-[#566166]">pendientes de asignación</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Con horario</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#2a3439]">{staffWithSchedule}</span>
            <span className="text-xs font-medium text-[#566166]">personas</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Horas semanales</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#2a3439]">{totalHoursScheduled.toFixed(1)}</span>
            <span className="text-xs font-medium text-[#566166]">programadas</span>
          </div>
        </div>
      </div>

      {scheduleError ? <p className="text-sm font-medium text-[#9f403d]">{scheduleError}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex h-[696px]">
          {/* Fixed left column: Staff names */}
          <div className="w-64 border-r border-slate-200 flex flex-col">
            <div className="flex h-[56px] items-center gap-2 border-b border-slate-200 bg-[#f0f4f7] px-4 text-xs font-bold tracking-wider text-[#2a3439] uppercase shadow-[6px_0_12px_rgba(15,23,42,0.04)]">
              <span className="material-symbols-outlined text-sm">badge</span>
              Miembro del personal
            </div>

            <div className="flex-1 divide-y divide-slate-200 overflow-y-auto" ref={leftColumnRef}>
              {isLoadingStaff || isLoadingJornadas ? (
                <p className="p-4 text-sm text-[#566166]">Cargando horario maestro...</p>
              ) : staffList.length === 0 ? (
                <p className="p-4 text-sm text-[#566166]">No hay personal registrado.</p>
              ) : (
                [...staffList].sort((a, b) => {
                  const aJornada = jornadaByStaffId[a.id] ?? [];
                  const bJornada = jornadaByStaffId[b.id] ?? [];
                  const aStart = aJornada
                    .map((row) => timeToMinutes(row.horaEntrada))
                    .filter((value) => value >= 0)
                    .sort((left, right) => left - right)[0] ?? Infinity;
                  const bStart = bJornada
                    .map((row) => timeToMinutes(row.horaEntrada))
                    .filter((value) => value >= 0)
                    .sort((left, right) => left - right)[0] ?? Infinity;
                  return aStart - bStart;
                }).map((staff) => {
                  const jornada = jornadaByStaffId[staff.id] ?? [];
                  const selectedDayKey = normalizeDayName(selectedScheduleDay);
                  const jornadaForSelectedDay = jornada.filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey);
                  const hasJornada = jornadaForSelectedDay.length > 0;

                  return (
                    <div className="flex h-[74px] items-center gap-3 bg-white px-4" key={staff.id}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8eff3] text-xs font-black text-[#375c91]">
                        N.{staff.numeroStaff}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#2a3439]">
                          {staff.nombres} {staff.apellidos}
                        </p>
                        <p className="truncate text-[10px] text-[#566166]">{staff.rol}</p>
                      </div>
                      <button
                        aria-label={hasJornada ? "Editar horario" : "Asignar horario"}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[#3a5f94] transition hover:bg-[#3a5f94] hover:text-white"
                        onClick={() => openEditor(staff)}
                        type="button"
                        title={hasJornada ? "Editar horario" : "Asignar horario"}
                      >
                        <span className="material-symbols-outlined text-[17px]">edit_calendar</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Scrollable right column: Schedule timeline */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-x-auto overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" ref={rightColumnRef}>
              <div className="w-max">
                {/* Header with hours - sticky at top */}
                <div className="sticky top-0 z-10 grid bg-[#f0f4f7] divide-x divide-slate-200" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(80px, 1fr))` }}>
                  {hourCells}
                </div>

                {/* Filas del personal con bandas de horario */}
                <div className="divide-y divide-slate-200">
              {isLoadingStaff || isLoadingJornadas ? (
                <p className="p-4 text-sm text-[#566166]">Cargando horario maestro...</p>
              ) : staffList.length === 0 ? (
                <p className="p-4 text-sm text-[#566166]">No hay personal registrado.</p>
              ) : (
                [...staffList].sort((a, b) => {
                  const aJornada = jornadaByStaffId[a.id] ?? [];
                  const bJornada = jornadaByStaffId[b.id] ?? [];
                  const aStart = aJornada
                    .map((row) => timeToMinutes(row.horaEntrada))
                    .filter((value) => value >= 0)
                    .sort((left, right) => left - right)[0] ?? Infinity;
                  const bStart = bJornada
                    .map((row) => timeToMinutes(row.horaEntrada))
                    .filter((value) => value >= 0)
                    .sort((left, right) => left - right)[0] ?? Infinity;
                  return aStart - bStart;
                }).map((staff) => {
                  const jornada = jornadaByStaffId[staff.id] ?? [];
                  const selectedDayKey = normalizeDayName(selectedScheduleDay);
                  const jornadaForSelectedDay = jornada.filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey);
                  const hasJornada = jornadaForSelectedDay.length > 0;
                  const firstStart = hasJornada ? jornadaForSelectedDay.map((row) => row.horaEntrada).sort()[0] : null;
                  const lastEnd = hasJornada ? jornadaForSelectedDay.map((row) => row.horaSalida).sort().slice(-1)[0] : null;
                  const bandStyle = getBandStyle(jornadaForSelectedDay);

                  return (
                    <div className="relative h-[74px] bg-white" key={staff.id}>
                      <div className="absolute inset-0 grid divide-x divide-slate-200/60" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(80px, 1fr))` }}>
                        {HOURS.map((hour) => (
                          <div key={`${staff.id}-${hour}`} className="h-full" />
                        ))}
                      </div>

                      {/* Current time indicator if today */}
                      {selectedScheduleDay === getCurrentWorkWeekDay() && (() => {
                        const now = new Date();
                        const currentMinutes = now.getHours() * 60 + now.getMinutes();
                        if (currentMinutes >= TIMELINE_START_MINUTES && currentMinutes <= TIMELINE_END_MINUTES) {
                          const leftPct = ((currentMinutes - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100;
                          return (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                              style={{ left: `${leftPct}%` }}
                            />
                          );
                        }
                        return null;
                      })()}

                      <div className="absolute inset-y-2 rounded-r-md border-l-4 border-[#3a5f94] bg-[#3a5f94]/10 px-4" style={bandStyle}>
                        <div className="flex h-full items-center gap-2 overflow-hidden">
                          <div className="h-2 w-2 shrink-0 rounded-full bg-[#3a5f94]" />
                          <span className="truncate text-[10px] font-bold text-[#3a5f94]">
                            {hasJornada
                              ? `Jornada ${firstStart} - ${lastEnd} • ${formatDayHoursLabel(jornadaForSelectedDay)}`
                              : "Sin horario asignado"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditorOpen && editingStaff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-[#2a3439]">Horario de trabajo</h3>
                <p className="text-sm text-[#566166]">
                  {editingStaff.nombres} {editingStaff.apellidos} • N.{editingStaff.numeroStaff}
                </p>
              </div>
              <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-[#566166]" onClick={closeEditor} type="button">
                Cerrar
              </button>
            </div>

            <form className="space-y-3" onSubmit={saveJornada}>
              {editorRows.map((row, index) => (
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]" key={row.id}>
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) => updateEditorRow(row.id, "diaSemana", event.target.value)}
                    value={row.diaSemana}
                  >
                    <option value="">Dia</option>
                    {MASTER_WEEK_DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>

                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) => updateEditorRow(row.id, "horaEntrada", event.target.value)}
                    type="time"
                    value={row.horaEntrada}
                  />

                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) => updateEditorRow(row.id, "horaSalida", event.target.value)}
                    type="time"
                    value={row.horaSalida}
                  />

                  <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-[#566166]">
                    <span className="font-medium">{row.totalHorasDia || "0"} h</span>
                  </div>

                  <button
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-[#9f403d]"
                    onClick={() => removeEditorRow(row.id)}
                    type="button"
                  >
                    Quitar
                  </button>

                  <p className="text-[10px] text-[#566166] md:col-span-5">Bloque {index + 1} de jornada semanal</p>
                </div>
              ))}

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 p-3">
                  <span className="text-xs font-bold text-[#2a3439]">Horas totales por semana:</span>
                  <span className="text-lg font-black text-[#3a5f94]">
                    {editorRows.reduce((sum, row) => sum + parseFloat(row.totalHorasDia || "0"), 0).toFixed(1)} h
                  </span>
                </div>

                <div className="flex flex-wrap justify-between gap-2">
                  <button className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-[#566166]" onClick={addEditorRow} type="button">
                    + Agregar bloque
                  </button>

                  <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-[#566166]" onClick={closeEditor} type="button">
                    Cancelar
                  </button>
                    <button className="rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={isSavingJornada} type="submit">
                      {isSavingJornada ? "Guardando..." : "Guardar horario"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function StaffPage() {
  const [view, setView] = useState<StaffView>("directory");
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [showEditStaffForm, setShowEditStaffForm] = useState(false);
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffApi[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [isSavingNewStaff, setIsSavingNewStaff] = useState(false);
  const [isSavingEditStaff, setIsSavingEditStaff] = useState(false);
  const [unavailableClassSlots, setUnavailableClassSlots] = useState<UnavailableClassSlot[]>([]);
  const [editUnavailableClassSlots, setEditUnavailableClassSlots] = useState<UnavailableClassSlot[]>([]);
  const [newStaff, setNewStaff] = useState({
    staffNumber: "",
    citizenshipId: "",
    firstName: "",
    lastName: "",
    major: "",
    phone: "",
    contractPlan: "Plan 1" as ContractPlan,
    birthDate: "",
    hasSoundKnowledge: false,
    role: "",
    roleId: 3 as StaffAccessRoleId,
  });
  const [editStaff, setEditStaff] = useState({
    staffNumber: "",
    citizenshipId: "",
    firstName: "",
    lastName: "",
    major: "",
    phone: "",
    contractPlan: "Plan 1" as ContractPlan,
    birthDate: "",
    hasSoundKnowledge: false,
    role: "",
    roleId: 3,
    estado: "Active" as StaffEstado,
    balanceHoras: 0,
  });
  const [newBirthDateParts, setNewBirthDateParts] = useState<BirthDateParts>({ year: "", month: "", day: "" });
  const [editBirthDateParts, setEditBirthDateParts] = useState<BirthDateParts>({ year: "", month: "", day: "" });
  const isOnShift = true;
  const balanceHours = 4;
  const formattedBalanceHours = `${balanceHours > 0 ? "+" : ""}${balanceHours} horas`;

  const selectedStaff = useMemo(() => {
    if (staffList.length === 0) return null;
    if (!selectedStaffId) return staffList[0] ?? null;
    return staffList.find((staff) => staff.id === selectedStaffId) ?? staffList[0] ?? null;
  }, [selectedStaffId, staffList]);

  const selectedStaffBalanceHours = selectedStaff?.balanceHoras ?? 0;
  const selectedStaffFormattedBalanceHours = `${selectedStaffBalanceHours > 0 ? "+" : ""}${selectedStaffBalanceHours} horas`;

  const academicUnavailabilityMatrix = useMemo(() => {
    const slots = (selectedStaff?.bloqueosClase ?? [])
      .map((slot) => ({
        dayKey: normalizeDayName(slot.diaSemana ?? ""),
        start: timeToMinutes(slot.horaInicio ?? ""),
        end: timeToMinutes(slot.horaFin ?? ""),
      }))
      .filter((slot) => slot.dayKey && slot.start >= 0 && slot.end > slot.start);

    return ACADEMIC_DAY_COLUMNS.map((column) =>
      ACADEMIC_TIME_SEGMENTS.map((segment) =>
        slots.some(
          (slot) =>
            slot.dayKey === column.key &&
            slot.start < segment.end &&
            slot.end > segment.start,
        ),
      ),
    );
  }, [selectedStaff]);

  const hasAcademicUnavailability = academicUnavailabilityMatrix.some((day) =>
    day.some((isBlocked) => isBlocked),
  );

  const birthYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 90 }, (_, index) => String(currentYear - index));
  }, []);

  const newBirthDayOptions = useMemo(() => {
    const days = getDaysInMonth(newBirthDateParts.year, newBirthDateParts.month);
    return Array.from({ length: days }, (_, index) => String(index + 1).padStart(2, "0"));
  }, [newBirthDateParts.month, newBirthDateParts.year]);

  const editBirthDayOptions = useMemo(() => {
    const days = getDaysInMonth(editBirthDateParts.year, editBirthDateParts.month);
    return Array.from({ length: days }, (_, index) => String(index + 1).padStart(2, "0"));
  }, [editBirthDateParts.month, editBirthDateParts.year]);

  const academicBlockedSlotDetails = useMemo(() => {
    return (selectedStaff?.bloqueosClase ?? [])
      .map((slot) => {
        const dayKey = normalizeDayName(slot.diaSemana ?? "");
        return {
          dayKey,
          dayName: slot.diaSemana ?? "-",
          start: slot.horaInicio ?? "-",
          end: slot.horaFin ?? "-",
          startMinutes: timeToMinutes(slot.horaInicio ?? ""),
          endMinutes: timeToMinutes(slot.horaFin ?? ""),
        };
      })
      .filter((slot) => slot.dayKey && slot.startMinutes >= 0 && slot.endMinutes > slot.startMinutes)
      .sort((a, b) => {
        const dayDelta = (DAY_SORT_ORDER[a.dayKey] ?? 99) - (DAY_SORT_ORDER[b.dayKey] ?? 99);
        if (dayDelta !== 0) return dayDelta;
        return a.startMinutes - b.startMinutes;
      });
  }, [selectedStaff]);

  const totalAcademicBlockedMinutes = useMemo(() => {
    return academicBlockedSlotDetails.reduce((total, slot) => total + (slot.endMinutes - slot.startMinutes), 0);
  }, [academicBlockedSlotDetails]);

  const totalAcademicBlockedHoursLabel = `${(totalAcademicBlockedMinutes / 60).toFixed(1)}h`;

  function resetNewStaffForm() {
    setNewStaff({
      staffNumber: "",
      citizenshipId: "",
      firstName: "",
      lastName: "",
      major: "",
      phone: "",
      contractPlan: "Plan 1",
      birthDate: "",
      hasSoundKnowledge: false,
      role: "",
      roleId: 3,
    });
    setNewBirthDateParts({ year: "", month: "", day: "" });
    setUnavailableClassSlots([]);
  }

  function openAddStaffForm() {
    resetNewStaffForm();
    setShowAddStaffForm(true);
  }

  function closeAddStaffForm() {
    setShowAddStaffForm(false);
    resetNewStaffForm();
  }

  const loadStaff = async () => {
    try {
      // Try to restore from cache first
      const cachedStaff = getCachedData<StaffApi[]>("staff_list");
      if (cachedStaff && cachedStaff.length > 0) {
        setStaffList(cachedStaff);
        if (cachedStaff.length > 0) {
          setSelectedStaffId((prev) => prev ?? cachedStaff[0]?.id ?? null);
        }
      }

      // Load fresh data in the background
      setIsLoadingStaff(true);
      setStaffError(null);

      const response = await fetchApiJson<{ staff?: StaffApi[] }>("/api/staff", {
        cache: "no-store",
      });

      const nextStaff = Array.isArray(response.staff) ? response.staff : [];
      setStaffList(nextStaff);
      setCachedData("staff_list", nextStaff);

      if (nextStaff.length > 0) {
        setSelectedStaffId((prev) => prev ?? nextStaff[0]?.id ?? null);
      } else {
        setSelectedStaffId(null);
      }
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "No se pudo cargar el staff.");
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    void loadStaff();
  }, []);

  async function handleAddStaffSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSavingNewStaff(true);
      const parsedNumber = Number(newStaff.staffNumber);
      const parsedBalance = Number.isFinite(balanceHours) ? balanceHours : 0;
      const resolvedBirthDate = buildBirthDate(newBirthDateParts);

      // Validar campos requeridos
      if (!newStaff.firstName || !newStaff.lastName) {
        alert("Por favor completa los campos de nombre y apellido.");
        return;
      }

      if (!resolvedBirthDate) {
        alert("Por favor selecciona una fecha de nacimiento valida (ano, mes y dia).");
        return;
      }

      const hasAnySlot = unavailableClassSlots.length > 0;
      const hasIncompleteSlot = unavailableClassSlots.some(
        (slot) => !slot.day || !slot.startTime || !slot.endTime,
      );
      if (hasIncompleteSlot) {
        alert("Hay bloques de horario incompletos. Completa hora inicio y hora fin, o elimina el bloque.");
        return;
      }

      const bloqueosClase = unavailableClassSlots.map((slot) => ({
          diaSemana: slot.day,
          horaInicio: slot.startTime,
          horaFin: slot.endTime,
        }));

      if (hasAnySlot && bloqueosClase.length === 0) {
        alert("Debes completar al menos un bloque valido o eliminar todos los bloques.");
        return;
      }

      const blockValidationError = validateClassBlocks(bloqueosClase);
      if (blockValidationError) {
        alert(`Error en horarios de clase: ${blockValidationError}`);
        return;
      }

      await fetchApiJson<{ message: string; staffId: string }>("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroStaff: parsedNumber,
          roleId: newStaff.roleId,
          rol: newStaff.role,
          nombres: newStaff.firstName,
          apellidos: newStaff.lastName,
          cedula: newStaff.citizenshipId,
          telefono: newStaff.phone,
          fechaNacimiento: resolvedBirthDate,
          carrera: newStaff.major || "Sin carrera",
          tipoContrato: newStaff.contractPlan,
          conocimientoSonido: newStaff.hasSoundKnowledge,
          estado: "Active",
          balanceHoras: parsedBalance,
          bloqueosClase,
        }),
      });

      alert(`Colaborador ${newStaff.firstName} ${newStaff.lastName} creado correctamente.`);
      closeAddStaffForm();
      setFormFeedback(null);
      await loadStaff();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo guardar el staff.";
      alert(`❌ Error: ${errorMessage}`);
      setFormFeedback(null);
    } finally {
      setIsSavingNewStaff(false);
    }
  }

  function openEditStaffForm() {
    if (!selectedStaff) {
      setFormFeedback("Selecciona un staff para editar.");
      return;
    }

    setEditStaff({
      staffNumber: String(selectedStaff.numeroStaff),
      citizenshipId: selectedStaff.cedula,
      firstName: selectedStaff.nombres,
      lastName: selectedStaff.apellidos,
      major: selectedStaff.carrera,
      phone: selectedStaff.telefono,
      contractPlan: selectedStaff.tipoContrato,
      birthDate: selectedStaff.fechaNacimiento,
      hasSoundKnowledge: selectedStaff.conocimientoSonido,
      role: selectedStaff.rol,
      roleId: selectedStaff.roleId ?? 3,
      estado: selectedStaff.estado,
      balanceHoras: selectedStaff.balanceHoras,
    });
    setEditBirthDateParts(parseBirthDate(selectedStaff.fechaNacimiento));

    const mappedSlots = (selectedStaff.bloqueosClase ?? []).map((slot, index) => ({
      id: slot.id || `edit-slot-${index + 1}`,
      day: slot.diaSemana as WeekDay,
      startTime: slot.horaInicio,
      endTime: slot.horaFin,
    }));

    setEditUnavailableClassSlots(mappedSlots);
    setShowEditStaffForm(true);
  }

  async function handleEditStaffSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedStaff) {
      alert("Por favor selecciona un staff para editar.");
      return;
    }

    try {
      setIsSavingEditStaff(true);

      const parsedNumber = Number(editStaff.staffNumber);
      const resolvedBirthDate = buildBirthDate(editBirthDateParts);

      if (!resolvedBirthDate) {
        alert("Por favor selecciona una fecha de nacimiento valida (ano, mes y dia).");
        return;
      }

      const hasAnySlot = editUnavailableClassSlots.length > 0;
      const hasIncompleteSlot = editUnavailableClassSlots.some(
        (slot) => !slot.day || !slot.startTime || !slot.endTime,
      );
      if (hasIncompleteSlot) {
        alert("Hay bloques de horario incompletos. Completa hora inicio y hora fin, o elimina el bloque.");
        return;
      }

      const bloqueosClase = editUnavailableClassSlots.map((slot) => ({
          diaSemana: slot.day,
          horaInicio: slot.startTime,
          horaFin: slot.endTime,
        }));

      if (hasAnySlot && bloqueosClase.length === 0) {
        alert("Debes completar al menos un bloque valido o eliminar todos los bloques.");
        return;
      }

      const blockValidationError = validateClassBlocks(bloqueosClase);
      if (blockValidationError) {
        alert(`Error en horarios de clase: ${blockValidationError}`);
        return;
      }

      await fetchApiJson<{ message: string; staffId: string }>(`/api/staff/${selectedStaff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroStaff: parsedNumber,
          roleId: editStaff.roleId,
          rol: editStaff.role,
          nombres: editStaff.firstName,
          apellidos: editStaff.lastName,
          cedula: editStaff.citizenshipId,
          telefono: editStaff.phone,
          fechaNacimiento: resolvedBirthDate,
          carrera: editStaff.major || "Sin carrera",
          tipoContrato: editStaff.contractPlan,
          conocimientoSonido: editStaff.hasSoundKnowledge,
          estado: editStaff.estado,
          balanceHoras: editStaff.balanceHoras,
          bloqueosClase,
        }),
      });

      alert("✓ Staff actualizado correctamente.");
      setShowEditStaffForm(false);
      setFormFeedback(null);
      await loadStaff();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo actualizar el staff.";
      alert(`❌ Error: ${errorMessage}`);
      setFormFeedback(null);
    } finally {
      setIsSavingEditStaff(false);
    }
  }

  function addUnavailableClassSlot() {
    setUnavailableClassSlots((prev) => [
      ...prev,
      { id: `slot-${Date.now()}-${prev.length + 1}`, day: "", startTime: "", endTime: "" },
    ]);
  }

  function removeUnavailableClassSlot(slotId: string) {
    setUnavailableClassSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  }

  function updateUnavailableClassSlot(slotId: string, field: "day" | "startTime" | "endTime", value: string) {
    setUnavailableClassSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)),
    );
  }

  function addEditUnavailableClassSlot() {
    setEditUnavailableClassSlots((prev) => [
      ...prev,
      { id: `edit-slot-${Date.now()}-${prev.length + 1}`, day: "", startTime: "", endTime: "" },
    ]);
  }

  function removeEditUnavailableClassSlot(slotId: string) {
    setEditUnavailableClassSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  }

  function updateEditUnavailableClassSlot(slotId: string, field: "day" | "startTime" | "endTime", value: string) {
    setEditUnavailableClassSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)),
    );
  }

  function updateNewBirthDate(part: keyof BirthDateParts, value: string) {
    setNewBirthDateParts((prev) => {
      const next: BirthDateParts = { ...prev, [part]: value };

      if (part === "year" || part === "month") {
        const maxDay = getDaysInMonth(next.year, next.month);
        if (!maxDay || Number(next.day) > maxDay) {
          next.day = "";
        }
      }

      setNewStaff((prevStaff) => ({ ...prevStaff, birthDate: buildBirthDate(next) }));
      return next;
    });
  }

  function updateEditBirthDate(part: keyof BirthDateParts, value: string) {
    setEditBirthDateParts((prev) => {
      const next: BirthDateParts = { ...prev, [part]: value };

      if (part === "year" || part === "month") {
        const maxDay = getDaysInMonth(next.year, next.month);
        if (!maxDay || Number(next.day) > maxDay) {
          next.day = "";
        }
      }

      setEditStaff((prevStaff) => ({ ...prevStaff, birthDate: buildBirthDate(next) }));
      return next;
    });
  }

  function validateClassBlocks(
    slots: Array<{ diaSemana: string; horaInicio: string; horaFin: string }>,
  ): string | null {
    const toMinutes = (value: string) => {
      const [hourRaw, minuteRaw] = value.split(":");
      const hour = Number(hourRaw);
      const minute = Number(minuteRaw);

      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return -1;
      return hour * 60 + minute;
    };

    const normalized = slots.map((slot) => ({
      diaSemana: slot.diaSemana,
      horaInicio: slot.horaInicio,
      horaFin: slot.horaFin,
      start: toMinutes(slot.horaInicio),
      end: toMinutes(slot.horaFin),
    }));

    for (let i = 0; i < normalized.length; i++) {
      const current = normalized[i];

      if (current.start < 0 || current.end < 0) {
        return `El bloque ${i + 1} tiene una hora invalida.`;
      }

      if (current.end <= current.start) {
        return `El bloque ${i + 1} en ${current.diaSemana} tiene hora final menor o igual a la hora inicial.`;
      }

      for (let j = i + 1; j < normalized.length; j++) {
        const compare = normalized[j];
        if (current.diaSemana !== compare.diaSemana) continue;

        const sameRange =
          current.horaInicio === compare.horaInicio &&
          current.horaFin === compare.horaFin;
        if (sameRange) {
          return `Hay bloques duplicados en ${current.diaSemana} (${current.horaInicio}-${current.horaFin}).`;
        }

        const overlap = current.start < compare.end && compare.start < current.end;
        if (overlap) {
          return `Hay solape entre bloques en ${current.diaSemana} (${current.horaInicio}-${current.horaFin} y ${compare.horaInicio}-${compare.horaFin}).`;
        }
      }
    }

    return null;
  }

  async function handleDeleteStaff() {
    if (!selectedStaff) {
      alert("Por favor selecciona un staff para eliminar.");
      return;
    }

    const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar a ${selectedStaff.nombres} ${selectedStaff.apellidos}? Esta acción no se puede deshacer.`);
    if (!confirmDelete) return;

    try {
      await fetchApiJson<{ message: string }>(`/api/staff/${selectedStaff.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      alert("✓ Staff eliminado correctamente.");
      setSelectedStaffId(null);
      await loadStaff();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo eliminar el staff.";
      alert(`❌ Error: ${errorMessage}`);
    }
  }

  return (
    <div className="p-8">
      {formFeedback ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {formFeedback}
        </div>
      ) : null}

      {showAddStaffForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-[#2a3439]">Nuevo personal</h3>
                <p className="text-xs text-[#566166]">Formulario simbólico (sin integración con el backend)</p>
              </div>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-[#566166] hover:bg-slate-50"
                onClick={closeAddStaffForm}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <form autoComplete="off" className="flex min-h-0 flex-1 flex-col" onSubmit={handleAddStaffSubmit}>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Número de personal</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, staffNumber: event.target.value }))}
                  placeholder="Ej: 5"
                  required
                  type="text"
                  value={newStaff.staffNumber}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Rol</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, role: event.target.value }))}
                  placeholder="Ej: Auxiliar de Biblioteca"
                  required
                  type="text"
                  value={newStaff.role}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Nombres</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, firstName: event.target.value }))}
                  placeholder="Ej: Juan Carlos"
                  required
                  type="text"
                  value={newStaff.firstName}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Cédula de ciudadanía</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, citizenshipId: event.target.value }))}
                  placeholder="Ej: 1032485901"
                  required
                  type="text"
                  value={newStaff.citizenshipId}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Apellidos</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Ej: Rodriguez Mendoza"
                  required
                  type="text"
                  value={newStaff.lastName}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Carrera</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, major: event.target.value }))}
                  placeholder="Ej: Ingenieria de Sistemas"
                  type="text"
                  value={newStaff.major}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Número de teléfono</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Ej: +57 300 000 0000"
                  required
                  type="tel"
                  value={newStaff.phone}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Fecha de nacimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) => updateNewBirthDate("year", event.target.value)}
                    required
                    value={newBirthDateParts.year}
                  >
                    <option value="">Año</option>
                    {birthYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    disabled={!newBirthDateParts.year}
                    onChange={(event) => updateNewBirthDate("month", event.target.value)}
                    required
                    value={newBirthDateParts.month}
                  >
                    <option value="">Mes</option>
                    {BIRTH_MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    disabled={!newBirthDateParts.year || !newBirthDateParts.month}
                    onChange={(event) => updateNewBirthDate("day", event.target.value)}
                    required
                    value={newBirthDateParts.day}
                  >
                    <option value="">Día</option>
                    {newBirthDayOptions.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500">Rol de acceso</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setNewStaff((prev) => ({ ...prev, roleId: Number(event.target.value) as StaffAccessRoleId }))
                  }
                  value={newStaff.roleId}
                >
                  {ACCESS_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500">Tipo de contrato</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, contractPlan: event.target.value as ContractPlan }))}
                  value={newStaff.contractPlan}
                >
                  <option value="Plan 1">Plan 1</option>
                  <option value="Plan 2">Plan 2</option>
                  <option value="Plan 3">Plan 3</option>
                  <option value="Plan Monitoria">Plan Monitoria</option>
                  <option value="Plan Especial">Plan Especial</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">Horas de clase no disponibles</label>
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold text-[#566166]"
                    onClick={addUnavailableClassSlot}
                    type="button"
                  >
                    + Agregar bloque
                  </button>
                </div>

                {unavailableClassSlots.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-[#566166]">
                    No hay horarios de clase cargados. Este campo es opcional.
                  </p>
                ) : (
                  unavailableClassSlots.map((slot, index) => (
                    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_1fr_1fr_auto]" key={slot.id}>
                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateUnavailableClassSlot(slot.id, "day", event.target.value)}
                        value={slot.day}
                      >
                        <option value="">Selecciona un día</option>
                        {WEEK_DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateUnavailableClassSlot(slot.id, "startTime", event.target.value)}
                        value={slot.startTime}
                      >
                        <option value="">Hora de inicio</option>
                        {CLASS_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateUnavailableClassSlot(slot.id, "endTime", event.target.value)}
                        value={slot.endTime}
                      >
                        <option value="">Hora de fin</option>
                        {CLASS_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>

                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-[#9f403d]"
                        onClick={() => removeUnavailableClassSlot(slot.id)}
                        type="button"
                      >
                        Quitar
                      </button>

                      <p className="text-[10px] text-[#566166] md:col-span-4">Bloque {index + 1}: horario no disponible por clase</p>
                    </div>
                  ))
                )}
              </div>

              <label className="md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#2a3439]">
                <input
                  checked={newStaff.hasSoundKnowledge}
                  className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, hasSoundKnowledge: event.target.checked }))}
                  type="checkbox"
                />
                Tiene conocimientos de manejo de sonido
              </label>

              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 bg-white pt-4">
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-[#566166]"
                  disabled={isSavingNewStaff}
                  onClick={closeAddStaffForm}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={isSavingNewStaff} type="submit">
                  {isSavingNewStaff ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showEditStaffForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <div>
                <h3 className="text-xl font-extrabold text-[#2a3439]">Editar personal</h3>
                <p className="text-xs text-[#566166]">Actualiza la información del perfil seleccionado</p>
              </div>
            </div>

            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleEditStaffSubmit}>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Número de personal</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, staffNumber: event.target.value }))}
                  required
                  type="text"
                  value={editStaff.staffNumber}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Rol</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, role: event.target.value }))}
                  required
                  type="text"
                  value={editStaff.role}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Nombres</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, firstName: event.target.value }))}
                  required
                  type="text"
                  value={editStaff.firstName}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Cédula de ciudadanía</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, citizenshipId: event.target.value }))}
                  required
                  type="text"
                  value={editStaff.citizenshipId}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Apellidos</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, lastName: event.target.value }))}
                  required
                  type="text"
                  value={editStaff.lastName}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Carrera</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, major: event.target.value }))}
                  type="text"
                  value={editStaff.major}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Número de teléfono</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, phone: event.target.value }))}
                  required
                  type="tel"
                  value={editStaff.phone}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Fecha de nacimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    onChange={(event) => updateEditBirthDate("year", event.target.value)}
                    required
                    value={editBirthDateParts.year}
                  >
                    <option value="">Año</option>
                    {birthYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    disabled={!editBirthDateParts.year}
                    onChange={(event) => updateEditBirthDate("month", event.target.value)}
                    required
                    value={editBirthDateParts.month}
                  >
                    <option value="">Mes</option>
                    {BIRTH_MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    disabled={!editBirthDateParts.year || !editBirthDateParts.month}
                    onChange={(event) => updateEditBirthDate("day", event.target.value)}
                    required
                    value={editBirthDateParts.day}
                  >
                    <option value="">Día</option>
                    {editBirthDayOptions.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500">Rol de acceso</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) =>
                    setEditStaff((prev) => ({ ...prev, roleId: Number(event.target.value) as StaffAccessRoleId }))
                  }
                  value={editStaff.roleId}
                >
                  {ACCESS_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500">Tipo de contrato</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, contractPlan: event.target.value as ContractPlan }))}
                  value={editStaff.contractPlan}
                >
                  <option value="Plan 1">Plan 1</option>
                  <option value="Plan 2">Plan 2</option>
                  <option value="Plan 3">Plan 3</option>
                  <option value="Plan Monitoria">Plan Monitoria</option>
                  <option value="Plan Especial">Plan Especial</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">Horas de clase no disponibles</label>
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold text-[#566166]"
                    onClick={addEditUnavailableClassSlot}
                    type="button"
                  >
                    + Agregar bloque
                  </button>
                </div>

                {editUnavailableClassSlots.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-[#566166]">
                    No hay horarios de clase cargados. Este campo es opcional.
                  </p>
                ) : (
                  editUnavailableClassSlots.map((slot, index) => (
                    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_1fr_1fr_auto]" key={slot.id}>
                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateEditUnavailableClassSlot(slot.id, "day", event.target.value)}
                        value={slot.day}
                      >
                        <option value="">Selecciona un día</option>
                        {WEEK_DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateEditUnavailableClassSlot(slot.id, "startTime", event.target.value)}
                        value={slot.startTime}
                      >
                        <option value="">Hora de inicio</option>
                        {CLASS_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>

                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateEditUnavailableClassSlot(slot.id, "endTime", event.target.value)}
                        value={slot.endTime}
                      >
                        <option value="">Hora de fin</option>
                        {CLASS_TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>

                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-[#9f403d]"
                        onClick={() => removeEditUnavailableClassSlot(slot.id)}
                        type="button"
                      >
                        Quitar
                      </button>

                      <p className="text-[10px] text-[#566166] md:col-span-4">Bloque {index + 1}: horario no disponible por clase</p>
                    </div>
                  ))
                )}
              </div>

              <label className="md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#2a3439]">
                <input
                  checked={editStaff.hasSoundKnowledge}
                  className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]"
                  onChange={(event) => setEditStaff((prev) => ({ ...prev, hasSoundKnowledge: event.target.checked }))}
                  type="checkbox"
                />
                Tiene conocimientos de manejo de sonido
              </label>

              </div>

              <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 bg-white pt-4">
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-[#566166]"
                  onClick={() => setShowEditStaffForm(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                  disabled={isSavingEditStaff}
                  type="submit"
                >
                  {isSavingEditStaff ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 w-fit">
        <button
          className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            view === "directory" ? "bg-[#3a5f94] text-white" : "text-[#566166] hover:bg-slate-100"
          }`}
          onClick={() => setView("directory")}
          type="button"
        >
          Directorio del personal
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            view === "schedule" ? "bg-[#3a5f94] text-white" : "text-[#566166] hover:bg-slate-100"
          }`}
          onClick={() => setView("schedule")}
          type="button"
        >
          Horario Maestro
        </button>
      </div>

      {view === "schedule" ? (
        <StaffScheduleBoard isLoadingStaff={isLoadingStaff} staffList={staffList} />
      ) : (
        <main className="flex min-h-[calc(100vh-7rem)] gap-8 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="tracking-tight text-2xl font-extrabold text-[#2a3439]">Directorio del personal</h2>
              <p className="text-sm text-[#566166]">Gestionando {staffList.length} integrantes académicos activos</p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 rounded-lg bg-[#d9e4ea] px-4 py-2 text-xs font-bold text-[#2a3439]">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                Filtrar
              </button>
              <button
                className="flex items-center gap-2 rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white shadow-sm"
                onClick={openAddStaffForm}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Agregar personal
              </button>
            </div>
          </div>

          {staffError ? <p className="text-sm font-medium text-[#9f403d]">{staffError}</p> : null}

          <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:grid-cols-2">
            {isLoadingStaff ? (
              <p className="text-sm text-[#566166]">Cargando personal...</p>
            ) : staffList.length === 0 ? (
              <p className="text-sm text-[#566166]">Aún no hay personal registrado.</p>
            ) : (
              staffList.map((staff) => {
                const isActiveCard = selectedStaff?.id === staff.id;
                return (
                  <button
                    className={`flex items-center gap-4 rounded-xl bg-white p-5 text-left transition-all ${
                      isActiveCard
                        ? "border-2 border-[#3a5f94] shadow-xl ring-4 ring-[#3a5f94]/5"
                        : "border border-slate-200 shadow-sm hover:shadow-md"
                    }`}
                    key={staff.id}
                    onClick={() => setSelectedStaffId(staff.id)}
                    type="button"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#e8eff3] text-sm font-black text-[#375c91]">
                      N.{staff.numeroStaff}
                    </div>
                    <div className="flex-1">
                      <h3 className="leading-tight font-bold text-[#2a3439]">{staff.nombres}</h3>
                      <p className="text-xs text-[#566166]">ID: {staff.cedula}</p>
                      <p className="mt-1 text-xs font-semibold text-[#566166]">{staff.rol}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${
                          staff.estado === "Active" ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        {staff.estado === "Active" ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_1fr]">
            <section className="rounded-2xl bg-[#e8eff3] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black text-[#153f73]">
                  <span className="material-symbols-outlined">assignment</span>
                  Tareas asignadas: {selectedStaff?.nombres ?? "Personal"}
                </h3>
                <span className="text-[11px] font-bold text-[#566166]">2 tareas pendientes</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
                  <input checked className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]" type="checkbox" readOnly />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#566166] line-through">Pasillo 3 limpio (ala norte)</p>
                    <p className="text-[10px] text-slate-400">Completado a las 08:30</p>
                  </div>
                  <span className="material-symbols-outlined text-base text-green-500">check_circle</span>
                </div>

                <div className="flex items-center gap-3 rounded-lg border-l-4 border-amber-400 bg-white p-3 shadow-sm">
                  <input className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]" type="checkbox" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#2a3439]">Preparar salón 101 (rack AV)</p>
                    <p className="text-[10px] text-[#566166]">Prioridad: alta • Vence a las 11:00</p>
                  </div>
                  <span className="material-symbols-outlined text-base text-amber-500">schedule</span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                Horario diario del personal
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-50 py-2">
                  <span className="text-xs font-bold text-[#2a3439]">Turno de la mañana</span>
                  <span className="text-xs text-[#566166]">07:00 - 12:00</span>
                </div>
                <div className="flex items-center justify-between rounded bg-amber-50 px-2 py-2 border-b border-slate-50">
                  <span className="text-xs font-bold text-amber-700">Almuerzo</span>
                  <span className="text-xs text-amber-700">12:00 - 13:00</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-50 py-2">
                  <span className="text-xs font-bold text-[#2a3439]">Turno de la tarde</span>
                  <span className="text-xs text-[#566166]">13:00 - 16:00</span>
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_1fr]">
            <section className="min-h-[370px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                No disponibilidad académica
              </h4>
              <div className="space-y-1">
                <div className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1">
                  <div />
                  {ACADEMIC_DAY_COLUMNS.map((column) => (
                    <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase" key={column.dayName}>
                      {column.label}
                    </div>
                  ))}
                </div>

                {ACADEMIC_TIME_SEGMENTS.map((segment, segmentIndex) => (
                  <div className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1" key={segment.key}>
                    <div className="flex items-center justify-end gap-1 pr-1 text-[9px] whitespace-nowrap">
                      <span className="font-bold text-[#566166]">{ACADEMIC_SEGMENT_ROWS[segmentIndex].label}</span>
                      <span className="text-slate-400">{ACADEMIC_SEGMENT_ROWS[segmentIndex].range}</span>
                    </div>

                    {ACADEMIC_DAY_COLUMNS.map((column, dayIndex) => {
                      const isBlocked = academicUnavailabilityMatrix[dayIndex]?.[segmentIndex] ?? false;

                      return (
                        <div
                          className={`h-8 rounded-sm ${isBlocked ? "bg-[#3a5f94]" : "bg-[#f0f4f7]"}`}
                          key={`${column.key}-${segment.key}`}
                          title={`${column.dayName}: ${isBlocked ? "No disponible" : "Disponible"} (${ACADEMIC_SEGMENT_ROWS[segmentIndex].range})`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-center gap-4 text-[10px] text-[#566166]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#3a5f94]" /> No disponible
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#f0f4f7] border border-slate-300" /> Disponible
                  </span>
                </div>
              </div>
              {hasAcademicUnavailability ? (
                <p className="mt-2 text-center text-[10px] italic text-[#566166]">
                  Los bloques resaltados indican horarios de clase.
                </p>
              ) : (
                <p className="mt-2 text-center text-[10px] italic text-[#566166]">
                  No hay bloques de clase registrados para este personal.
                </p>
              )}
              {academicBlockedSlotDetails.length > 0 ? (
                <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Detalle de Bloques</p>
                  {academicBlockedSlotDetails.map((slot, index) => (
                    <p className="text-xs text-[#2a3439]" key={`${slot.dayKey}-${slot.start}-${index}`}>
                      {slot.dayName}: {slot.start} - {slot.end}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                Actividades recientes e informes
              </h4>
              <div className="relative space-y-6 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-[2px] before:bg-[#cfdce3] before:content-['']">
                <div className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                  <p className="text-[10px] font-bold text-slate-400">HOY, 10:45</p>
                  <p className="text-sm font-bold text-[#2a3439]">Salón 302 limpiado</p>
                  <p className="text-xs text-[#566166]">Actividad: registro de mantenimiento</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#9f403d]" />
                  <p className="text-[10px] font-bold text-slate-400">AYER, 14:15</p>
                  <p className="text-sm font-bold text-[#9f403d]">Informe de llegada tardía</p>
                  <p className="text-xs text-[#566166]">Infracción: 15 min de retraso sin aviso.</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                  <p className="text-[10px] font-bold text-slate-400">24 OCT, 09:00</p>
                  <p className="text-sm font-bold text-[#2a3439]">Inventario verificado</p>
                  <p className="text-xs text-[#566166]">Actividad: auditoría de equipos</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex h-full w-[320px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
          <div className="flex flex-col items-center gap-3 border-b border-slate-200 bg-[#f0f4f7] p-6">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#d5e3ff] text-2xl font-black text-[#153f73] shadow-lg">
                N.{selectedStaff?.numeroStaff ?? 1}
              </div>
              <span className="absolute right-0 bottom-0 h-6 w-6 rounded-full border-4 border-white bg-green-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-[#2a3439]">{selectedStaff?.nombres ?? "Sin staff"}</h2>
              <p className="text-sm font-medium text-[#566166]">
                {selectedStaff?.apellidos ?? "Sin staff seleccionado"}
              </p>
            </div>
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-black text-slate-400 uppercase">Estado</p>
                <p className={`text-lg font-black ${selectedStaff?.estado === "Active" ? "text-green-600" : "text-slate-500"}`}>
                  {selectedStaff?.estado === "Active" ? "Activo" : "Fuera de turno"}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-black text-slate-400 uppercase">Horas acumuladas</p>
                <p className={`text-lg font-black ${selectedStaffBalanceHours >= 0 ? "text-green-600" : "text-[#9f403d]"}`}>
                  {selectedStaffFormattedBalanceHours}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8 overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <section>
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                Información general
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Documento de identidad (cédula)</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.cedula ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Número de teléfono</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.telefono ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Rol de acceso</label>
                  <p className="text-sm font-semibold text-[#2a3439]">
                    {accessRoleLabelById[(selectedStaff?.roleId as StaffAccessRoleId) ?? 3]}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de contrato</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.tipoContrato ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha de nacimiento</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.fechaNacimiento ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Carrera</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.carrera ?? "-"}</p>
                </div>
              </div>
            </section>

          </div>

          <div className="flex gap-3 bg-slate-50 p-6">
            <button
              className="flex-1 rounded-xl bg-[#3a5f94] py-3 text-xs font-bold text-white shadow-lg shadow-[#3a5f94]/20 disabled:opacity-60"
              disabled={!selectedStaff}
              onClick={openEditStaffForm}
              type="button"
            >
              Editar perfil
            </button>
            <button 
              className="rounded-xl bg-[#9f403d] p-3 text-white transition-colors hover:bg-[#8a3631] disabled:opacity-60"
              disabled={!selectedStaff}
              onClick={handleDeleteStaff}
              type="button"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
            <button className="rounded-xl border border-slate-200 bg-white p-3 text-[#9f403d] transition-colors hover:bg-red-50">
              <span className="material-symbols-outlined text-lg">flag</span>
            </button>
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
