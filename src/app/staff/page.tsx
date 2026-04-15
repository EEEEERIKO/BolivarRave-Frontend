/* eslint-disable @next/next/no-img-element */
"use client";

import { fetchApiJson } from "@/lib/api-client";
import { getCachedData, setCachedData } from "@/lib/cache-storage";
import { readAuthSession } from "@/lib/auth-session";
import { useEffect, useMemo, useRef, useState } from "react";

type StaffView = "directory" | "schedule";
type StaffMobileDetailTab = "profile" | "tasks" | "daily" | "academic" | "activity";
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
type StaffLiveStatus = "Activo" | "Descanso" | "Inactivo";

type Skill = {
  id: string;
  nombre: string;
};

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
  tieneCredencial: boolean;
  habilidades: Skill[];
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

type StaffJornadasBulkResponse = {
  jornadas: Record<string, Array<{
    id: string;
    staffId: string;
    diaSemana: string;
    horaEntrada: string;
    horaSalida: string;
    totalHorasDia: number;
  }>>;
};

type StaffPausasBulkResponse = {
  pausas: Record<string, Array<{
    id: string;
    staffId: string;
    diaSemana: string;
    tipoPausa: "Comida" | "Descanso";
    horaInicio: string;
    horaFin: string;
  }>>;
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
  tipoPausa: "" | "Comida" | "Descanso";
  horaInicio: string;
  horaFin: string;
};

type BackendWorkWeekDay = "Lunes" | "Martes" | "Miercoles" | "Jueves" | "Viernes" | "Sabado" | "Domingo";

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
// Keep this aligned with the rendered hour grid (05:00..22:00 = 18 columns => 05:00..23:00 span).
const TIMELINE_END_MINUTES = 23 * 60;
const TIMELINE_TOTAL_MINUTES = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES;

const WEEK_DAYS: WeekDay[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function calculateHoursDifference(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start < 0 || end < 0 || end <= start) return 0;
  return Number(((end - start) / 60).toFixed(1));
}

function formatTimeAmPm(value: string): string {
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

function formatDurationHuman(hoursDecimal: number): string {
  const totalMinutes = Math.round(hoursDecimal * 60);

  if (totalMinutes <= 0) {
    return "0 min";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (hours > 0) {
    return `${hours} h`;
  }

  return `${minutes} min`;
}

const TIME_SLOT_OPTIONS = Array.from({ length: ((23 * 60) - (5 * 60)) / 30 + 1 }, (_, index) => {
  const totalMinutes = 5 * 60 + index * 30;
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minute = String(totalMinutes % 60).padStart(2, "0");
  const value = `${hour}:${minute}`;

  return {
    value,
    label: formatTimeAmPm(value),
  };
});

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

function minutesToTime(value: number): string {
  const safe = Math.max(0, value);
  const hours = String(Math.floor(safe / 60)).padStart(2, "0");
  const minutes = String(safe % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
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

function isAdultBirthDate(isoDate: string): boolean {
  if (!isoDate) return false;
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const today = new Date();
  const adultLimit = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const birthDate = new Date(year, month - 1, day);

  return birthDate <= adultLimit;
}

function getStaffPhotoUrl(cedula: string): string {
  return `https://svga.unac.edu.co/svga/files/pics/${encodeURIComponent(cedula)}.jpg`;
}

function getFirstAvailableStaffNumber(staffList: StaffApi[]): number {
  const usedNumbers = new Set(
    staffList
      .map((staff) => staff.numeroStaff)
      .filter((value) => Number.isInteger(value) && value > 0),
  );

  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  return candidate;
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

function roleRequiresCredential(roleId: number): boolean {
  return roleId === 1 || roleId === 2;
}

function getFriendlyStaffApiError(rawMessage: string, action: "guardar" | "actualizar" | "eliminar"): string {
  const message = rawMessage.toLowerCase();

  if (message.includes("unable to start a transaction") || message.includes("transaction api error")) {
    return "El servidor está ocupado en este momento. Intenta nuevamente en unos segundos.";
  }

  if (message.includes("payload invalido") || message.includes("too small") || message.includes("too short")) {
    return "Hay campos incompletos o con formato inválido. Revisa cédula, teléfono, rol y demás datos obligatorios.";
  }

  if (message.includes("invalid uuid") || message.includes("parametros invalidos")) {
    return "Ocurrió un problema interno al identificar el registro. Recarga la página e inténtalo de nuevo.";
  }

  if (message.includes("cedula ya existe") || message.includes("staff_cedula_uq")) {
    return "Ya existe un colaborador registrado con esa cédula.";
  }

  if (message.includes("numero de staff ya existe") || message.includes("staff_numero_staff_uq")) {
    return "El número de personal ya está en uso. Intenta nuevamente.";
  }

  if (message.includes("habilidad")) {
    return "No se pudieron asignar habilidades porque alguna selección no es válida. Vuelve a seleccionar e intenta otra vez.";
  }

  if (message.includes("contrase") || message.includes("password") || message.includes("credencial")) {
    return "Revisa la contraseña: debe cumplir los requisitos del rol seleccionado.";
  }

  return `No se pudo ${action} el personal. Verifica la información e intenta nuevamente.`;
}

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

const toUiWorkWeekDay = (value: string): WorkWeekDay => {
  const normalized = normalizeDayName(value);

  if (normalized === "miercoles") return "Miércoles";
  if (normalized === "sabado") return "Sábado";
  if (normalized === "lunes") return "Lunes";
  if (normalized === "martes") return "Martes";
  if (normalized === "jueves") return "Jueves";
  if (normalized === "viernes") return "Viernes";
  if (normalized === "domingo") return "Domingo";

  return "Lunes";
};

const toBackendWorkWeekDay = (value: string): BackendWorkWeekDay | null => {
  const normalized = normalizeDayName(value);

  if (normalized === "miercoles") return "Miercoles";
  if (normalized === "sabado") return "Sabado";
  if (normalized === "lunes") return "Lunes";
  if (normalized === "martes") return "Martes";
  if (normalized === "jueves") return "Jueves";
  if (normalized === "viernes") return "Viernes";
  if (normalized === "domingo") return "Domingo";

  return null;
};

const getCurrentWorkWeekDay = (): WorkWeekDay => {
  const currentDay = new Date().getDay();
  const dayMap: WorkWeekDay[] = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  return dayMap[currentDay] ?? "Lunes";
};

function StaffScheduleBoard({
  staffList,
  isLoadingStaff,
  canManageStaff,
  isCollaborador,
}: {
  staffList: StaffApi[];
  isLoadingStaff: boolean;
  canManageStaff: boolean;
  isCollaborador: boolean;
}) {
  const [jornadaByStaffId, setJornadaByStaffId] = useState<Record<string, StaffJornadaItem[]>>({});
  const [pausaByStaffId, setPausaByStaffId] = useState<Record<string, StaffPausaItem[]>>({});
  const [isLoadingJornadas, setIsLoadingJornadas] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffApi | null>(null);
  const [editorRows, setEditorRows] = useState<EditableJornadaItem[]>([]);
  const [editorPausaRows, setEditorPausaRows] = useState<EditablePausaItem[]>([]);
  const [isLoadingPausas, setIsLoadingPausas] = useState(false);
  const [isSavingJornada, setIsSavingJornada] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<WorkWeekDay>(() => getCurrentWorkWeekDay());
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Sync vertical scrolls between left and right columns
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < 768) {
      return;
    }

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

  const currentDate = useMemo(() => new Date(nowTimestamp), [nowTimestamp]);
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  const currentWorkDay = useMemo<WorkWeekDay>(() => {
    const dayMap: WorkWeekDay[] = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return dayMap[currentDate.getDay()] ?? "Lunes";
  }, [currentDate]);

  const activeStaffCount = staffList.filter((staff) => staff.estado === "Active").length;
  const hourCells = useMemo(
    () =>
      HOURS.map((hour) => (
        <div key={hour} className="flex h-[56px] items-center justify-center px-2 text-center text-[9px] font-bold leading-none whitespace-nowrap tabular-nums text-[#566166] sm:px-4 sm:text-[10px]">
          {formatTimeAmPm(`${hour}:00`)}
        </div>
      )),
    [],
  );
  const staffWithSchedule = staffList.filter((staff) => (jornadaByStaffId[staff.id]?.length ?? 0) > 0).length;
  const withoutScheduleCount = Math.max(staffList.length - staffWithSchedule, 0);
  const selectedDayKey = normalizeDayName(selectedScheduleDay);
  const currentDayKey = normalizeDayName(currentWorkDay);

  const isStaffWorkingNow = (staffId: string) => {
    const jornadaToday = (jornadaByStaffId[staffId] ?? []).filter(
      (row) => normalizeDayName(row.diaSemana) === currentDayKey,
    );

    if (jornadaToday.length === 0) return false;

    const hasActiveJornada = jornadaToday.some((row) => {
      const start = timeToMinutes(row.horaEntrada);
      const end = timeToMinutes(row.horaSalida);
      return Number.isFinite(start) && Number.isFinite(end) && start <= currentMinutes && currentMinutes < end;
    });

    if (!hasActiveJornada) return false;

    const activePause = (pausaByStaffId[staffId] ?? []).some((pause) => {
      if (normalizeDayName(pause.diaSemana) !== currentDayKey) return false;
      const start = timeToMinutes(pause.horaInicio);
      const end = timeToMinutes(pause.horaFin);
      return Number.isFinite(start) && Number.isFinite(end) && start <= currentMinutes && currentMinutes < end;
    });

    return !activePause;
  };

  const workingNowCount = staffList.filter(
    (staff) => staff.estado === "Active" && isStaffWorkingNow(staff.id),
  ).length;

  const staffWithScheduleOnSelectedDay = staffList.filter((staff) =>
    (jornadaByStaffId[staff.id] ?? []).some((row) => normalizeDayName(row.diaSemana) === selectedDayKey),
  ).length;

  const totalSelectedDayHours = staffList.reduce((sum, staff) => {
    const dayTotal = (jornadaByStaffId[staff.id] ?? [])
      .filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey)
      .reduce((acc, row) => acc + row.totalHorasDia, 0);

    return sum + dayTotal;
  }, 0);

  const collaboratorStaff = isCollaborador ? (staffList[0] ?? null) : null;
  const collaboratorJornadaRows = collaboratorStaff ? (jornadaByStaffId[collaboratorStaff.id] ?? []) : [];
  const collaboratorPausaRows = collaboratorStaff ? (pausaByStaffId[collaboratorStaff.id] ?? []) : [];
  const collaboratorSelectedDayJornadas = collaboratorJornadaRows.filter(
    (row) => normalizeDayName(row.diaSemana) === selectedDayKey,
  );
  const collaboratorSelectedDayPausas = collaboratorPausaRows.filter(
    (row) => normalizeDayName(row.diaSemana) === selectedDayKey,
  );
  const collaboratorSelectedDayPauseHours = collaboratorSelectedDayPausas.reduce(
    (sum, row) => sum + calculateHoursDifference(row.horaInicio, row.horaFin),
    0,
  );
  const collaboratorSelectedDayHours = collaboratorSelectedDayJornadas.reduce((sum, row) => sum + row.totalHorasDia, 0);
  const collaboratorWeeklyHours = collaboratorJornadaRows.reduce((sum, row) => sum + row.totalHorasDia, 0);
  const collaboratorPlanLabel = collaboratorStaff?.tipoContrato ?? "-";

  const sortedStaffList = useMemo(() => {
    return [...staffList].sort((a, b) => {
      const aJornada = jornadaByStaffId[a.id] ?? [];
      const bJornada = jornadaByStaffId[b.id] ?? [];

      const aSelectedDay = aJornada.filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey);
      const bSelectedDay = bJornada.filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey);

      const aStartSelectedDay = aSelectedDay
        .map((row) => timeToMinutes(row.horaEntrada))
        .filter((value) => value >= 0)
        .sort((left, right) => left - right)[0] ?? Infinity;
      const bStartSelectedDay = bSelectedDay
        .map((row) => timeToMinutes(row.horaEntrada))
        .filter((value) => value >= 0)
        .sort((left, right) => left - right)[0] ?? Infinity;

      // On current-day view, always keep currently active people first.
      if (selectedDayKey === currentDayKey) {
        const aWorking = isStaffWorkingNow(a.id);
        const bWorking = isStaffWorkingNow(b.id);
        if (aWorking !== bWorking) {
          return aWorking ? -1 : 1;
        }

        const aActiveStart = aSelectedDay
          .filter((row) => {
            const start = timeToMinutes(row.horaEntrada);
            const end = timeToMinutes(row.horaSalida);
            return Number.isFinite(start) && Number.isFinite(end) && start <= currentMinutes && currentMinutes < end;
          })
          .map((row) => timeToMinutes(row.horaEntrada))
          .sort((left, right) => left - right)[0] ?? Infinity;

        const bActiveStart = bSelectedDay
          .filter((row) => {
            const start = timeToMinutes(row.horaEntrada);
            const end = timeToMinutes(row.horaSalida);
            return Number.isFinite(start) && Number.isFinite(end) && start <= currentMinutes && currentMinutes < end;
          })
          .map((row) => timeToMinutes(row.horaEntrada))
          .sort((left, right) => left - right)[0] ?? Infinity;

        if (aActiveStart !== bActiveStart) {
          return aActiveStart - bActiveStart;
        }
      }

      if (aStartSelectedDay !== bStartSelectedDay) {
        return aStartSelectedDay - bStartSelectedDay;
      }

      const aStart = aJornada
        .map((row) => timeToMinutes(row.horaEntrada))
        .filter((value) => value >= 0)
        .sort((left, right) => left - right)[0] ?? Infinity;
      const bStart = bJornada
        .map((row) => timeToMinutes(row.horaEntrada))
        .filter((value) => value >= 0)
        .sort((left, right) => left - right)[0] ?? Infinity;

      if (aStart !== bStart) {
        return aStart - bStart;
      }

      return a.numeroStaff - b.numeroStaff;
    });
  }, [staffList, jornadaByStaffId, pausaByStaffId, selectedDayKey, currentDayKey, currentMinutes]);

  useEffect(() => {
    const timeline = rightColumnRef.current;
    if (!timeline) return;

    const totalScrollable = timeline.scrollWidth - timeline.clientWidth;
    if (totalScrollable <= 0) return;

    const clampedMinutes = Math.min(Math.max(currentMinutes, TIMELINE_START_MINUTES), TIMELINE_END_MINUTES);
    const ratio = (clampedMinutes - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES;
    const currentX = ratio * timeline.scrollWidth;
    const targetLeft = Math.min(
      Math.max(currentX - timeline.clientWidth / 2, 0),
      totalScrollable,
    );

    const frame = window.requestAnimationFrame(() => {
      timeline.scrollTo({ left: targetLeft, behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedScheduleDay, currentMinutes, sortedStaffList.length]);

  const formatDayHoursLabel = (rows: StaffJornadaItem[]) => `${rows.reduce((sum, row) => sum + row.totalHorasDia, 0).toFixed(1)} h`;

  const loadJornadas = async () => {
    if (staffList.length === 0) {
      setJornadaByStaffId({});
      setPausaByStaffId({});
      return;
    }

    const staffIds = new Set(staffList.map((staff) => staff.id));
    const cachedJornadas = getCachedData<Record<string, StaffJornadaItem[]>>("jornadas_map");
    const cachedPausas = getCachedData<Record<string, StaffPausaItem[]>>("pausas_map");
    const hasCachedJornadas = Boolean(cachedJornadas && Object.keys(cachedJornadas).length > 0);
    const hasCachedPausas = Boolean(cachedPausas && Object.keys(cachedPausas).length > 0);
    const hasCached = hasCachedJornadas || hasCachedPausas;

    try {
      // Show cached data immediately; revalidate in background.
      if (hasCached) {
        const cachedMap: Record<string, StaffJornadaItem[]> = {};
        const cachedPausaMap: Record<string, StaffPausaItem[]> = {};
        for (const staffId of staffIds) {
          cachedMap[staffId] = cachedJornadas?.[staffId] ?? [];
          cachedPausaMap[staffId] = cachedPausas?.[staffId] ?? [];
        }
        setJornadaByStaffId(cachedMap);
        setPausaByStaffId(cachedPausaMap);
      }

      setIsLoadingJornadas(!hasCached);
      setScheduleError(null);

      // Fetch all jornadas and pausas in parallel using bulk endpoints (2 requests instead of 2N)
      const [jornadasResponse, pausasResponse] = await Promise.all([
        fetchApiJson<StaffJornadasBulkResponse>("/api/staff/jornadas-bulk", {
          cache: "no-store",
        }).catch(() => ({ jornadas: {} as Record<string, Array<{ id: string; staffId: string; diaSemana: string; horaEntrada: string; horaSalida: string; totalHorasDia: number }>> })),
        fetchApiJson<StaffPausasBulkResponse>("/api/staff/pausas-bulk", {
          cache: "no-store",
        }).catch(() => ({ pausas: {} as Record<string, Array<{ id: string; staffId: string; diaSemana: string; tipoPausa: "Comida" | "Descanso"; horaInicio: string; horaFin: string }>> })),
      ]);

      const nextMap: Record<string, StaffJornadaItem[]> = {};
      const nextPausaMap: Record<string, StaffPausaItem[]> = {};

      // Build jornadas map
      for (const staffId of staffIds) {
        const jornadaItems = jornadasResponse.jornadas[staffId] ?? [];
        const jornadas = jornadaItems.map((item) => ({
          ...item,
          diaSemana: toUiWorkWeekDay(item.diaSemana) as WorkWeekDay,
        }));
        nextMap[staffId] = jornadas;
      }

      // Build pausas map
      for (const staffId of staffIds) {
        const pausaItems = pausasResponse.pausas[staffId] ?? [];
        const pausas = pausaItems.map((item) => ({
          ...item,
          diaSemana: toUiWorkWeekDay(item.diaSemana) as WorkWeekDay,
          tipoPausa: item.tipoPausa as StaffPausaItem["tipoPausa"],
        }));
        nextPausaMap[staffId] = pausas;
      }

      setJornadaByStaffId(nextMap);
      setPausaByStaffId(nextPausaMap);
      setCachedData("jornadas_map", nextMap, { ttl: 10 * 60 * 1000 });
      setCachedData("pausas_map", nextPausaMap, { ttl: 10 * 60 * 1000 });
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

  const loadPausasForStaff = async (staffId: string) => {
    const response = await fetchApiJson<StaffPausaResponse>(`/api/staff/${staffId}/pausas-programadas`, {
      cache: "no-store",
    }).catch(() => ({ pausas: [] }));

    const mapped = (Array.isArray(response.pausas) ? response.pausas : []).map((item, index) => ({
      id: item.id || `pausa-${index + 1}`,
      diaSemana: toUiWorkWeekDay(item.diaSemana),
      tipoPausa: item.tipoPausa,
      horaInicio: item.horaInicio,
      horaFin: item.horaFin,
    }));

    setEditorPausaRows(mapped);
  };

  const openEditor = async (staff: StaffApi) => {
    if (!canManageStaff) {
      setScheduleError("Solo el perfil Administrador puede modificar jornadas y pausas.");
      return;
    }

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
    setEditorPausaRows([]);
    setIsEditorOpen(true);
    setScheduleError(null);

    try {
      setIsLoadingPausas(true);
      await loadPausasForStaff(staff.id);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "No se pudieron cargar las pausas programadas.");
    } finally {
      setIsLoadingPausas(false);
    }
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingStaff(null);
    setEditorRows([]);
    setEditorPausaRows([]);
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

  const addPausaRow = () => {
    setEditorPausaRows((prev) => [
      ...prev,
      {
        id: `pausa-${Date.now()}-${prev.length + 1}`,
        diaSemana: "",
        tipoPausa: "",
        horaInicio: "12:00",
        horaFin: "13:00",
      },
    ]);
  };

  const removePausaRow = (rowId: string) => {
    setEditorPausaRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const updatePausaRow = (rowId: string, field: keyof Omit<EditablePausaItem, "id">, value: string) => {
    setEditorPausaRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)),
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

  const validatePausaRows = () => {
    if (editorPausaRows.length === 0) {
      return null;
    }

    const jornadaRangesByDay = new Map<string, Array<{ start: number; end: number }>>();

    for (const row of editorRows) {
      if (!row.diaSemana || !row.horaEntrada || !row.horaSalida) continue;
      const start = timeToMinutes(row.horaEntrada);
      const end = timeToMinutes(row.horaSalida);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

      const key = normalizeDayName(row.diaSemana);
      const bucket = jornadaRangesByDay.get(key) ?? [];
      bucket.push({ start, end });
      jornadaRangesByDay.set(key, bucket);
    }

    for (const [index, row] of editorPausaRows.entries()) {
      const label = `Pausa ${index + 1}`;

      if (!row.diaSemana) {
        return `${label}: selecciona un día.`;
      }

      if (!row.tipoPausa) {
        return `${label} (${row.diaSemana}): selecciona el tipo de pausa.`;
      }

      if (!row.horaInicio || !row.horaFin) {
        return `${label} (${row.diaSemana}): completa hora inicio y hora fin.`;
      }

      const start = timeToMinutes(row.horaInicio);
      const end = timeToMinutes(row.horaFin);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return `${label} (${row.diaSemana}): la hora fin debe ser mayor a la hora inicio.`;
      }

      const key = normalizeDayName(row.diaSemana);
      const jornadaRanges = jornadaRangesByDay.get(key) ?? [];
      if (jornadaRanges.length === 0) {
        return `${label} (${row.diaSemana}): primero debes crear una jornada para ese día.`;
      }

      const fitsInsideJornada = jornadaRanges.some((range) => start >= range.start && end <= range.end);
      if (!fitsInsideJornada) {
        return `${label} (${row.diaSemana}): debe estar dentro de una jornada laboral del mismo día.`;
      }

      for (let j = index + 1; j < editorPausaRows.length; j += 1) {
        const other = editorPausaRows[j];
        if (!other || normalizeDayName(other.diaSemana) !== key) continue;

        const otherStart = timeToMinutes(other.horaInicio);
        const otherEnd = timeToMinutes(other.horaFin);
        if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd)) continue;

        const overlaps = start < otherEnd && otherStart < end;
        if (overlaps) {
          return `${label} y Pausa ${j + 1} (${row.diaSemana}): los rangos se solapan.`;
        }
      }
    }

    return null;
  };

  const saveJornada = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageStaff) {
      alert("Solo el perfil Administrador puede modificar jornadas y pausas.");
      return;
    }

    if (!editingStaff) {
      return;
    }

    const validationError = validateEditorRows();
    if (validationError) {
      alert(validationError);
      return;
    }

    const pausaValidationError = validatePausaRows();
    if (pausaValidationError) {
      alert(pausaValidationError);
      return;
    }

    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    const jornadasPayload = editorRows.map((row) => {
      const backendDay = row.diaSemana ? toBackendWorkWeekDay(row.diaSemana) : null;
      if (!backendDay) {
        throw new Error(`Día de jornada inválido: ${row.diaSemana || "(vacio)"}`);
      }

      return {
        diaSemana: backendDay,
        horaEntrada: row.horaEntrada,
        horaSalida: row.horaSalida,
        totalHorasDia: Number(row.totalHorasDia),
      };
    });

    const pausasPayload = editorPausaRows.map((row) => {
      const backendDay = row.diaSemana ? toBackendWorkWeekDay(row.diaSemana) : null;
      if (!backendDay) {
        throw new Error(`Día de pausa inválido: ${row.diaSemana || "(vacio)"}`);
      }

      return {
        id: isUuid(row.id) ? row.id : undefined,
        diaSemana: backendDay,
        tipoPausa: row.tipoPausa,
        horaInicio: row.horaInicio,
        horaFin: row.horaFin,
      };
    });

    try {
      setIsSavingJornada(true);

      await fetchApiJson<{ message: string; staffId: string }>(`/api/staff/${editingStaff.id}/jornada-semanal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jornadas: jornadasPayload,
        }),
      });

      const existingPausasResponse = await fetchApiJson<StaffPausaResponse>(
        `/api/staff/${editingStaff.id}/pausas-programadas`,
        { cache: "no-store" },
      ).catch(() => ({ pausas: [] }));
      const existingPausas = Array.isArray(existingPausasResponse.pausas) ? existingPausasResponse.pausas : [];
      const existingIds = new Set(existingPausas.map((item) => item.id));
      const payloadIds = new Set(pausasPayload.map((item) => item.id).filter((value): value is string => Boolean(value)));

      const toDelete = existingPausas.filter((item) => !payloadIds.has(item.id));
      const toUpdate = pausasPayload.filter((item) => item.id && existingIds.has(item.id));
      const toCreate = pausasPayload.filter((item) => !item.id);

      await Promise.all(
        toDelete.map((pausa) =>
          fetchApiJson<{ message: string; id: string }>(`/api/staff/${editingStaff.id}/pausas-programadas/${pausa.id}`, {
            method: "DELETE",
          }),
        ),
      );

      await Promise.all(
        toUpdate.map((pausa) =>
          fetchApiJson<{ message: string; id: string }>(`/api/staff/${editingStaff.id}/pausas-programadas/${pausa.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              diaSemana: pausa.diaSemana,
              tipoPausa: pausa.tipoPausa,
              horaInicio: pausa.horaInicio,
              horaFin: pausa.horaFin,
            }),
          }),
        ),
      );

      await Promise.all(
        toCreate.map((pausa) =>
          fetchApiJson<{ message: string; id: string }>(`/api/staff/${editingStaff.id}/pausas-programadas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              diaSemana: pausa.diaSemana,
              tipoPausa: pausa.tipoPausa,
              horaInicio: pausa.horaInicio,
              horaFin: pausa.horaFin,
            }),
          }),
        ),
      );

      const refreshedPausasResponse = await fetchApiJson<StaffPausaResponse>(`/api/staff/${editingStaff.id}/pausas-programadas`, {
        cache: "no-store",
      }).catch(() => ({ pausas: [] }));
      const refreshedPausas = (Array.isArray(refreshedPausasResponse.pausas) ? refreshedPausasResponse.pausas : []).map((item) => ({
        ...item,
        diaSemana: toUiWorkWeekDay(item.diaSemana),
      }));

      const refreshedJornadas: StaffJornadaItem[] = editorRows
        .map((row, index) => {
          if (!row.diaSemana) return null;
          return {
            id: row.id || `tmp-jornada-${index + 1}`,
            staffId: editingStaff.id,
            diaSemana: row.diaSemana,
            horaEntrada: row.horaEntrada,
            horaSalida: row.horaSalida,
            totalHorasDia: Number(row.totalHorasDia),
          };
        })
        .filter((item): item is StaffJornadaItem => Boolean(item));

      setJornadaByStaffId((prev) => {
        const next = { ...prev, [editingStaff.id]: refreshedJornadas };
        setCachedData("jornadas_map", next, { ttl: 10 * 60 * 1000 });
        return next;
      });

      setPausaByStaffId((prev) => {
        const next = { ...prev, [editingStaff.id]: refreshedPausas };
        setCachedData("pausas_map", next, { ttl: 10 * 60 * 1000 });
        return next;
      });

      closeEditor();
      alert("Jornada y pausas actualizadas correctamente.");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo guardar la configuración de jornada/pausas.");
    } finally {
      setIsSavingJornada(false);
    }
  };

  const compactDayLabel = (rows: StaffJornadaItem[]) => {
    const days = rows.map((row) => row.diaSemana);
    return days.join(", ");
  };

  const getBandSegments = (jornada: StaffJornadaItem[]) => {
    const rawSegments = jornada
      .map((row) => ({
        start: timeToMinutes(row.horaEntrada),
        end: timeToMinutes(row.horaSalida),
      }))
      .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start)
      .map((segment) => ({
        start: Math.max(segment.start, TIMELINE_START_MINUTES),
        end: Math.min(segment.end, TIMELINE_END_MINUTES),
      }))
      .filter((segment) => segment.end > segment.start)
      .sort((a, b) => a.start - b.start);

    if (rawSegments.length === 0) {
      return [] as Array<{ start: number; end: number; left: number; width: number }>;
    }

    const mergedSegments: Array<{ start: number; end: number }> = [];
    for (const segment of rawSegments) {
      const previous = mergedSegments[mergedSegments.length - 1];
      if (!previous || segment.start > previous.end) {
        mergedSegments.push({ ...segment });
        continue;
      }

      previous.end = Math.max(previous.end, segment.end);
    }

    return mergedSegments.map((segment) => {
      const left = ((segment.start - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100;
      const width = Math.max(((segment.end - segment.start) / TIMELINE_TOTAL_MINUTES) * 100, 1.2);
      return { ...segment, left, width };
    });
  };

  const totalWeeklyWorkHours = editorRows.reduce((sum, row) => sum + parseFloat(row.totalHorasDia || "0"), 0);
  const totalWeeklyPauseHours = editorPausaRows.reduce(
    (sum, row) => sum + calculateHoursDifference(row.horaInicio, row.horaFin),
    0,
  );
  const sortedEditorPausaRows = useMemo(
    () =>
      [...editorPausaRows].sort((left, right) => {
        const leftDay = left.diaSemana ? (WORK_DAY_ORDER[left.diaSemana] ?? 99) : 99;
        const rightDay = right.diaSemana ? (WORK_DAY_ORDER[right.diaSemana] ?? 99) : 99;
        if (leftDay !== rightDay) return leftDay - rightDay;

        const leftStart = timeToMinutes(left.horaInicio);
        const rightStart = timeToMinutes(right.horaInicio);
        if (leftStart !== rightStart) return leftStart - rightStart;

        const leftEnd = timeToMinutes(left.horaFin);
        const rightEnd = timeToMinutes(right.horaFin);
        if (leftEnd !== rightEnd) return leftEnd - rightEnd;

        return left.id.localeCompare(right.id);
      }),
    [editorPausaRows],
  );
  const totalWeeklyNetHours = Math.max(totalWeeklyWorkHours - totalWeeklyPauseHours, 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#2a3439] sm:text-2xl">Horario maestro semanal del personal</h2>
          <p className="mt-0.5 text-xs text-[#566166] sm:mt-1 sm:text-sm">Vista diaria • {selectedScheduleDay}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-[#f0f4f7] p-1">
          {MASTER_WEEK_DAYS.map((day) => {
            const isSelected = day === selectedScheduleDay;
            return (
              <button
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition sm:px-3 sm:py-1.5 sm:text-xs ${isSelected ? "bg-white text-[#3a5f94] shadow-sm" : "text-[#566166] hover:bg-white/70"}`}
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

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        {isCollaborador ? (
          <>
            <div className="flex min-h-[124px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 sm:min-h-[132px] sm:p-4 md:p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Tipo de plan</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl leading-tight font-black text-[#2a3439] sm:text-2xl">{collaboratorPlanLabel}</span>
              </div>
            </div>
            <div className="flex min-h-[124px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 sm:min-h-[132px] sm:p-4 md:p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Pausas</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl leading-tight font-black text-[#2a3439] sm:text-2xl">{collaboratorSelectedDayPausas.length}</span>
                <span className="h-4 w-px bg-slate-300" aria-hidden="true" />
                <span className="text-xs font-medium text-[#566166] sm:text-sm">{formatDurationHuman(collaboratorSelectedDayPauseHours)} descanso</span>
              </div>
            </div>
            <div className="flex min-h-[124px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 sm:min-h-[132px] sm:p-4 md:p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Horas totales del día</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl leading-tight font-black text-[#2a3439] sm:text-2xl">{collaboratorSelectedDayHours.toFixed(1)}</span>
                <span className="text-xs font-medium text-[#566166] sm:text-sm">{selectedScheduleDay}</span>
              </div>
            </div>
            <div className="flex min-h-[124px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 sm:min-h-[132px] sm:p-4 md:p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Horas totales semanales</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl leading-tight font-black text-[#2a3439] sm:text-2xl">{collaboratorWeeklyHours.toFixed(1)}</span>
                <span className="text-xs font-medium text-[#566166] sm:text-sm">semana</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 md:p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Trabajando ahora</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black text-[#2a3439] sm:text-2xl">{workingNowCount}</span>
                <span className="text-xs font-bold text-[#3a5f94]">/ {activeStaffCount} activos</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 md:p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Sin horario</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black text-[#9f403d] sm:text-2xl">{withoutScheduleCount}</span>
                <span className="text-xs font-medium text-[#566166]">pendientes de asignación</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 md:p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Con horario</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black text-[#2a3439] sm:text-2xl">{staffWithScheduleOnSelectedDay}</span>
                <span className="text-xs font-medium text-[#566166]">personas</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 md:p-5">
              <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Horas totales del día</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black text-[#2a3439] sm:text-2xl">{totalSelectedDayHours.toFixed(1)}</span>
                <span className="text-xs font-medium text-[#566166]">{selectedScheduleDay}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {scheduleError ? <p className="text-sm font-medium text-[#9f403d]">{scheduleError}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          className={`flex h-auto flex-col md:flex-row ${
            isCollaborador ? "" : "min-h-[520px] md:h-[640px] lg:h-[696px]"
          }`}
        >
          {/* Fixed left column: Staff names */}
          <div className="flex w-full flex-col border-b border-slate-200 md:w-64 md:border-r md:border-b-0">
            <div className="flex h-[56px] items-center gap-2 border-b border-slate-200 bg-[#f0f4f7] px-4 text-xs font-bold tracking-wider text-[#2a3439] uppercase shadow-[6px_0_12px_rgba(15,23,42,0.04)]">
              <span className="material-symbols-outlined text-sm">badge</span>
              Miembro del personal
            </div>

            <div
              className={`flex-1 divide-y divide-slate-200 ${
                isCollaborador ? "overflow-visible" : "max-h-[220px] overflow-y-auto md:max-h-none"
              }`}
              ref={leftColumnRef}
            >
              {isLoadingStaff || isLoadingJornadas ? (
                <p className="p-4 text-sm text-[#566166]">Cargando horario maestro...</p>
              ) : staffList.length === 0 ? (
                <p className="p-4 text-sm text-[#566166]">No hay personal registrado.</p>
              ) : (
                sortedStaffList.map((staff) => {
                  const jornada = jornadaByStaffId[staff.id] ?? [];
                  const jornadaForSelectedDay = jornada.filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey);
                  const hasJornada = jornadaForSelectedDay.length > 0;
                  const workingNow = isStaffWorkingNow(staff.id);

                  return (
                    <div className={`flex h-[62px] items-center gap-2.5 bg-white px-3 sm:h-[70px] sm:gap-3 sm:px-4 md:h-[74px] ${workingNow ? "border-l-4 border-emerald-500" : ""}`} key={staff.id}>
                      <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-[#e8eff3] text-[11px] font-black text-[#375c91] sm:h-10 sm:w-10 sm:text-xs">
                        <img
                          src={getStaffPhotoUrl(staff.cedula)}
                          alt={`${staff.nombres} ${staff.apellidos}`}
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(event) => {
                            const image = event.currentTarget;
                            image.style.display = "none";
                            const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                            if (fallback) {
                              fallback.style.display = "flex";
                            }
                          }}
                          onLoad={(event) => {
                            const image = event.currentTarget;
                            const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                            if (fallback) {
                              fallback.style.display = "none";
                            }
                          }}
                        />
                        <div
                          data-staff-photo-fallback="true"
                          className="absolute inset-0 hidden items-center justify-center bg-[#e8eff3] text-[11px] font-black text-[#375c91] sm:text-xs"
                        >
                          N.{staff.numeroStaff}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#2a3439] sm:text-sm">
                          {staff.nombres} {staff.apellidos}
                        </p>
                        <p className="truncate text-[10px] text-[#566166]">{staff.rol}</p>
                      </div>
                      {canManageStaff ? (
                        <button
                          aria-label={hasJornada ? "Editar horario" : "Asignar horario"}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[#3a5f94] transition hover:bg-[#3a5f94] hover:text-white"
                          onClick={() => void openEditor(staff)}
                          type="button"
                          title={hasJornada ? "Editar horario" : "Asignar horario"}
                        >
                          <span className="material-symbols-outlined text-[17px]">edit_calendar</span>
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Scrollable right column: Schedule timeline */}
          <div className={`flex min-w-0 flex-1 flex-col ${isCollaborador ? "min-h-0 overflow-visible" : "min-h-[360px] overflow-hidden md:min-h-0"}`}>
            <div
              className={`flex-1 overflow-x-auto [overscroll-behavior-x:contain] [touch-action:pan-x_pan-y] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                isCollaborador ? "overflow-y-visible" : "overflow-y-auto"
              }`}
              ref={rightColumnRef}
            >
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
                sortedStaffList.map((staff) => {
                  const jornada = jornadaByStaffId[staff.id] ?? [];
                  const pausas = pausaByStaffId[staff.id] ?? [];
                  const jornadaForSelectedDay = jornada.filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey);
                  const pausasForSelectedDay = pausas
                    .filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey)
                    .sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));
                  const hasJornada = jornadaForSelectedDay.length > 0;
                  const bandSegments = getBandSegments(jornadaForSelectedDay);

                  return (
                    <div className="relative h-[62px] bg-white sm:h-[70px] md:h-[74px]" key={staff.id}>
                      <div className="absolute inset-0 grid divide-x divide-slate-200/60" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(80px, 1fr))` }}>
                        {HOURS.map((hour) => (
                          <div key={`${staff.id}-${hour}`} className="h-full" />
                        ))}
                      </div>

                      {/* Current time indicator if today */}
                      {selectedScheduleDay === currentWorkDay && currentMinutes >= TIMELINE_START_MINUTES && currentMinutes <= TIMELINE_END_MINUTES ? (
                        <div
                          className="absolute top-0 bottom-0 z-20 w-0.5 bg-red-500"
                          style={{ left: `${((currentMinutes - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100}%` }}
                        />
                      ) : null}

                      {hasJornada && pausasForSelectedDay.length > 0 ? (
                        <div className="pointer-events-none absolute inset-y-2 z-10 left-0 right-0">
                          {pausasForSelectedDay.map((pausa) => {
                            const pausaStart = timeToMinutes(pausa.horaInicio);
                            const pausaEnd = timeToMinutes(pausa.horaFin);
                            if (!Number.isFinite(pausaStart) || !Number.isFinite(pausaEnd) || pausaEnd <= pausaStart) {
                              return null;
                            }

                            const clampedStart = Math.max(pausaStart, TIMELINE_START_MINUTES);
                            const clampedEnd = Math.min(pausaEnd, TIMELINE_END_MINUTES);
                            if (clampedEnd <= clampedStart) {
                              return null;
                            }

                            const left = ((clampedStart - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100;
                            const width = Math.max(((clampedEnd - clampedStart) / TIMELINE_TOTAL_MINUTES) * 100, 1.2);

                            return (
                              <div
                                key={pausa.id}
                                className="absolute inset-y-1.5 rounded bg-rose-200/85 ring-1 ring-rose-300/90"
                                style={{ left: `${left}%`, width: `${width}%` }}
                                title={`${pausa.tipoPausa}: ${pausa.horaInicio} - ${pausa.horaFin}`}
                              />
                            );
                          })}
                        </div>
                      ) : null}

                      {bandSegments.map((segment, index) => (
                        <div
                          key={`${staff.id}-band-${index + 1}`}
                          className="absolute inset-y-2 z-20 rounded-r-md border-l-4 border-[#3a5f94] bg-[#3a5f94]/10"
                          style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                        />
                      ))}

                      {hasJornada ? (
                        <>
                          {bandSegments.map((segment, index) => {
                            const pauseCount = pausasForSelectedDay.filter((pausa) => {
                              const pausaStart = timeToMinutes(pausa.horaInicio);
                              const pausaEnd = timeToMinutes(pausa.horaFin);
                              if (!Number.isFinite(pausaStart) || !Number.isFinite(pausaEnd) || pausaEnd <= pausaStart) {
                                return false;
                              }

                              return pausaStart < segment.end && segment.start < pausaEnd;
                            }).length;

                            const segmentHours = Number(((segment.end - segment.start) / 60).toFixed(1));
                            const segmentLabel = `${formatTimeAmPm(minutesToTime(segment.start))} - ${formatTimeAmPm(minutesToTime(segment.end))} • ${segmentHours} h${pauseCount > 0 ? ` • Pausas: ${pauseCount}` : ""}`;

                            return (
                              <div
                                key={`${staff.id}-segment-label-${index + 1}`}
                                className="pointer-events-none absolute inset-y-2 z-30 pr-2"
                                style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
                              >
                                <div className="flex h-full items-center gap-2 overflow-hidden pl-3">
                                  <div className="h-2 w-2 shrink-0 rounded-full bg-[#3a5f94]" />
                                  <span className="truncate text-[10px] font-bold text-[#3a5f94]">{segmentLabel}</span>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <div className="pointer-events-none absolute inset-y-2 z-30 left-0 right-0 px-4">
                          <div className="flex h-full items-center gap-2 overflow-hidden">
                            <span className="truncate text-[10px] font-bold text-[#3a5f94]">Sin horario asignado</span>
                          </div>
                        </div>
                      )}
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
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#2a3439]">Bloques de jornada semanal</p>
                  <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-[#566166]" onClick={addEditorRow} type="button">
                    + Agregar bloque
                  </button>
                </div>

                <div className="space-y-2">
                  {editorRows.map((row, index) => (
                    <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]" key={row.id}>
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

                        <select
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) => updateEditorRow(row.id, "horaEntrada", event.target.value)}
                          value={row.horaEntrada}
                        >
                          <option value="">Hora de inicio</option>
                          {TIME_SLOT_OPTIONS.map((option) => (
                            <option key={`entrada-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <select
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) => updateEditorRow(row.id, "horaSalida", event.target.value)}
                          value={row.horaSalida}
                        >
                          <option value="">Hora de fin</option>
                          {TIME_SLOT_OPTIONS.map((option) => (
                            <option key={`salida-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

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
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#2a3439]">Pausas programadas (comida/descanso)</p>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-[#566166]"
                    onClick={addPausaRow}
                    type="button"
                  >
                    + Agregar pausa
                  </button>
                </div>

                {isLoadingPausas ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-[#566166]">
                    Cargando pausas...
                  </p>
                ) : editorPausaRows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-[#566166]">
                    No hay pausas configuradas para este colaborador.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sortedEditorPausaRows.map((row, index) => (
                      <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]" key={row.id}>
                        <select
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) => updatePausaRow(row.id, "diaSemana", event.target.value)}
                          value={row.diaSemana}
                        >
                          <option value="">Día</option>
                          {MASTER_WEEK_DAYS.map((day) => (
                            <option key={`pausa-day-${day}`} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>

                        <select
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) => updatePausaRow(row.id, "tipoPausa", event.target.value)}
                          value={row.tipoPausa}
                        >
                          <option value="">Sin asignar</option>
                          {PAUSA_TIPOS.map((tipo) => (
                            <option key={`pausa-tipo-${tipo}`} value={tipo}>
                              {tipo}
                            </option>
                          ))}
                        </select>

                        <select
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) => updatePausaRow(row.id, "horaInicio", event.target.value)}
                          value={row.horaInicio}
                        >
                          <option value="">Inicio</option>
                          {TIME_SLOT_OPTIONS.map((option) => (
                            <option key={`pausa-inicio-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <select
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) => updatePausaRow(row.id, "horaFin", event.target.value)}
                          value={row.horaFin}
                        >
                          <option value="">Fin</option>
                          {TIME_SLOT_OPTIONS.map((option) => (
                            <option key={`pausa-fin-${option.value}`} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-[#9f403d]"
                          onClick={() => removePausaRow(row.id)}
                          type="button"
                        >
                          Quitar
                        </button>

                        <p className="text-[10px] text-[#566166] md:col-span-5">Pausa {index + 1}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-4 space-y-2 rounded-lg bg-blue-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2a3439]">Horas totales por semana:</span>
                    <span className="text-lg font-black text-[#3a5f94]">{totalWeeklyWorkHours.toFixed(1)} h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2a3439]">Horas de descanso por semana:</span>
                    <span className="text-base font-black text-[#9f403d]">{totalWeeklyPauseHours.toFixed(1)} h</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-blue-100 pt-2">
                    <span className="text-xs font-bold text-[#2a3439]">Horas netas disponibles:</span>
                    <span className="text-base font-black text-[#2f7d4d]">{totalWeeklyNetHours.toFixed(1)} h</span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-[#566166]" onClick={closeEditor} type="button">
                    Cancelar
                  </button>
                    <button className="rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white disabled:opacity-60" disabled={isSavingJornada || isLoadingPausas} type="submit">
                      {isSavingJornada ? "Guardando..." : "Guardar configuración"}
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
  const authSession = useMemo(() => readAuthSession(), []);
  const canManageStaff = authSession?.role === "admin";
  const isCollaborador = authSession?.role === "colaborador";
  const collaboratorStaffId = authSession?.staffId ?? null;
  const [view, setView] = useState<StaffView>("directory");
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [showEditStaffForm, setShowEditStaffForm] = useState(false);
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffApi[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isStaffDetailModalOpen, setIsStaffDetailModalOpen] = useState(false);
  const [mobileDetailTab, setMobileDetailTab] = useState<StaffMobileDetailTab>("profile");
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [isSavingNewStaff, setIsSavingNewStaff] = useState(false);
  const [isSavingEditStaff, setIsSavingEditStaff] = useState(false);
  const [skillsCatalog, setSkillsCatalog] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [isLoadingLiveSchedules, setIsLoadingLiveSchedules] = useState(false);
  const [liveJornadaByStaffId, setLiveJornadaByStaffId] = useState<Record<string, StaffJornadaItem[]>>({});
  const [livePausaByStaffId, setLivePausaByStaffId] = useState<Record<string, StaffPausaItem[]>>({});
  const [cachedLiveStatusByStaffId, setCachedLiveStatusByStaffId] = useState<Record<string, StaffLiveStatus>>({});
  const [selectedStaffJornada, setSelectedStaffJornada] = useState<StaffJornadaItem[]>([]);
  const [selectedStaffPausas, setSelectedStaffPausas] = useState<StaffPausaItem[]>([]);
  const [isLoadingDailySchedule, setIsLoadingDailySchedule] = useState(false);
  const [dailyScheduleDay, setDailyScheduleDay] = useState<WorkWeekDay>("Lunes");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditPasswordConfirm, setShowEditPasswordConfirm] = useState(false);
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
    password: "",
    passwordConfirm: "",
    habilidadIds: [] as string[],
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
    password: "",
    passwordConfirm: "",
    habilidadIds: [] as string[],
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
    if (isCollaborador) {
      if (!collaboratorStaffId) return staffList[0] ?? null;
      return staffList.find((staff) => staff.id === collaboratorStaffId) ?? staffList[0] ?? null;
    }
    if (!selectedStaffId) return null;
    return staffList.find((staff) => staff.id === selectedStaffId) ?? null;
  }, [selectedStaffId, staffList, isCollaborador, collaboratorStaffId]);

  useEffect(() => {
    if (staffList.length === 0) return;
    if (selectedStaffId && staffList.some((staff) => staff.id === selectedStaffId)) return;
    const firstStaffId = staffList[0]?.id ?? null;
    if (firstStaffId) {
      setSelectedStaffId(firstStaffId);
    }
  }, [staffList, selectedStaffId]);

  useEffect(() => {
    if (!isCollaborador) return;

    if (staffList.length === 0) {
      if (selectedStaffId !== null) {
        setSelectedStaffId(null);
      }
      return;
    }

    const forcedId = collaboratorStaffId && staffList.some((staff) => staff.id === collaboratorStaffId)
      ? collaboratorStaffId
      : (staffList[0]?.id ?? null);

    if (forcedId && selectedStaffId !== forcedId) {
      setSelectedStaffId(forcedId);
    }
  }, [isCollaborador, collaboratorStaffId, staffList, selectedStaffId]);

  const selectedStaffSkills = selectedStaff?.habilidades ?? [];

  useEffect(() => {
    const cachedLiveStatus = getCachedData<Record<string, StaffLiveStatus>>("live_status_by_staff_id");
    if (cachedLiveStatus) {
      setCachedLiveStatusByStaffId(cachedLiveStatus);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadLiveSchedules = async () => {
      if (staffList.length === 0) {
        setLiveJornadaByStaffId({});
        setLivePausaByStaffId({});
        setIsLoadingLiveSchedules(false);
        return;
      }

      const staffIds = new Set(staffList.map((staff) => staff.id));
      const cachedJornadas = getCachedData<Record<string, StaffJornadaItem[]>>("jornadas_map");
      const cachedPausas = getCachedData<Record<string, StaffPausaItem[]>>("pausas_map");

      if (!isCancelled && (cachedJornadas || cachedPausas)) {
        const cachedJornadaMap: Record<string, StaffJornadaItem[]> = {};
        const cachedPausaMap: Record<string, StaffPausaItem[]> = {};
        for (const staffId of staffIds) {
          cachedJornadaMap[staffId] = cachedJornadas?.[staffId] ?? [];
          cachedPausaMap[staffId] = cachedPausas?.[staffId] ?? [];
        }
        setLiveJornadaByStaffId(cachedJornadaMap);
        setLivePausaByStaffId(cachedPausaMap);
      }

      try {
        setIsLoadingLiveSchedules(true);

        // Fetch all staff schedules in 2 requests (bulk) instead of 2N requests.
        const [jornadasResponse, pausasResponse] = await Promise.all([
          fetchApiJson<StaffJornadasBulkResponse>("/api/staff/jornadas-bulk", {
            cache: "no-store",
          }).catch(() => ({
            jornadas: {} as Record<string, Array<{ id: string; staffId: string; diaSemana: string; horaEntrada: string; horaSalida: string; totalHorasDia: number }>>,
          })),
          fetchApiJson<StaffPausasBulkResponse>("/api/staff/pausas-bulk", {
            cache: "no-store",
          }).catch(() => ({
            pausas: {} as Record<string, Array<{ id: string; staffId: string; diaSemana: string; tipoPausa: "Comida" | "Descanso"; horaInicio: string; horaFin: string }>>,
          })),
        ]);

        if (isCancelled) return;

        const nextJornadas: Record<string, StaffJornadaItem[]> = {};
        const nextPausas: Record<string, StaffPausaItem[]> = {};

        for (const staff of staffList) {
          const jornadaItems = jornadasResponse.jornadas[staff.id] ?? [];
          const pausaItems = pausasResponse.pausas[staff.id] ?? [];

          nextJornadas[staff.id] = jornadaItems.map((item) => ({
            ...item,
            diaSemana: toUiWorkWeekDay(item.diaSemana),
          }));

          nextPausas[staff.id] = pausaItems.map((item) => ({
            ...item,
            diaSemana: toUiWorkWeekDay(item.diaSemana),
            tipoPausa: item.tipoPausa as StaffPausaItem["tipoPausa"],
          }));
        }

        setLiveJornadaByStaffId(nextJornadas);
        setLivePausaByStaffId(nextPausas);
        setCachedData("jornadas_map", nextJornadas, { ttl: 10 * 60 * 1000 });
        setCachedData("pausas_map", nextPausas, { ttl: 10 * 60 * 1000 });
      } finally {
        if (!isCancelled) {
          setIsLoadingLiveSchedules(false);
        }
      }
    };

    void loadLiveSchedules();

    return () => {
      isCancelled = true;
    };
  }, [staffList]);

  const selectedStaffBalanceHours = selectedStaff?.balanceHoras ?? 0;
  const selectedStaffFormattedBalanceHours = `${selectedStaffBalanceHours > 0 ? "+" : ""}${selectedStaffBalanceHours} horas`;

  useEffect(() => {
    setDailyScheduleDay(getCurrentWorkWeekDay());
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadSelectedStaffDailySchedule = async () => {
      if (!selectedStaff?.id) {
        setSelectedStaffJornada([]);
        setSelectedStaffPausas([]);
        setIsLoadingDailySchedule(false);
        return;
      }

      const staffId = selectedStaff.id;
      const hasLiveJornada = Object.prototype.hasOwnProperty.call(liveJornadaByStaffId, staffId);
      const hasLivePausa = Object.prototype.hasOwnProperty.call(livePausaByStaffId, staffId);

      if (hasLiveJornada && hasLivePausa) {
        setSelectedStaffJornada(liveJornadaByStaffId[staffId] ?? []);
        setSelectedStaffPausas(livePausaByStaffId[staffId] ?? []);
        setIsLoadingDailySchedule(false);
        return;
      }

      const cachedJornadasMap = getCachedData<Record<string, StaffJornadaItem[]>>("jornadas_map");
      const cachedPausasMap = getCachedData<Record<string, StaffPausaItem[]>>("pausas_map");
      const hasCachedJornada = Boolean(cachedJornadasMap && Object.prototype.hasOwnProperty.call(cachedJornadasMap, staffId));
      const hasCachedPausa = Boolean(cachedPausasMap && Object.prototype.hasOwnProperty.call(cachedPausasMap, staffId));

      if (hasCachedJornada && hasCachedPausa) {
        setSelectedStaffJornada(cachedJornadasMap?.[staffId] ?? []);
        setSelectedStaffPausas(cachedPausasMap?.[staffId] ?? []);
        setIsLoadingDailySchedule(false);
        return;
      }

      if (isLoadingLiveSchedules) {
        setIsLoadingDailySchedule(true);
        return;
      }

      try {
        setIsLoadingDailySchedule(true);

        const [jornadaResponse, pausaResponse] = await Promise.all([
          fetchApiJson<StaffJornadaResponse>(`/api/staff/${staffId}/jornada-semanal`, { cache: "no-store" }).catch(() => ({ jornadas: [] })),
          fetchApiJson<StaffPausaResponse>(`/api/staff/${staffId}/pausas-programadas`, { cache: "no-store" }).catch(() => ({ pausas: [] })),
        ]);

        if (isCancelled) return;

        const jornadas = (Array.isArray(jornadaResponse.jornadas) ? jornadaResponse.jornadas : []).map((item) => ({
          ...item,
          diaSemana: toUiWorkWeekDay(item.diaSemana),
        }));

        const pausas = (Array.isArray(pausaResponse.pausas) ? pausaResponse.pausas : []).map((item) => ({
          ...item,
          diaSemana: toUiWorkWeekDay(item.diaSemana),
        }));

        setSelectedStaffJornada(jornadas);
        setSelectedStaffPausas(pausas);
      } finally {
        if (!isCancelled) {
          setIsLoadingDailySchedule(false);
        }
      }
    };

    void loadSelectedStaffDailySchedule();

    return () => {
      isCancelled = true;
    };
  }, [selectedStaff?.id, liveJornadaByStaffId, livePausaByStaffId, isLoadingLiveSchedules]);

  const dailyScheduleItems = useMemo(() => {
    const selectedDayKey = normalizeDayName(dailyScheduleDay);
    const todayKey = normalizeDayName(getCurrentWorkWeekDay());
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isTodaySelected = selectedDayKey === todayKey;

    const jornadas = selectedStaffJornada
      .filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey)
      .sort((a, b) => timeToMinutes(a.horaEntrada) - timeToMinutes(b.horaEntrada));

    const pausas = selectedStaffPausas
      .filter((row) => normalizeDayName(row.diaSemana) === selectedDayKey)
      .sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));

    const getMealLabel = (start: number) => {
      if (start < 11 * 60 + 30) return "Desayuno";
      if (start < 17 * 60 + 30) return "Almuerzo";
      return "Cena";
    };

    const segments: Array<{
      id: string;
      label: string;
      range: string;
      isPause: boolean;
      start: number;
      end: number;
      isCurrent: boolean;
    }> = [];

    jornadas.forEach((jornada, jornadaIndex) => {
      const jornadaStart = timeToMinutes(jornada.horaEntrada);
      const jornadaEnd = timeToMinutes(jornada.horaSalida);
      if (jornadaStart < 0 || jornadaEnd <= jornadaStart) return;

      const pausesInsideJornada = pausas
        .map((pausa, pausaIndex) => ({
          ...pausa,
          pausaIndex,
          start: timeToMinutes(pausa.horaInicio),
          end: timeToMinutes(pausa.horaFin),
        }))
        .filter((pausa) => pausa.start < jornadaEnd && jornadaStart < pausa.end)
        .sort((a, b) => a.start - b.start);

      let cursor = jornadaStart;

      pausesInsideJornada.forEach((pausa) => {
        const pausaStart = Math.max(pausa.start, jornadaStart);
        const pausaEnd = Math.min(pausa.end, jornadaEnd);
        if (pausaEnd <= pausaStart) return;

        if (pausaStart > cursor) {
          segments.push({
            id: `work-${jornada.id || jornadaIndex}-${cursor}`,
            label: "Trabajo",
            range: `${minutesToTime(cursor)} - ${minutesToTime(pausaStart)}`,
            isPause: false,
            start: cursor,
            end: pausaStart,
            isCurrent: isTodaySelected && currentMinutes >= cursor && currentMinutes < pausaStart,
          });
        }

        const pausaLabel = pausa.tipoPausa === "Comida" ? getMealLabel(pausaStart) : "Descanso";
        segments.push({
          id: `pause-${pausa.id || pausa.pausaIndex}-${pausaStart}`,
          label: pausaLabel,
          range: `${minutesToTime(pausaStart)} - ${minutesToTime(pausaEnd)}`,
          isPause: true,
          start: pausaStart,
          end: pausaEnd,
          isCurrent: isTodaySelected && currentMinutes >= pausaStart && currentMinutes < pausaEnd,
        });

        cursor = Math.max(cursor, pausaEnd);
      });

      if (cursor < jornadaEnd) {
        segments.push({
          id: `work-end-${jornada.id || jornadaIndex}-${cursor}`,
          label: "Trabajo",
          range: `${minutesToTime(cursor)} - ${minutesToTime(jornadaEnd)}`,
          isPause: false,
          start: cursor,
          end: jornadaEnd,
          isCurrent: isTodaySelected && currentMinutes >= cursor && currentMinutes < jornadaEnd,
        });
      }
    });

    return segments.sort((a, b) => a.start - b.start);
  }, [dailyScheduleDay, selectedStaffJornada, selectedStaffPausas]);

  const getLiveStatusFromSchedules = (jornadas: StaffJornadaItem[], pausas: StaffPausaItem[]): StaffLiveStatus => {
    const todayKey = normalizeDayName(getCurrentWorkWeekDay());
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const jornadasToday = jornadas
      .filter((row) => normalizeDayName(row.diaSemana) === todayKey)
      .map((row) => ({
        start: timeToMinutes(row.horaEntrada),
        end: timeToMinutes(row.horaSalida),
      }))
      .filter((row) => row.start >= 0 && row.end > row.start);

    if (jornadasToday.length === 0) return "Inactivo";

    const isWithinJornada = jornadasToday.some(
      (row) => currentMinutes >= row.start && currentMinutes < row.end,
    );

    if (!isWithinJornada) return "Inactivo";

    const pausesToday = pausas
      .filter((row) => normalizeDayName(row.diaSemana) === todayKey)
      .map((row) => ({
        start: timeToMinutes(row.horaInicio),
        end: timeToMinutes(row.horaFin),
      }))
      .filter((row) => row.start >= 0 && row.end > row.start);

    const isInPause = pausesToday.some(
      (row) => currentMinutes >= row.start && currentMinutes < row.end,
    );

    if (isInPause) return "Descanso";
    return "Activo";
  };

  const liveStatusByStaffId = useMemo(() => {
    const statusMap: Record<string, StaffLiveStatus> = {};

    for (const staff of staffList) {
      const hasLiveJornada = Object.prototype.hasOwnProperty.call(liveJornadaByStaffId, staff.id);
      const hasLivePausa = Object.prototype.hasOwnProperty.call(livePausaByStaffId, staff.id);

      if (hasLiveJornada && hasLivePausa) {
        const jornadas = liveJornadaByStaffId[staff.id] ?? [];
        const pausas = livePausaByStaffId[staff.id] ?? [];
        statusMap[staff.id] = getLiveStatusFromSchedules(jornadas, pausas);
        continue;
      }

      const cachedStatus = cachedLiveStatusByStaffId[staff.id];
      if (cachedStatus) {
        statusMap[staff.id] = cachedStatus;
        continue;
      }

      // Fallback while live schedule data is loading.
      statusMap[staff.id] = staff.estado === "Active" ? "Activo" : "Inactivo";
    }

    return statusMap;
  }, [staffList, liveJornadaByStaffId, livePausaByStaffId, cachedLiveStatusByStaffId]);

  useEffect(() => {
    if (Object.keys(liveStatusByStaffId).length === 0) return;
    setCachedData("live_status_by_staff_id", liveStatusByStaffId, { ttl: 10 * 60 * 1000 });
  }, [liveStatusByStaffId]);

  const staffByLiveStatus = useMemo(() => {
    const active: StaffApi[] = [];
    const breakTime: StaffApi[] = [];
    const inactive: StaffApi[] = [];

    staffList.forEach((staff) => {
      const status = liveStatusByStaffId[staff.id] ?? "Inactivo";
      if (status === "Activo") {
        active.push(staff);
        return;
      }

      if (status === "Descanso") {
        breakTime.push(staff);
        return;
      }

      inactive.push(staff);
    });

    return { active, breakTime, inactive };
  }, [staffList, liveStatusByStaffId]);

  const selectedStaffStatusLabel: StaffLiveStatus = selectedStaff
    ? (liveStatusByStaffId[selectedStaff.id] ?? getLiveStatusFromSchedules(selectedStaffJornada, selectedStaffPausas))
    : "Inactivo";
  const selectedStaffStatusClass =
    selectedStaffStatusLabel === "Activo"
      ? "text-green-600"
      : selectedStaffStatusLabel === "Descanso"
        ? "text-amber-700"
        : "text-slate-500";

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
    const maxAllowedYear = new Date().getFullYear() - 18;
    return Array.from({ length: 90 }, (_, index) => String(maxAllowedYear - index));
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

  async function refreshNextStaffNumber() {
    try {
      const response = await fetchApiJson<{ numeroStaff: number }>("/api/staff/next-number", {
        cache: "no-store",
      });

      if (Number.isFinite(response.numeroStaff) && response.numeroStaff > 0) {
        setNewStaff((prev) => ({ ...prev, staffNumber: String(response.numeroStaff) }));
      }
    } catch {
      // Fallback already prefilled from local staff list.
    }
  }

  function resetNewStaffForm(initialStaffNumber: number) {
    setNewStaff({
      staffNumber: String(initialStaffNumber),
      citizenshipId: "",
      firstName: "",
      lastName: "",
      major: "",
      phone: "",
      contractPlan: "Plan 1",
      birthDate: "",
      password: "",
      passwordConfirm: "",
      habilidadIds: [],
      role: "",
      roleId: 3,
    });
    setNewBirthDateParts({ year: "", month: "", day: "" });
    setUnavailableClassSlots([]);
  }

  function openAddStaffForm() {
    if (!canManageStaff) {
      setFormFeedback("Solo el perfil Administrador puede agregar personal.");
      return;
    }

    const initialNumber = getFirstAvailableStaffNumber(staffList);
    resetNewStaffForm(initialNumber);
    setShowAddStaffForm(true);
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
    void refreshNextStaffNumber();
  }

  function closeAddStaffForm() {
    setShowAddStaffForm(false);
    resetNewStaffForm(getFirstAvailableStaffNumber(staffList));
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
  }

  const loadSkills = async () => {
    if (isCollaborador) {
      setSkillsCatalog([]);
      return;
    }

    try {
      setIsLoadingSkills(true);
      const tasksResponse = await fetchApiJson<{ skills?: Skill[] }>("/api/tasks/skills", {
        cache: "no-store",
      });
      setSkillsCatalog(Array.isArray(tasksResponse.skills) ? tasksResponse.skills : []);
    } catch {
      setSkillsCatalog([]);
    } finally {
      setIsLoadingSkills(false);
    }
  }

  const loadStaff = async () => {
    try {
      // Try to restore from cache first
      const cachedStaffRaw = getCachedData<StaffApi[]>("staff_list");
      const cachedStaff = Array.isArray(cachedStaffRaw)
        ? (isCollaborador && collaboratorStaffId
          ? cachedStaffRaw.filter((staff) => staff.id === collaboratorStaffId)
          : cachedStaffRaw)
        : null;
      const hasCachedStaff = Array.isArray(cachedStaff) && cachedStaff.length > 0;

      if (cachedStaff && cachedStaff.length > 0) {
        setStaffList(cachedStaff);
      }

      // Load fresh data in the background
      setIsLoadingStaff(!hasCachedStaff);
      setStaffError(null);

      const response = await fetchApiJson<{ staff?: StaffApi[] }>("/api/staff", {
        cache: "no-store",
      });

      const nextStaffRaw = Array.isArray(response.staff) ? response.staff : [];
      const nextStaff = isCollaborador && collaboratorStaffId
        ? nextStaffRaw.filter((staff) => staff.id === collaboratorStaffId)
        : nextStaffRaw;
      setStaffList(nextStaff);
      setCachedData("staff_list", nextStaff);

      if (nextStaff.length === 0) {
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
    void loadSkills();
  }, []);

  async function handleAddStaffSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageStaff) {
      alert("Solo el perfil Administrador puede agregar personal.");
      return;
    }

    try {
      setIsSavingNewStaff(true);
      const parsedNumber = Number(newStaff.staffNumber);
      const parsedBalance = Number.isFinite(balanceHours) ? balanceHours : 0;
      const resolvedBirthDate = buildBirthDate(newBirthDateParts);
      const requiresCredential = roleRequiresCredential(newStaff.roleId);

      // Validar campos requeridos
      if (!newStaff.firstName || !newStaff.lastName) {
        alert("Por favor completa los campos de nombre y apellido.");
        return;
      }

      if (!resolvedBirthDate) {
        alert("Por favor selecciona una fecha de nacimiento valida (ano, mes y dia).");
        return;
      }

      if (!isAdultBirthDate(resolvedBirthDate)) {
        alert("Solo se pueden registrar personas mayores de edad (18+).");
        return;
      }

      if (requiresCredential && newStaff.password.trim().length < 8) {
        alert("Administrador y Monitor requieren una contraseña de al menos 8 caracteres.");
        return;
      }

      if (requiresCredential && newStaff.password !== newStaff.passwordConfirm) {
        alert("La contraseña y su confirmación no coinciden.");
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
          numeroStaff: Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : undefined,
          roleId: newStaff.roleId,
          rol: newStaff.role,
          nombres: newStaff.firstName,
          apellidos: newStaff.lastName,
          cedula: newStaff.citizenshipId,
          telefono: newStaff.phone,
          fechaNacimiento: resolvedBirthDate,
          carrera: newStaff.major || "Sin carrera",
          tipoContrato: newStaff.contractPlan,
          conocimientoSonido: false,
          estado: "Active",
          balanceHoras: parsedBalance,
          password: requiresCredential ? newStaff.password.trim() : undefined,
          habilidadIds: newStaff.habilidadIds,
          bloqueosClase,
        }),
      });

      alert(`Colaborador ${newStaff.firstName} ${newStaff.lastName} creado correctamente.`);
      closeAddStaffForm();
      setFormFeedback(null);
      await loadStaff();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo guardar el staff.";
      alert(getFriendlyStaffApiError(errorMessage, "guardar"));
      setFormFeedback(null);
    } finally {
      setIsSavingNewStaff(false);
    }
  }

  function openEditStaffForm() {
    if (!canManageStaff) {
      setFormFeedback("Solo el perfil Administrador puede editar perfiles.");
      return;
    }

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
      password: "",
      passwordConfirm: "",
      habilidadIds: selectedStaffSkills.map((skill) => skill.id),
      role: selectedStaff.rol,
      roleId: selectedStaff.roleId ?? 3,
      estado: selectedStaff.estado,
      balanceHoras: selectedStaff.balanceHoras,
    });
    setEditBirthDateParts(parseBirthDate(selectedStaff.fechaNacimiento));
    setShowEditPassword(false);
    setShowEditPasswordConfirm(false);

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

    if (!canManageStaff) {
      alert("Solo el perfil Administrador puede editar perfiles.");
      return;
    }

    if (!selectedStaff) {
      alert("Por favor selecciona un staff para editar.");
      return;
    }

    try {
      setIsSavingEditStaff(true);

      const parsedNumber = Number(editStaff.staffNumber);
      const resolvedBirthDate = buildBirthDate(editBirthDateParts);
      const requiresCredential = roleRequiresCredential(editStaff.roleId);

      if (!resolvedBirthDate) {
        alert("Por favor selecciona una fecha de nacimiento valida (ano, mes y dia).");
        return;
      }

      if (!isAdultBirthDate(resolvedBirthDate)) {
        alert("Solo se pueden registrar personas mayores de edad (18+).");
        return;
      }

      if (requiresCredential && !selectedStaff.tieneCredencial && editStaff.password.trim().length < 8) {
        alert("Este rol requiere contraseña. Ingresa una contraseña de al menos 8 caracteres.");
        return;
      }

      if (editStaff.password.trim().length > 0 && editStaff.password.trim().length < 8) {
        alert("Si deseas cambiar la contraseña, debe tener al menos 8 caracteres.");
        return;
      }

      if (editStaff.password.trim().length > 0 && editStaff.password !== editStaff.passwordConfirm) {
        alert("La contraseña y su confirmación no coinciden.");
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
          conocimientoSonido: false,
          estado: editStaff.estado,
          balanceHoras: editStaff.balanceHoras,
          password: editStaff.password.trim() ? editStaff.password.trim() : undefined,
          habilidadIds: editStaff.habilidadIds,
          bloqueosClase,
        }),
      });

      alert(`Perfil de ${editStaff.firstName} ${editStaff.lastName} actualizado correctamente.`);
      setShowEditStaffForm(false);
      setFormFeedback(null);
      await loadStaff();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo actualizar el staff.";
      alert(getFriendlyStaffApiError(errorMessage, "actualizar"));
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
    if (!canManageStaff) {
      alert("Solo el perfil Administrador puede eliminar personal.");
      return;
    }

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

      alert(`Se eliminó correctamente a ${selectedStaff.nombres} ${selectedStaff.apellidos}.`);
      setSelectedStaffId(null);
      await loadStaff();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo eliminar el staff.";
      alert(getFriendlyStaffApiError(errorMessage, "eliminar"));
    }
  }

  return (
    <div className="px-3 py-3 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
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
                <p className="text-xs text-[#566166]">Registro conectado al backend con número autogenerado</p>
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
                <label className="text-xs font-bold text-slate-500">Rol</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, role: event.target.value }))}
                  placeholder="Ej: Colaborador"
                  required
                  type="text"
                  value={newStaff.role}
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
                <label className="text-xs font-bold text-slate-500">Nombres</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, firstName: event.target.value }))}
                  placeholder="Ej: Erik"
                  required
                  type="text"
                  value={newStaff.firstName}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Apellidos</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Ej: Valencia Cardona"
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

              <div className="space-y-1 md:col-span-2 lg:col-span-2">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_1fr_1fr]">
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

                  <div className="space-y-1">
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

                  <div className="space-y-1">
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
                </div>
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

              {roleRequiresCredential(newStaff.roleId) ? (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">Contraseña de acceso</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm"
                      onChange={(event) => setNewStaff((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Mínimo 8 caracteres"
                      required
                      type={showNewPassword ? "text" : "password"}
                      value={newStaff.password}
                    />
                    <button
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-[#566166]"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      type="button"
                    >
                      {showNewPassword ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                  <label className="text-xs font-bold text-slate-500">Repetir contraseña</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm"
                      onChange={(event) => setNewStaff((prev) => ({ ...prev, passwordConfirm: event.target.value }))}
                      placeholder="Repite la contraseña"
                      required
                      type={showNewPasswordConfirm ? "text" : "password"}
                      value={newStaff.passwordConfirm}
                    />
                    <button
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-[#566166]"
                      onClick={() => setShowNewPasswordConfirm((prev) => !prev)}
                      type="button"
                    >
                      {showNewPasswordConfirm ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#566166]">Obligatoria para Administrador y Monitor.</p>
                </div>
              ) : null}

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">Habilidades</label>
                  {isLoadingSkills ? <span className="text-[10px] text-[#566166]">Cargando...</span> : null}
                </div>

                {skillsCatalog.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-[#566166]">
                    No hay habilidades cargadas en el sistema.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {skillsCatalog.map((skill) => {
                      const isSelected = newStaff.habilidadIds.includes(skill.id);
                      return (
                        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#2a3439]" key={skill.id}>
                          <input
                            checked={isSelected}
                            className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]"
                            onChange={(event) =>
                              setNewStaff((prev) => ({
                                ...prev,
                                habilidadIds: event.target.checked
                                  ? [...prev.habilidadIds, skill.id]
                                  : prev.habilidadIds.filter((id) => id !== skill.id),
                              }))
                            }
                            type="checkbox"
                          />
                          {skill.nombre}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

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

              <div className="space-y-1 md:col-span-2 lg:col-span-2">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_1fr_1fr]">
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

                  <div className="space-y-1">
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

                  <div className="space-y-1">
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
                </div>
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

              {roleRequiresCredential(editStaff.roleId) ? (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">
                    Contraseña {selectedStaff?.tieneCredencial ? "(opcional para actualizar)" : "(requerida)"}
                  </label>
                  <div className="relative">
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm"
                      onChange={(event) => setEditStaff((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder={selectedStaff?.tieneCredencial ? "Déjala vacía para mantener la actual" : "Mínimo 8 caracteres"}
                      required={!selectedStaff?.tieneCredencial}
                      type={showEditPassword ? "text" : "password"}
                      value={editStaff.password}
                    />
                    <button
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-[#566166]"
                      onClick={() => setShowEditPassword((prev) => !prev)}
                      type="button"
                    >
                      {showEditPassword ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                  <label className="text-xs font-bold text-slate-500">Repetir contraseña</label>
                  <div className="relative">
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-20 text-sm"
                      onChange={(event) => setEditStaff((prev) => ({ ...prev, passwordConfirm: event.target.value }))}
                      placeholder="Repite la contraseña"
                      required={!selectedStaff?.tieneCredencial || editStaff.password.trim().length > 0}
                      type={showEditPasswordConfirm ? "text" : "password"}
                      value={editStaff.passwordConfirm}
                    />
                    <button
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-[#566166]"
                      onClick={() => setShowEditPasswordConfirm((prev) => !prev)}
                      type="button"
                    >
                      {showEditPasswordConfirm ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">Habilidades</label>
                  {isLoadingSkills ? <span className="text-[10px] text-[#566166]">Cargando...</span> : null}
                </div>

                {skillsCatalog.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-[#566166]">
                    No hay habilidades cargadas en el sistema.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {skillsCatalog.map((skill) => {
                      const isSelected = editStaff.habilidadIds.includes(skill.id);
                      return (
                        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#2a3439]" key={skill.id}>
                          <input
                            checked={isSelected}
                            className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]"
                            onChange={(event) =>
                              setEditStaff((prev) => ({
                                ...prev,
                                habilidadIds: event.target.checked
                                  ? [...prev.habilidadIds, skill.id]
                                  : prev.habilidadIds.filter((id) => id !== skill.id),
                              }))
                            }
                            type="checkbox"
                          />
                          {skill.nombre}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

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

      <div className="mb-6 overflow-x-auto">
        <div className="inline-flex min-w-max items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
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
      </div>

      {view === "schedule" ? (
        <StaffScheduleBoard
          canManageStaff={canManageStaff}
          isCollaborador={isCollaborador}
          isLoadingStaff={isLoadingStaff}
          staffList={staffList}
        />
      ) : (
        <main className="flex min-h-[calc(100vh-7rem)] flex-col gap-4 overflow-visible xl:flex-row xl:gap-6 xl:overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="tracking-tight text-2xl font-extrabold text-[#2a3439]">
                {isCollaborador ? "Mi perfil" : "Directorio del personal"}
              </h2>
              {isCollaborador ? (
                <p className="text-sm text-[#566166]">Visualización de perfil personal.</p>
              ) : (
                <p className="text-sm text-[#566166]">
                  Gestionando {staffList.length} integrantes académicos: {staffByLiveStatus.active.length} activos, {staffByLiveStatus.breakTime.length} en descanso y {staffByLiveStatus.inactive.length} inactivos
                </p>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              {!isCollaborador ? (
                <button className="flex items-center justify-center gap-2 rounded-lg bg-[#d9e4ea] px-4 py-2 text-xs font-bold text-[#2a3439]">
                  <span className="material-symbols-outlined text-sm">filter_list</span>
                  Filtrar
                </button>
              ) : null}
              {canManageStaff ? (
                <button
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white shadow-sm"
                  onClick={openAddStaffForm}
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  Agregar personal
                </button>
              ) : null}
            </div>
          </div>

          {staffError ? <p className="text-sm font-medium text-[#9f403d]">{staffError}</p> : null}

          <div className="space-y-4 overflow-y-auto pr-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {staffList.length > 0 ? (
              [
                ...(isCollaborador
                  ? [{ title: "Mi perfil", status: "Activo" as StaffLiveStatus, items: staffList }]
                  : [
                    { title: "Activos", status: "Activo" as StaffLiveStatus, items: staffByLiveStatus.active },
                    { title: "Descanso", status: "Descanso" as StaffLiveStatus, items: staffByLiveStatus.breakTime },
                    { title: "Inactivos", status: "Inactivo" as StaffLiveStatus, items: staffByLiveStatus.inactive },
                  ]),
              ].map((section) => (
                <section key={section.title} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-black tracking-wider text-[#2a3439] uppercase">{section.title}</h3>
                    <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{section.items.length}</span>
                  </div>

                  {section.items.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {section.items.map((staff) => {
                        const isActiveCard = selectedStaff?.id === staff.id;
                        const liveStatus = liveStatusByStaffId[staff.id] ?? "Inactivo";
                        const liveStatusClasses =
                          liveStatus === "Activo"
                            ? "bg-green-50 text-green-600"
                            : liveStatus === "Descanso"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-50 text-slate-400";

                        return (
                          <button
                            className={`flex items-center gap-3 rounded-xl bg-white p-3 text-left transition-all sm:p-4 ${
                              isActiveCard
                                ? "border-2 border-[#3a5f94] shadow-xl ring-4 ring-[#3a5f94]/5"
                                : "border border-slate-200 shadow-sm hover:shadow-md"
                            }`}
                            key={staff.id}
                            onClick={() => {
                              setSelectedStaffId(staff.id);
                              if (!isCollaborador) {
                                setMobileDetailTab("profile");
                                setIsStaffDetailModalOpen(true);
                              }
                            }}
                            type="button"
                          >
                            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#e8eff3] text-xs font-black text-[#375c91] sm:h-14 sm:w-14 sm:text-sm">
                              <img
                                src={getStaffPhotoUrl(staff.cedula)}
                                alt={`${staff.nombres} ${staff.apellidos}`}
                                className="absolute inset-0 h-full w-full object-cover"
                                onError={(event) => {
                                  const image = event.currentTarget;
                                  image.style.display = "none";
                                  const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                                  if (fallback) {
                                    fallback.style.display = "flex";
                                  }
                                }}
                                onLoad={(event) => {
                                  const image = event.currentTarget;
                                  const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                                  if (fallback) {
                                    fallback.style.display = "none";
                                  }
                                }}
                              />
                              <div
                                data-staff-photo-fallback="true"
                                className="absolute inset-0 hidden items-center justify-center bg-[#e8eff3] text-xs font-black text-[#375c91] sm:text-sm"
                              >
                                N.{staff.numeroStaff}
                              </div>
                            </div>
                            <div className="flex-1">
                              <h3 className="leading-tight font-bold text-[#2a3439]">{staff.nombres}</h3>
                              <p className="text-xs text-[#566166]">ID: {staff.cedula}</p>
                              <p className="mt-1 text-xs font-semibold text-[#566166]">{staff.rol}</p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${liveStatusClasses}`}
                              >
                                {liveStatus}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : isCollaborador ? (
                    <p className="text-sm text-[#566166]">No se encontró información de tu perfil.</p>
                  ) : (
                    <p className="text-sm text-[#566166]">
                      {section.status === "Activo"
                        ? "No hay personal activo actualmente."
                        : section.status === "Descanso"
                          ? "No hay personal descansando actualmente."
                          : "No hay personal inactivo actualmente."}
                    </p>
                  )}
                </section>
              ))
            ) : isLoadingStaff ? (
              <p className="text-sm text-[#566166]">Cargando personal...</p>
            ) : (
              <p className="text-sm text-[#566166]">Aún no hay personal registrado.</p>
            )}
          </div>

          {selectedStaff && !isCollaborador ? (
          <>
          <div className="hidden grid-cols-1 gap-4 xl:grid xl:grid-cols-[1.55fr_1fr] xl:gap-6">
            <section className="rounded-2xl bg-[#e8eff3] p-4 sm:p-5">
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

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                Horario diario del personal
              </h4>
              <div className="mb-2 text-[10px] font-semibold text-slate-400">{dailyScheduleDay}</div>
              {isLoadingDailySchedule ? (
                <p className="text-xs text-[#566166]">Cargando horario...</p>
              ) : dailyScheduleItems.length === 0 ? (
                <p className="text-xs text-[#566166]">Sin bloques configurados para este día.</p>
              ) : (
                <div className="space-y-2">
                  {dailyScheduleItems.map((item) => (
                    <div
                      className={item.isPause
                        ? `flex items-center justify-between rounded px-2 py-2 border-b border-slate-50 ${item.isCurrent ? "bg-amber-100 ring-1 ring-amber-300" : "bg-amber-50"}`
                        : `flex items-center justify-between border-b border-slate-50 py-2 ${item.isCurrent ? "rounded bg-blue-50 ring-1 ring-blue-200 px-2" : ""}`}
                      key={item.id}
                    >
                      <span className={item.isPause ? "text-xs font-bold text-amber-700" : "text-xs font-bold text-[#2a3439]"}>
                        {item.label}{item.isCurrent ? " (Ahora)" : ""}
                      </span>
                      <span className={item.isPause ? "text-xs text-amber-700" : "text-xs text-[#566166]"}>{item.range}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="hidden grid-cols-1 gap-4 xl:grid xl:grid-cols-[1.55fr_1fr] xl:gap-6">
            <section className="min-h-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:min-h-[370px] lg:p-6">
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                No disponibilidad académica
              </h4>
              <div className="overflow-x-auto">
                <div className="min-w-[640px] space-y-1">
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
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
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
          </>
          ) : selectedStaff && isCollaborador ? (
            <div className="space-y-4 xl:space-y-6">
              <section className="rounded-2xl bg-[#e8eff3] p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-black text-[#153f73]">
                    <span className="material-symbols-outlined">assignment</span>
                    Tareas asignadas
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

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
                <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                  Horario diario del personal
                </h4>
                <div className="mb-2 text-[10px] font-semibold text-slate-400">{dailyScheduleDay}</div>
                {isLoadingDailySchedule ? (
                  <p className="text-xs text-[#566166]">Cargando horario...</p>
                ) : dailyScheduleItems.length === 0 ? (
                  <p className="text-xs text-[#566166]">Sin bloques configurados para este día.</p>
                ) : (
                  <div className="space-y-2">
                    {dailyScheduleItems.map((item) => (
                      <div
                        className={item.isPause
                          ? `flex items-center justify-between rounded px-2 py-2 border-b border-slate-50 ${item.isCurrent ? "bg-amber-100 ring-1 ring-amber-300" : "bg-amber-50"}`
                          : `flex items-center justify-between border-b border-slate-50 py-2 ${item.isCurrent ? "rounded bg-blue-50 ring-1 ring-blue-200 px-2" : ""}`}
                        key={`collaborator-main-${item.id}`}
                      >
                        <span className={item.isPause ? "text-xs font-bold text-amber-700" : "text-xs font-bold text-[#2a3439]"}>
                          {item.label}{item.isCurrent ? " (Ahora)" : ""}
                        </span>
                        <span className={item.isPause ? "text-xs text-amber-700" : "text-xs text-[#566166]"}>{item.range}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr] xl:gap-6">
                <section className="min-h-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:min-h-[370px] lg:p-6">
                  <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                    No disponibilidad académica
                  </h4>
                  <div className="overflow-x-auto">
                    <div className="min-w-[640px] space-y-1">
                      <div className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1">
                        <div />
                        {ACADEMIC_DAY_COLUMNS.map((column) => (
                          <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase" key={`collaborator-main-${column.dayName}`}>
                            {column.label}
                          </div>
                        ))}
                      </div>

                      {ACADEMIC_TIME_SEGMENTS.map((segment, segmentIndex) => (
                        <div className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1" key={`collaborator-main-${segment.key}`}>
                          <div className="flex items-center justify-end gap-1 pr-1 text-[9px] whitespace-nowrap">
                            <span className="font-bold text-[#566166]">{ACADEMIC_SEGMENT_ROWS[segmentIndex].label}</span>
                            <span className="text-slate-400">{ACADEMIC_SEGMENT_ROWS[segmentIndex].range}</span>
                          </div>

                          {ACADEMIC_DAY_COLUMNS.map((column, dayIndex) => {
                            const isBlocked = academicUnavailabilityMatrix[dayIndex]?.[segmentIndex] ?? false;

                            return (
                              <div
                                className={`h-8 rounded-sm ${isBlocked ? "bg-[#3a5f94]" : "bg-[#f0f4f7]"}`}
                                key={`collaborator-main-${column.key}-${segment.key}`}
                                title={`${column.dayName}: ${isBlocked ? "No disponible" : "Disponible"} (${ACADEMIC_SEGMENT_ROWS[segmentIndex].range})`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-center gap-4 text-[10px] text-[#566166]">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#3a5f94]" /> No disponible
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full border border-slate-300 bg-[#f0f4f7]" /> Disponible
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
                        <p className="text-xs text-[#2a3439]" key={`collaborator-main-${slot.dayKey}-${slot.start}-${index}`}>
                          {slot.dayName}: {slot.start} - {slot.end}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
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
          ) : !isCollaborador ? (
            <div className="hidden xl:flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-[#566166]">
              Selecciona un miembro del personal para ver su información detallada.
            </div>
          ) : null}
        </div>

        {selectedStaff ? (
        <div className={`${isCollaborador ? "flex" : "hidden xl:flex"} h-auto w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl xl:h-full xl:w-[320px]`}>
          <div className="flex flex-col items-center gap-2.5 border-b border-slate-200 bg-[#f0f4f7] p-4 sm:p-5 lg:p-6">
            <div className="relative">
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#d5e3ff] text-xl font-black text-[#153f73] shadow-lg sm:h-24 sm:w-24 sm:text-2xl">
                <img
                  src={getStaffPhotoUrl(selectedStaff.cedula)}
                  alt={`${selectedStaff.nombres} ${selectedStaff.apellidos}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(event) => {
                    const image = event.currentTarget;
                    image.style.display = "none";
                    const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                    if (fallback) {
                      fallback.style.display = "flex";
                    }
                  }}
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                    if (fallback) {
                      fallback.style.display = "none";
                    }
                  }}
                />
                <div
                  data-staff-photo-fallback="true"
                  className="absolute inset-0 hidden items-center justify-center bg-[#d5e3ff] text-xl font-black text-[#153f73] sm:text-2xl"
                >
                  N.{selectedStaff?.numeroStaff ?? 1}
                </div>
              </div>
              <span className="absolute right-0 bottom-0 h-6 w-6 rounded-full border-4 border-white bg-green-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-[#2a3439]">{selectedStaff?.nombres ?? "Sin staff"}</h2>
              <p className="text-sm font-medium text-[#566166]">
                {selectedStaff?.apellidos ?? "Sin staff seleccionado"}
              </p>
            </div>
            <div className="mt-3 grid w-full grid-cols-2 gap-2.5 sm:mt-4 sm:gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-black text-slate-400 uppercase">Estado</p>
                <p className={`text-lg font-black ${selectedStaffStatusClass}`}>
                  {selectedStaffStatusLabel}
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

          <div className="space-y-6 overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:p-5 lg:space-y-8 lg:p-6">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Habilidades</label>
                  {selectedStaffSkills.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedStaffSkills.map((skill) => (
                        <span
                          key={`profile-skill-${skill.id}`}
                          className="rounded-full border border-[#3a5f94]/20 bg-[#3a5f94]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2f4f7d]"
                        >
                          {skill.nombre}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#566166]">Sin habilidades asignadas.</p>
                  )}
                </div>
              </div>
            </section>

          </div>

          {canManageStaff ? (
            <div className="flex gap-2.5 bg-slate-50 p-4 sm:p-5 lg:gap-3 lg:p-6">
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
          ) : null}
        </div>
        ) : (
          <div className={`${isCollaborador ? "flex" : "hidden xl:flex"} w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-[#566166] xl:w-[320px]`}>
            Sin personal seleccionado.
          </div>
        )}

        {!isCollaborador && isStaffDetailModalOpen && selectedStaff ? (
          <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 xl:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Cerrar detalle del personal"
              className="absolute inset-0"
              onClick={() => setIsStaffDetailModalOpen(false)}
            />
            <div className="relative z-10 flex h-[88vh] w-full flex-col rounded-t-2xl bg-white p-4 shadow-2xl">
              <div className="mb-4 flex shrink-0 items-center justify-between">
                <h3 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Detalle del personal</h3>
                <button
                  type="button"
                  onClick={() => setIsStaffDetailModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-[#566166]"
                >
                  Cerrar
                </button>
              </div>

              <div className="mb-4 shrink-0 overflow-x-auto">
                <div className="flex min-w-max items-center gap-1 rounded-lg bg-[#f0f4f7] p-1">
                  {[
                    { key: "profile", label: "Perfil" },
                    { key: "tasks", label: "Tareas" },
                    { key: "daily", label: "Horario" },
                    { key: "academic", label: "No disp." },
                    { key: "activity", label: "Actividad" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMobileDetailTab(tab.key as StaffMobileDetailTab)}
                      className={`rounded-md px-3 py-1.5 text-[11px] font-bold transition ${
                        mobileDetailTab === tab.key ? "bg-white text-[#3a5f94] shadow-sm" : "text-[#566166]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <div className="flex flex-col items-center gap-2.5 border-b border-slate-200 bg-[#f0f4f7] p-4">
                    <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#d5e3ff] text-xl font-black text-[#153f73] shadow-lg">
                      <img
                        src={getStaffPhotoUrl(selectedStaff.cedula)}
                        alt={`${selectedStaff.nombres} ${selectedStaff.apellidos}`}
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(event) => {
                          const image = event.currentTarget;
                          image.style.display = "none";
                          const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                          if (fallback) {
                            fallback.style.display = "flex";
                          }
                        }}
                        onLoad={(event) => {
                          const image = event.currentTarget;
                          const fallback = image.parentElement?.querySelector<HTMLElement>("[data-staff-photo-fallback='true']");
                          if (fallback) {
                            fallback.style.display = "none";
                          }
                        }}
                      />
                      <div
                        data-staff-photo-fallback="true"
                        className="absolute inset-0 hidden items-center justify-center bg-[#d5e3ff] text-xl font-black text-[#153f73]"
                      >
                        N.{selectedStaff.numeroStaff}
                      </div>
                    </div>
                    <div className="text-center">
                      <h2 className="text-xl font-black text-[#2a3439]">{selectedStaff.nombres}</h2>
                      <p className="text-sm font-medium text-[#566166]">{selectedStaff.apellidos}</p>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    {mobileDetailTab === "profile" ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Estado</p>
                            <p className={`text-base font-black ${selectedStaffStatusClass}`}>
                              {selectedStaffStatusLabel}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Horas</p>
                            <p className={`text-base font-black ${selectedStaffBalanceHours >= 0 ? "text-green-600" : "text-[#9f403d]"}`}>
                              {selectedStaffFormattedBalanceHours}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Información general</p>
                          <p className="text-sm text-[#2a3439]"><span className="font-semibold">Cédula:</span> {selectedStaff.cedula}</p>
                          <p className="text-sm text-[#2a3439]"><span className="font-semibold">Teléfono:</span> {selectedStaff.telefono}</p>
                          <p className="text-sm text-[#2a3439]"><span className="font-semibold">Rol:</span> {selectedStaff.rol}</p>
                          <p className="text-sm text-[#2a3439]"><span className="font-semibold">Acceso:</span> {accessRoleLabelById[(selectedStaff.roleId as StaffAccessRoleId) ?? 3]}</p>
                          <p className="text-sm text-[#2a3439]"><span className="font-semibold">Contrato:</span> {selectedStaff.tipoContrato}</p>
                          <p className="text-sm text-[#2a3439]"><span className="font-semibold">Carrera:</span> {selectedStaff.carrera}</p>
                          <div className="space-y-1 pt-1">
                            <p className="text-sm text-[#2a3439]"><span className="font-semibold">Habilidades:</span></p>
                            {selectedStaffSkills.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {selectedStaffSkills.map((skill) => (
                                  <span
                                    key={`mobile-profile-skill-${skill.id}`}
                                    className="rounded-full border border-[#3a5f94]/20 bg-[#3a5f94]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2f4f7d]"
                                  >
                                    {skill.nombre}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[#566166]">Sin habilidades asignadas.</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : null}

                    {mobileDetailTab === "tasks" ? (
                      <section className="rounded-2xl bg-[#e8eff3] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-black text-[#153f73]">
                            <span className="material-symbols-outlined">assignment</span>
                            Tareas asignadas: {selectedStaff.nombres}
                          </h3>
                          <span className="text-[11px] font-bold text-[#566166]">2 pendientes</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
                            <input checked className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]" type="checkbox" readOnly />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-[#566166] line-through">Pasillo 3 limpio (ala norte)</p>
                              <p className="text-[10px] text-slate-400">Completado a las 08:30</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border-l-4 border-amber-400 bg-white p-3 shadow-sm">
                            <input className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]" type="checkbox" />
                            <div className="flex-1">
                              <p className="text-xs font-bold text-[#2a3439]">Preparar salón 101 (rack AV)</p>
                              <p className="text-[10px] text-[#566166]">Prioridad: alta • Vence a las 11:00</p>
                            </div>
                          </div>
                        </div>
                      </section>
                    ) : null}

                    {mobileDetailTab === "daily" ? (
                      <section className="rounded-2xl border border-slate-200 bg-white p-4">
                        <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                          Horario diario del personal
                        </h4>
                        <div className="mb-2 text-[10px] font-semibold text-slate-400">{dailyScheduleDay}</div>
                        {isLoadingDailySchedule ? (
                          <p className="text-xs text-[#566166]">Cargando horario...</p>
                        ) : dailyScheduleItems.length === 0 ? (
                          <p className="text-xs text-[#566166]">Sin bloques configurados para este día.</p>
                        ) : (
                          <div className="space-y-2">
                            {dailyScheduleItems.map((item) => (
                              <div
                                className={item.isPause
                                  ? `flex items-center justify-between rounded px-2 py-2 border-b border-slate-50 ${item.isCurrent ? "bg-amber-100 ring-1 ring-amber-300" : "bg-amber-50"}`
                                  : `flex items-center justify-between border-b border-slate-50 py-2 ${item.isCurrent ? "rounded bg-blue-50 ring-1 ring-blue-200 px-2" : ""}`}
                                key={`mobile-${item.id}`}
                              >
                                <span className={item.isPause ? "text-xs font-bold text-amber-700" : "text-xs font-bold text-[#2a3439]"}>
                                  {item.label}{item.isCurrent ? " (Ahora)" : ""}
                                </span>
                                <span className={item.isPause ? "text-xs text-amber-700" : "text-xs text-[#566166]"}>{item.range}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    ) : null}

                    {mobileDetailTab === "academic" ? (
                      <section className="rounded-2xl border border-slate-200 bg-white p-4">
                        <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                          No disponibilidad académica
                        </h4>
                        <div className="overflow-x-auto">
                          <div className="min-w-[640px] space-y-1">
                            <div className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1">
                              <div />
                              {ACADEMIC_DAY_COLUMNS.map((column) => (
                                <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase" key={`modal-${column.dayName}`}>
                                  {column.label}
                                </div>
                              ))}
                            </div>

                            {ACADEMIC_TIME_SEGMENTS.map((segment, segmentIndex) => (
                              <div className="grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1" key={`modal-${segment.key}`}>
                                <div className="flex items-center justify-end gap-1 pr-1 text-[9px] whitespace-nowrap">
                                  <span className="font-bold text-[#566166]">{ACADEMIC_SEGMENT_ROWS[segmentIndex].label}</span>
                                  <span className="text-slate-400">{ACADEMIC_SEGMENT_ROWS[segmentIndex].range}</span>
                                </div>

                                {ACADEMIC_DAY_COLUMNS.map((column, dayIndex) => {
                                  const isBlocked = academicUnavailabilityMatrix[dayIndex]?.[segmentIndex] ?? false;

                                  return (
                                    <div
                                      className={`h-8 rounded-sm ${isBlocked ? "bg-[#3a5f94]" : "bg-[#f0f4f7]"}`}
                                      key={`modal-${column.key}-${segment.key}`}
                                    />
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                        {academicBlockedSlotDetails.length > 0 ? (
                          <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Detalle de Bloques</p>
                            {academicBlockedSlotDetails.map((slot, index) => (
                              <p className="text-xs text-[#2a3439]" key={`modal-${slot.dayKey}-${slot.start}-${index}`}>
                                {slot.dayName}: {slot.start} - {slot.end}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {mobileDetailTab === "activity" ? (
                      <section className="rounded-2xl border border-slate-200 bg-white p-4">
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
                    ) : null}

                    {mobileDetailTab === "profile" && canManageStaff ? (
                      <div className="flex gap-2.5 pt-2">
                        <button
                          className="flex-1 rounded-xl bg-[#3a5f94] py-3 text-xs font-bold text-white shadow-lg shadow-[#3a5f94]/20 disabled:opacity-60"
                          disabled={!selectedStaff}
                          onClick={() => {
                            setIsStaffDetailModalOpen(false);
                            openEditStaffForm();
                          }}
                          type="button"
                        >
                          Editar perfil
                        </button>
                        <button
                          className="rounded-xl bg-[#9f403d] p-3 text-white transition-colors hover:bg-[#8a3631] disabled:opacity-60"
                          disabled={!selectedStaff}
                          onClick={() => {
                            setIsStaffDetailModalOpen(false);
                            void handleDeleteStaff();
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      )}
    </div>
  );
}
