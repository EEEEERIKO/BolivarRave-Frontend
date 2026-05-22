"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { fetchApiJson } from "@/lib/api-client";
import { readAuthSession } from "@/lib/auth-session";
import { confirmToast } from "@/lib/toast-dialog";

type TaskType = "Recurrente" | "Esporadica";
type AssignmentMode = "manual" | "automatica";
type RecurrentScheduleMode = "programada" | "diaria_libre";
type TaskPriority = "Baja" | "Media" | "Alta" | "Urgente";
type TaskState = "Pendiente" | "En Progreso" | "En Revision" | "Completada" | "Rechazada" | "Corregir" | "Cancelada";

type TaskCatalogItem = {
  id: string;
  nombre: string;
  tipo: TaskType;
  sector: string;
  modoAsignacion: AssignmentMode;
  cantidadPersonal: number;
  habilidadesRequeridasIds: string[];
  requerimientos: string[];
  staffAsignadosIds: string[];
  diasSemana: number[];
  horaProgramada: string | null;
  fechaEsporadica: string | null;
  horaEsporadica: string | null;
  requiereFinalizacion: boolean;
  tareaFinalizacion: string | null;
  fechaFinalizacion: string | null;
  horaFinalizacion: string | null;
  tiempoEstimadoMin: number;
};

type ScheduleTaskItem = TaskCatalogItem;

type SkillItem = {
  id: string;
  nombre: string;
};

type StaffSkillLink = {
  id: string;
  staffId: string;
  habilidadId: string;
  staffNombre: string | null;
  habilidadNombre: string | null;
};

type TaskInstanceItem = {
  id: string;
  tareaCatalogoId: string;
  tareaNombre: string;
  estado: TaskState;
  prioridad: TaskPriority;
  fechaProgramada: string;
  horaProgramada: string;
  salonId: string | null;
  salonNombre: string | null;
  asignacionAutomatica: boolean;
  asignacionId: string | null;
  staffAsignadoId: string | null;
  staffAsignadoNombre: string | null;
  monitorId: string | null;
  monitorNombre: string | null;
  observacionesRevision: string | null;
};

type StaffItem = {
  id: string;
  cedula?: string | null;
  nombres: string;
  apellidos: string;
  roleId: number;
  rol: string;
  estado: string;
  balanceHoras: number;
};

type RoomItem = {
  id: string;
  nombre: string;
  piso: number | null;
};

type TaskSpaceItem = {
  id: string;
  nombre: string;
  piso: number | null;
  tipo: "predefinido" | "personalizado";
  editable: boolean;
};

type RoomsInfoResponse = {
  roomsByFloor?: RoomItem[][];
};

type TaskSpacesResponse = {
  spaces?: TaskSpaceItem[];
};

type StaffResponse = {
  staff?: StaffItem[];
};

type StaffJornadaItem = {
  id: string;
  staffId: string;
  diaSemana: string;
  horaEntrada: string;
  horaSalida: string;
  totalHorasDia: number;
};

type StaffJornadasBulkResponse = {
  jornadas?: Record<string, StaffJornadaItem[]>;
};

type TasksResponse = {
  tasks?: TaskCatalogItem[];
};

type InstancesResponse = {
  tasks?: TaskInstanceItem[];
};

type SkillsResponse = {
  skills?: SkillItem[];
};

type StaffSkillsResponse = {
  links?: StaffSkillLink[];
};

type StaffPausaItem = {
  id: string;
  staffId: string;
  diaSemana: string;
  tipoPausa: "Comida" | "Descanso";
  horaInicio: string;
  horaFin: string;
};

type StaffPausasBulkResponse = {
  pausas?: Record<string, StaffPausaItem[]>;
};

type NoticeState = {
  kind: "success" | "error";
  text: string;
} | null;

type CatalogFormState = {
  nombre: string;
  tipo: TaskType | "";
  sector: string;
  modoAsignacion: AssignmentMode | "";
  programacionRecurrente: RecurrentScheduleMode | "";
  cantidadPersonal: string;
  habilidadesRequeridasIds: string[];
  requerimientos: string[];
  staffAsignadosIds: string[];
  diasSemana: number[];
  horaProgramada: string;
  fechaEsporadica: string;
  horaEsporadica: string;
  requiereFinalizacion: boolean;
  tareaFinalizacion: string;
  fechaFinalizacion: string;
  horaFinalizacion: string;
  tiempoEstimadoMin: string;
};

type InstanceFormState = {
  tareaCatalogoId: string;
  salonId: string;
  prioridad: TaskPriority;
  fechaProgramada: string;
  horaProgramada: string;
  asignacionAutomatica: boolean;
  detalleAdicional: string;
};

type LinkSkillFormState = {
  staffId: string;
  habilidadId: string;
};

type AssignmentFormState = {
  tareaInstanciaId: string;
  staffId: string;
};

type ReviewFormState = {
  asignacionId: string;
  monitorId: string;
  decision: "aprobar" | "rechazar";
  rechazoEstado: "Corregir" | "Rechazada";
  observacionesRevision: string;
};

type ScheduleCellSelection = {
  staffId: string;
  dayIndex: number;
  slotStart: number;
  taskId?: string;
  isEditing?: boolean;
} | null;

type ScheduleTaskMode = "catalog" | "manual";

type ScheduleManualFormState = {
  nombre: string;
  sector: string;
  tiempoEstimadoMin: string;
  horaProgramada: string;
  diasSemana: number[];
  requerimientos?: string[];
};

type TasksSubtab = "gestion" | "tareas-creadas" | "tareas-asignadas" | "horario" | "habilidades" | "lugares";

const priorityStyles: Record<TaskPriority, string> = {
  Baja: "bg-slate-100 text-slate-600",
  Media: "bg-amber-100 text-amber-700",
  Alta: "bg-orange-100 text-orange-700",
  Urgente: "bg-rose-100 text-rose-700",
};

const stateStyles: Record<TaskState, string> = {
  Pendiente: "bg-slate-100 text-slate-600",
  "En Progreso": "bg-sky-100 text-sky-700",
  "En Revision": "bg-indigo-100 text-indigo-700",
  Completada: "bg-emerald-100 text-emerald-700",
  Rechazada: "bg-rose-100 text-rose-700",
  Corregir: "bg-amber-100 text-amber-700",
  Cancelada: "bg-slate-200 text-slate-600",
};

const DEFAULT_CATALOG_TASK_TYPE: TaskType = "Recurrente";
const DEFAULT_CATALOG_ASSIGNMENT_MODE: AssignmentMode = "manual";

const taskTypeLabels: Record<TaskType, string> = {
  Recurrente: "Recurrente",
  Esporadica: "Esporadica",
};

const dayLabels = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"] as const;

const assignmentModeLabels: Record<AssignmentMode, string> = {
  manual: "Manual",
  automatica: "Automatica",
};

const TASK_RECURRENT_TIME_OPTIONS = Array.from({ length: 35 }, (_, idx) => {
  const totalMinutes = 5 * 60 + idx * 30;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

const weekDayNames = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"] as const;

const WEEK_DAY_SHORT_LABELS: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

const PREVIEW_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const SHIFT_DEFINITIONS = [
  { id: "manana", label: "Mañana", start: 5 * 60, end: 12 * 60 },
  { id: "tarde", label: "Tarde", start: 12 * 60, end: 17 * 60 + 30 },
  { id: "noche", label: "Noche", start: 17 * 60 + 30, end: 22 * 60 },
] as const;

type ShiftId = (typeof SHIFT_DEFINITIONS)[number]["id"];

type SchedulePreviewCell = {
  label: string;
  status: "task" | "available" | "break" | "off";
};

type SchedulePreviewWorker = {
  staff: StaffItem;
  shiftId: ShiftId;
  shiftLabel: string;
  tasks: TaskCatalogItem[];
  jornadas: StaffJornadaItem[];
  pausas: StaffPausaItem[];
  segments: Array<{ start: number; end: number }>;
  summaryDays: string;
  summaryEntries: string[];
};

function normalizeDayLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseTimeToMinutes(value: string): number | null {
  const [hourText = "", minuteText = ""] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function minutesToHHMM(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDateLabel(dateValue: string): string {
  if (!dateValue) {
    return "Sin fecha";
  }

  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTimeLabel(timeValue: string): string {
  if (!timeValue) {
    return "--:--";
  }

  return timeValue;
}

function toAmPmLabel(timeValue: string): string {
  const [hoursText = "", minutesText = ""] = timeValue.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return timeValue;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function roomLabel(room: RoomItem): string {
  return room.piso ? `Piso ${room.piso} · ${room.nombre}` : room.nombre;
}

function staffLabel(staff: StaffItem): string {
  return `${staff.nombres} ${staff.apellidos}`.trim();
}

function staffInitials(staff: StaffItem): string {
  return `${staff.nombres} ${staff.apellidos}`
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function staffRoleLabel(staff: StaffItem): string {
  const normalizedRole = (staff.rol ?? "").trim().toLowerCase();

  if (staff.roleId === 1 || staff.roleId === 2 || normalizedRole.includes("monitor")) {
    return "Monitora";
  }

  if (normalizedRole.includes("admin")) {
    return "Administradora";
  }

  return "Colaboradora";
}

function getStaffPhotoUrl(cedula: string): string {
  return `/api/staff-photo/${encodeURIComponent(cedula)}`;
}

function calculateEndTimeLabel(startTime: string, durationMinutes: number): string | null {
  const [hoursText = "", minutesText = ""] = startTime.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(durationMinutes)) {
    return null;
  }

  const startTotalMinutes = hours * 60 + minutes;
  const endTotalMinutes = (startTotalMinutes + Math.max(0, durationMinutes)) % (24 * 60);
  const endHours = Math.floor(endTotalMinutes / 60);
  const endMinutes = endTotalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function assignedTaskTimeWindowLabel(task: TaskCatalogItem): string {
  const startTime = task.tipo === "Recurrente" ? task.horaProgramada : task.horaEsporadica;
  if (!startTime) {
    return `Inicio flexible · Duración ${task.tiempoEstimadoMin} min`;
  }

  const endTime = calculateEndTimeLabel(startTime, task.tiempoEstimadoMin);
  if (!endTime) {
    return `Inicio ${startTime} · Duración ${task.tiempoEstimadoMin} min`;
  }

  return `Inicio ${toAmPmLabel(startTime)} · Fin ${toAmPmLabel(endTime)}`;
}

function assignedTaskScheduleLabel(task: ScheduleTaskItem): string {
  if (task.tipo === "Recurrente") {
    if (task.diasSemana.length > 0) {
      return task.diasSemana.map((day) => dayLabels[day] ?? day).join("/");
    }

    return "En cualquier momento del día";
  }

  const dateLabel = task.fechaEsporadica ? formatDateLabel(task.fechaEsporadica) : "Sin fecha";
  const timeLabel = task.horaEsporadica ? toAmPmLabel(task.horaEsporadica) : "Sin hora";
  return `${dateLabel} · ${timeLabel}`;
}

function staffMatchesAllSkills(staffId: string, requiredSkills: string[], links: StaffSkillLink[]): boolean {
  if (requiredSkills.length === 0) {
    return true;
  }

  const skillSet = new Set(links.filter((link) => link.staffId === staffId).map((link) => link.habilidadId));
  return requiredSkills.every((skillId) => skillSet.has(skillId));
}

function formatDateAsYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateForWeekday(dayIndex: number, baseDate = new Date()): string {
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const offset = (dayIndex - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);
  return formatDateAsYmd(date);
}

function buildCatalogPreviewTask(task: TaskCatalogItem): ScheduleTaskItem {
  return task;
}

function buildInstancePreviewTask(instance: TaskInstanceItem, catalogById: Map<string, TaskCatalogItem>): ScheduleTaskItem | null {
  const catalogTask = catalogById.get(instance.tareaCatalogoId);
  if (!catalogTask) {
    return null;
  }

  return {
    ...catalogTask,
    id: instance.id,
    nombre: instance.tareaNombre,
    tipo: "Esporadica",
    sector: catalogTask.sector,
    tiempoEstimadoMin: catalogTask.tiempoEstimadoMin,
    diasSemana: [],
    horaProgramada: null,
    fechaEsporadica: instance.fechaProgramada,
    horaEsporadica: instance.horaProgramada,
  };
}

function getTaskDayIndices(task: ScheduleTaskItem): number[] {
  if (task.tipo === "Recurrente" && task.diasSemana.length > 0) {
    return Array.from(new Set((task.diasSemana ?? []).map((d) => Number(d)))).sort((a, b) => a - b);
  }

  if (task.tipo === "Esporadica" && task.fechaEsporadica) {
    const date = new Date(`${task.fechaEsporadica}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return [date.getDay()];
    }
  }

  return [];
}

function getTaskStartMinutes(task: ScheduleTaskItem): number | null {
  const startTime = task.tipo === "Recurrente" ? task.horaProgramada : task.horaEsporadica;
  if (!startTime) return null;
  return parseTimeToMinutes(startTime);
}

function getShiftForMinutes(minutes: number | null): ShiftId {
  if (minutes === null) {
    return "manana";
  }

  if (minutes < SHIFT_DEFINITIONS[1].start) {
    return "manana";
  }

  if (minutes < SHIFT_DEFINITIONS[2].start) {
    return "tarde";
  }

  return "noche";
}

function getShiftForRange(start: number, end: number): ShiftId {
  const overlaps = SHIFT_DEFINITIONS.map((shift) => {
    const overlapStart = Math.max(start, shift.start);
    const overlapEnd = Math.min(end, shift.end);

    return {
      shiftId: shift.id,
      overlap: Math.max(0, overlapEnd - overlapStart),
    };
  });

  const bestOverlap = overlaps.sort((left, right) => right.overlap - left.overlap)[0];
  if (bestOverlap && bestOverlap.overlap > 0) {
    return bestOverlap.shiftId;
  }

  return getShiftForMinutes(Math.floor((start + end) / 2));
}

function getWorkerShift(tasks: ScheduleTaskItem[], jornadas: StaffJornadaItem[]): ShiftId {
  const taskStarts = tasks.map((task) => getTaskStartMinutes(task)).filter((value): value is number => value !== null);
  const jornadaStarts = jornadas.map((item) => parseTimeToMinutes(item.horaEntrada)).filter((value): value is number => value !== null);
  const earliest = [...taskStarts, ...jornadaStarts].sort((a, b) => a - b)[0] ?? null;
  return getShiftForMinutes(earliest);
}

function buildTaskLabel(task: ScheduleTaskItem): string {
  return task.nombre;
}

function findTasksInSlot(
  tasks: ScheduleTaskItem[],
  dayIndex: number,
  slotStart: number,
): ScheduleTaskItem[] {
  const slotEnd = slotStart + 30;
  const dayName = weekDayNames[dayIndex] ?? "";

  return tasks.filter((task) => {
    const taskDayIndices = getTaskDayIndices(task);
    if (!taskDayIndices.includes(dayIndex)) {
      return false;
    }

    const taskStartMin = getTaskStartMinutes(task);
    if (taskStartMin === null) {
      return false;
    }

    const taskEndMin = taskStartMin + Math.max(1, task.tiempoEstimadoMin);
    return slotStart < taskEndMin && slotEnd > taskStartMin;
  });
}

function buildPreviewMatrix(
  tasks: ScheduleTaskItem[],
  jornadas: StaffJornadaItem[],
  pauses: StaffPausaItem[],
  range: { start: number; end: number },
): Record<number, Record<number, SchedulePreviewCell>> {
  const matrix: Record<number, Record<number, SchedulePreviewCell>> = {} as Record<number, Record<number, SchedulePreviewCell>>;

  for (let day = 0; day <= 6; day += 1) {
    matrix[day] = {} as Record<number, SchedulePreviewCell>;
    for (let slotStart = range.start; slotStart < range.end; slotStart += 30) {
      const slotEnd = slotStart + 30;
      matrix[day][slotStart] = isSlotInsideJornada(day, slotStart, slotEnd, jornadas)
        ? { label: "DISPONIBLE", status: "available" }
        : { label: "FUERA DE TURNO", status: "off" };
    }
  }

  tasks.forEach((task) => {
    const startMin = getTaskStartMinutes(task);
    const durationMin = Math.max(1, task.tiempoEstimadoMin);
    const endMin = startMin !== null ? startMin + durationMin : null;
    if (startMin === null || endMin === null) {
      return;
    }

    const taskDays = getTaskDayIndices(task);
    taskDays.forEach((dayIndex) => {
      if (!matrix[dayIndex]) return;

      for (let slotStart = range.start; slotStart < range.end; slotStart += 30) {
        const slotEnd = slotStart + 30;
        if (slotStart < endMin && slotEnd > startMin) {
          const cell = matrix[dayIndex][slotStart];

          const nextStatus = isBreakTask(task) ? "break" : "task";

          if (cell.status === "available" || cell.status === "break") {
            matrix[dayIndex][slotStart] = { label: nextStatus === "break" ? "DESCANSO" : buildTaskLabel(task), status: nextStatus };
          } else if (cell.status === "task" && !cell.label.includes(task.nombre)) {
            matrix[dayIndex][slotStart] = { label: `${cell.label} / ${buildTaskLabel(task)}`, status: "task" };
            } else if (cell.status === "off") {
              matrix[dayIndex][slotStart] = { label: buildTaskLabel(task), status: nextStatus };
          }
        }
      }
    });
  });

  pauses.forEach((pause) => {
    const pauseStart = parseTimeToMinutes(pause.horaInicio);
    const pauseEnd = parseTimeToMinutes(pause.horaFin);
    if (pauseStart === null || pauseEnd === null) {
      return;
    }

    const dayIndex = getDayIndexFromLabel(pause.diaSemana);
    if (dayIndex === null || !matrix[dayIndex]) {
      return;
    }

    for (let slotStart = range.start; slotStart < range.end; slotStart += 30) {
      const slotEnd = slotStart + 30;
      if (slotStart < pauseEnd && slotEnd > pauseStart) {
        matrix[dayIndex][slotStart] = { label: pauseLabel(pause), status: "break" };
      }
    }
  });

  return matrix;
}

function getShiftLabel(shiftId: ShiftId): string {
  return SHIFT_DEFINITIONS.find((shift) => shift.id === shiftId)?.label ?? "Mañana";
}

function getDayIndexFromLabel(value: string): number | null {
  const normalized = normalizeDayLabel(value);
  if (normalized.startsWith("lun")) return 1;
  if (normalized.startsWith("mar")) return 2;
  if (normalized.startsWith("mie")) return 3;
  if (normalized.startsWith("jue")) return 4;
  if (normalized.startsWith("vie")) return 5;
  if (normalized.startsWith("sab")) return 6;
  if (normalized.startsWith("dom")) return 0;
  return null;
}

function roundDownToHalfHour(minutes: number): number {
  return Math.max(0, Math.floor(minutes / 30) * 30);
}

function roundUpToHalfHour(minutes: number): number {
  return Math.min(24 * 60, Math.ceil(minutes / 30) * 30);
}

function isBreakTask(task: TaskCatalogItem): boolean {
  const normalizedName = normalizeDayLabel(task.nombre);
  return normalizedName.includes("descanso") || normalizedName.includes("almuerzo") || normalizedName.includes("reunion jefe");
}

function pauseLabel(pause: StaffPausaItem): string {
  return pause.tipoPausa === "Descanso" ? "DESCANSO" : "COMIDA";
}

function isSlotInsideJornada(dayIndex: number, slotStart: number, slotEnd: number, jornadas: StaffJornadaItem[]): boolean {
  const dayName = weekDayNames[dayIndex] ?? "";
  const normalizedDay = normalizeDayLabel(dayName);

  return jornadas.some((slot) => {
    if (normalizeDayLabel(slot.diaSemana) !== normalizedDay) {
      return false;
    }

    const entryMin = parseTimeToMinutes(slot.horaEntrada);
    const exitMin = parseTimeToMinutes(slot.horaSalida);
    if (entryMin === null || exitMin === null) {
      return false;
    }

    return slotStart >= entryMin && slotEnd <= exitMin;
  });
}

function isRangeInsideAnyJornada(dayIndex: number, startMin: number, endMin: number, jornadas: StaffJornadaItem[]): boolean {
  const dayName = weekDayNames[dayIndex] ?? "";
  const normalizedDay = normalizeDayLabel(dayName);

  return jornadas.some((slot) => {
    if (normalizeDayLabel(slot.diaSemana) !== normalizedDay) {
      return false;
    }

    const entryMin = parseTimeToMinutes(slot.horaEntrada);
    const exitMin = parseTimeToMinutes(slot.horaSalida);
    if (entryMin === null || exitMin === null) {
      return false;
    }

    // Entire range must be inside the jornada slot
    return startMin >= entryMin && endMin <= exitMin;
  });
}

function getWorkerPreviewRange(tasks: ScheduleTaskItem[], jornadas: StaffJornadaItem[]): { start: number; end: number } {
  const starts: number[] = [];
  const ends: number[] = [];

  tasks.forEach((task) => {
    const startMin = getTaskStartMinutes(task);
    if (startMin === null) return;

    starts.push(startMin);
    ends.push(startMin + Math.max(1, task.tiempoEstimadoMin));
  });

  jornadas.forEach((slot) => {
    const entryMin = parseTimeToMinutes(slot.horaEntrada);
    const exitMin = parseTimeToMinutes(slot.horaSalida);
    if (entryMin !== null) starts.push(entryMin);
    if (exitMin !== null) ends.push(exitMin);
  });

  const rawStart = starts.length > 0 ? Math.min(...starts) : SHIFT_DEFINITIONS[0].start;
  const rawEnd = ends.length > 0 ? Math.max(...ends) : SHIFT_DEFINITIONS[0].end;

  const start = roundDownToHalfHour(rawStart);
  const end = roundUpToHalfHour(rawEnd);

  return {
    start,
    end: Math.max(start + 30, end),
  };
}

function getWorkerPreviewRangeWithPauses(tasks: ScheduleTaskItem[], jornadas: StaffJornadaItem[], pauses: StaffPausaItem[]): { start: number; end: number } {
  const baseRange = getWorkerPreviewRange(tasks, jornadas);
  const pauseStarts: number[] = [];
  const pauseEnds: number[] = [];

  pauses.forEach((pause) => {
    const startMin = parseTimeToMinutes(pause.horaInicio);
    const endMin = parseTimeToMinutes(pause.horaFin);
    if (startMin !== null) pauseStarts.push(startMin);
    if (endMin !== null) pauseEnds.push(endMin);
  });

  const pauseRange = {
    start: pauseStarts.length > 0 ? roundDownToHalfHour(Math.min(...pauseStarts)) : baseRange.start,
    end: pauseEnds.length > 0 ? roundUpToHalfHour(Math.max(...pauseEnds)) : baseRange.end,
  };

  return {
    start: Math.min(baseRange.start, pauseRange.start),
    end: Math.max(baseRange.end, pauseRange.end),
  };
}

function getWorkerPreviewSegments(
  matrix: Record<number, Record<number, SchedulePreviewCell>>,
  range: { start: number; end: number },
): Array<{ start: number; end: number }> {
  const slotStarts: number[] = [];
  for (let slotStart = range.start; slotStart < range.end; slotStart += 30) {
    const hasActiveCell = PREVIEW_DAY_ORDER.some((dayIndex) => {
      const cell = matrix[dayIndex]?.[slotStart];
      return Boolean(cell && cell.status !== "off");
    });

    if (hasActiveCell) {
      slotStarts.push(slotStart);
    }
  }

  if (slotStarts.length === 0) {
    return [{ start: range.start, end: range.end }];
  }

  const segments: Array<{ start: number; end: number }> = [];
  let segmentStart = slotStarts[0];
  let previous = slotStarts[0];

  for (let index = 1; index < slotStarts.length; index += 1) {
    const current = slotStarts[index];
    if (current - previous > 30) {
      segments.push({ start: segmentStart, end: previous + 30 });
      segmentStart = current;
    }
    previous = current;
  }

  segments.push({ start: segmentStart, end: previous + 30 });

  return segments;
}

function summarizeWorkerPreviewSegments(
  matrix: Record<number, Record<number, SchedulePreviewCell>>,
  segments: Array<{ start: number; end: number }>,
): { summaryDays: string; summaryEntries: string[] } {
  const daySet = new Set<number>();
  const groupedRanges = new Map<string, Set<number>>();

  segments.forEach((segment) => {
    const rangeLabel = `${toAmPmLabel(minutesToHHMM(segment.start))} - ${toAmPmLabel(minutesToHHMM(segment.end))}`;
    const activeDays = new Set<number>();

    PREVIEW_DAY_ORDER.forEach((dayIndex) => {
      for (let slotStart = segment.start; slotStart < segment.end; slotStart += 30) {
        const cell = matrix[dayIndex]?.[slotStart];
        if (cell && cell.status !== "off") {
          activeDays.add(dayIndex);
          daySet.add(dayIndex);
          break;
        }
      }
    });

    const bucket = groupedRanges.get(rangeLabel) ?? new Set<number>();
    activeDays.forEach((dayIndex) => bucket.add(dayIndex));
    groupedRanges.set(rangeLabel, bucket);
  });

  const summaryDays = Array.from(daySet)
    .sort((a, b) => a - b)
    .map((dayIndex) => WEEK_DAY_SHORT_LABELS[dayIndex] ?? String(dayIndex))
    .join("/");

  const summaryEntries = Array.from(groupedRanges.entries())
    .map(([rangeLabel, dayIndices]) => {
      const dayLabel = Array.from(dayIndices)
        .sort((a, b) => a - b)
        .map((dayIndex) => WEEK_DAY_SHORT_LABELS[dayIndex] ?? String(dayIndex))
        .join("/");

      return `${dayLabel || "Sin días"} · ${rangeLabel}`;
    })
    .sort((left, right) => left.localeCompare(right, "es"));

  return { summaryDays, summaryEntries };
}

export default function TasksPage() {
  const authSession = useMemo(() => readAuthSession(), []);
  const isLimitedTaskAccess = authSession?.role === "monitor" || authSession?.role === "colaborador";
  const canEditTaskSchedule = authSession?.role === "admin";
  const currentStaffIdentifier = authSession?.staffId ?? authSession?.cedula ?? null;

  const [catalog, setCatalog] = useState<TaskCatalogItem[]>([]);
  const [instances, setInstances] = useState<TaskInstanceItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [staffSkills, setStaffSkills] = useState<StaffSkillLink[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [staffJornadasByStaffId, setStaffJornadasByStaffId] = useState<Record<string, StaffJornadaItem[]>>({});
  const [staffPausasByStaffId, setStaffPausasByStaffId] = useState<Record<string, StaffPausaItem[]>>({});
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [taskSpaces, setTaskSpaces] = useState<TaskSpaceItem[]>([]);
  const [loadingTaskLocations, setLoadingTaskLocations] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [spaceName, setSpaceName] = useState("");
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState("");
  const [selectedScheduleCell, setSelectedScheduleCell] = useState<ScheduleCellSelection>(null);
  const [showQuickCatalogEditor, setShowQuickCatalogEditor] = useState(false);
  const [scheduleTaskMode, setScheduleTaskMode] = useState<ScheduleTaskMode>("catalog");
  const [scheduleManualForm, setScheduleManualForm] = useState<ScheduleManualFormState>({
    nombre: "",
    sector: "",
    tiempoEstimadoMin: "25",
    horaProgramada: "08:00",
    diasSemana: [1, 2, 3, 4, 5],
    requerimientos: [],
  });
  const [scheduleSectorSearchQuery, setScheduleSectorSearchQuery] = useState("");
  const [scheduleManualSectorSearchQuery, setScheduleManualSectorSearchQuery] = useState("");
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState("");
  const [deletingSpaceId, setDeletingSpaceId] = useState<string | null>(null);

  const [skillName, setSkillName] = useState("");
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingSkillName, setEditingSkillName] = useState("");
  const [deletingSkillId, setDeletingSkillId] = useState<string | null>(null);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [deletingCatalogId, setDeletingCatalogId] = useState<string | null>(null);
  const [requirementDraft, setRequirementDraft] = useState("");
  const [scheduleManualRequirementDraft, setScheduleManualRequirementDraft] = useState("");
  const [selectedCatalogLocations, setSelectedCatalogLocations] = useState<string[]>([]);
  const [tasksSubtab, setTasksSubtab] = useState<TasksSubtab>("horario");
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<TaskType | "todos">("todos");
  const [catalogSectorFilter, setCatalogSectorFilter] = useState("todos");
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>({
    nombre: "",
    tipo: DEFAULT_CATALOG_TASK_TYPE,
    sector: "",
    modoAsignacion: DEFAULT_CATALOG_ASSIGNMENT_MODE,
    programacionRecurrente: "programada",
    cantidadPersonal: "1",
    habilidadesRequeridasIds: [],
    requerimientos: [],
    staffAsignadosIds: [],
    diasSemana: [1, 2, 3, 4, 5],
    horaProgramada: "08:00",
    fechaEsporadica: new Date().toISOString().slice(0, 10),
    horaEsporadica: "08:00",
    requiereFinalizacion: false,
    tareaFinalizacion: "",
    fechaFinalizacion: new Date().toISOString().slice(0, 10),
    horaFinalizacion: "09:00",
    tiempoEstimadoMin: "25",
  });

  const visibleStaff = useMemo(() => {
    if (!isLimitedTaskAccess) {
      return staff;
    }

    return staff.filter((person) => {
      if (currentStaffIdentifier && person.id === currentStaffIdentifier) {
        return true;
      }

      return authSession?.cedula ? person.cedula === authSession.cedula : false;
    });
  }, [authSession?.cedula, currentStaffIdentifier, isLimitedTaskAccess, staff]);

  const [instanceForm, setInstanceForm] = useState<InstanceFormState>({
    tareaCatalogoId: "",
    salonId: "",
    prioridad: "Media",
    fechaProgramada: new Date().toISOString().slice(0, 10),
    horaProgramada: "08:00",
    asignacionAutomatica: false,
    detalleAdicional: "",
  });
  const [linkSkillForm, setLinkSkillForm] = useState<LinkSkillFormState>({
    staffId: "",
    habilidadId: "",
  });
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>({
    tareaInstanciaId: "",
    staffId: "",
  });
  const [reviewForm, setReviewForm] = useState<ReviewFormState>({
    asignacionId: "",
    monitorId: "",
    decision: "aprobar",
    rechazoEstado: "Corregir",
    observacionesRevision: "",
  });
  const [showCatalogValidationModal, setShowCatalogValidationModal] = useState(false);
  const [catalogSubmitErrorModalMessage, setCatalogSubmitErrorModalMessage] = useState<string | null>(null);
  const [assignmentScheduleWarningMessage, setAssignmentScheduleWarningMessage] = useState<string | null>(null);
  const [pendingAssignmentPayload, setPendingAssignmentPayload] = useState<{ tareaInstanciaId: string; staffId: string } | null>(null);

  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const skillById = useMemo(() => new Map(skills.map((item) => [item.id, item])), [skills]);
  const roomById = useMemo(() => new Map(rooms.map((item) => [item.id, item])), [rooms]);

  // Show inline notices as toast popups and clear the inline notice to avoid duplicate rendering
  useEffect(() => {
    if (!notice) return;

    if (notice.kind === "success") {
      toast.success(notice.text);
    } else {
      toast.error(notice.text);
    }

    // Clear the inline notice so the small banner does not persist
    setNotice(null);
  }, [notice]);

  useEffect(() => {
    if (!selectedScheduleCell) {
      setScheduleTaskMode("catalog");
      setScheduleManualSectorSearchQuery("");
      return;
    }

    setScheduleTaskMode("catalog");
    setScheduleManualSectorSearchQuery("");
    setScheduleManualForm({
      nombre: "",
      sector: "",
      tiempoEstimadoMin: "25",
      horaProgramada: minutesToHHMM(selectedScheduleCell.slotStart),
      diasSemana: [selectedScheduleCell.dayIndex],
      requerimientos: [],
    });
  }, [selectedScheduleCell]);

  const selectedCatalogSkillIds = catalogById.get(instanceForm.tareaCatalogoId)?.habilidadesRequeridasIds ?? [];
  const recurringTimeOptions = useMemo(() => {
    if (!catalogForm.horaProgramada || TASK_RECURRENT_TIME_OPTIONS.includes(catalogForm.horaProgramada)) {
      return TASK_RECURRENT_TIME_OPTIONS;
    }

    return [catalogForm.horaProgramada, ...TASK_RECURRENT_TIME_OPTIONS];
  }, [catalogForm.horaProgramada]);

  // Validación de campos faltantes en el catálogo
  const missingCatalogFields = useMemo(() => {
    const missing: string[] = [];

    if (!catalogForm.nombre.trim()) missing.push("Nombre de la tarea");
    if (!editingCatalogId && selectedCatalogLocations.length === 0) missing.push("Lugares de la tarea");
    if (editingCatalogId && !catalogForm.sector.trim()) missing.push("Lugar de la tarea");
    if (!catalogForm.tiempoEstimadoMin || Number(catalogForm.tiempoEstimadoMin) < 1) missing.push("Tiempo estimado válido");
    if (!catalogForm.cantidadPersonal || Number(catalogForm.cantidadPersonal) < 1) missing.push("Cantidad de personal válida");

    if (!catalogForm.programacionRecurrente) missing.push("Tipo de recurrencia");
    if (catalogForm.programacionRecurrente === "programada") {
      if (catalogForm.diasSemana.length === 0) missing.push("Días de semana para la tarea");
      if (!catalogForm.horaProgramada) missing.push("Hora programada");
    }

    if (catalogForm.staffAsignadosIds.length === 0) {
      missing.push("Personal para asignación manual");
    }

    return missing;
  }, [catalogForm, selectedCatalogLocations.length, editingCatalogId]);

  const scheduleEditMissingFields = useMemo(() => {
    if (!selectedScheduleCell?.isEditing) {
      return missingCatalogFields;
    }

    const missing: string[] = [];

    if (!catalogForm.nombre.trim()) missing.push("Nombre de la tarea");
    if (!catalogForm.sector.trim()) missing.push("Lugar de la tarea");
    if (!catalogForm.tiempoEstimadoMin || Number(catalogForm.tiempoEstimadoMin) < 1) missing.push("Tiempo estimado válido");

    if (!catalogForm.programacionRecurrente) missing.push("Tipo de recurrencia");
    if (catalogForm.programacionRecurrente === "programada") {
      if (catalogForm.diasSemana.length === 0) missing.push("Días de semana para la tarea");
      if (!catalogForm.horaProgramada) missing.push("Hora programada");
    }

    return missing;
  }, [catalogForm, missingCatalogFields, selectedScheduleCell?.isEditing]);

  const eligibleStaffIds = useMemo(() => {
    return new Set(staff.filter((person) => staffMatchesAllSkills(person.id, selectedCatalogSkillIds, staffSkills)).map((person) => person.id));
  }, [selectedCatalogSkillIds, staff, staffSkills]);

  const suggestedStaffForManualAssignment = useMemo(() => {
    return staff
      .filter((person) => staffMatchesAllSkills(person.id, catalogForm.habilidadesRequeridasIds, staffSkills))
      .sort((a, b) => staffLabel(a).localeCompare(staffLabel(b), "es", { sensitivity: "base" }));
  }, [catalogForm.habilidadesRequeridasIds, staff, staffSkills]);

  const selectedAssignmentCatalogSkillIds = catalogById.get(
    instances.find((task) => task.id === assignmentForm.tareaInstanciaId)?.tareaCatalogoId ?? "",
  )?.habilidadesRequeridasIds ?? [];
  const assignmentEligibleStaffIds = useMemo(() => {
    return new Set(staff.filter((person) => staffMatchesAllSkills(person.id, selectedAssignmentCatalogSkillIds, staffSkills)).map((person) => person.id));
  }, [selectedAssignmentCatalogSkillIds, staff, staffSkills]);

  const reviewQueue = useMemo(
    () => instances.filter((task) => task.estado === "En Revision" && Boolean(task.asignacionId)),
    [instances],
  );

  const taskLocationOptions = useMemo(() => {
    const options = new Map<string, { id: string; nombre: string; source: "espacio" | "salon" }>();

    taskSpaces.forEach((space) => {
      const normalizedKey = space.nombre.trim().toLowerCase();
      if (!normalizedKey) return;
      options.set(normalizedKey, {
        id: `space-${space.id}`,
        nombre: space.nombre,
        source: "espacio",
      });
    });

    rooms.forEach((room) => {
      const roomName = roomLabel(room);
      const normalizedKey = roomName.trim().toLowerCase();
      if (!normalizedKey || options.has(normalizedKey)) return;
      options.set(normalizedKey, {
        id: `room-${room.id}`,
        nombre: roomName,
        source: "salon",
      });
    });

    return Array.from(options.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [taskSpaces, rooms]);

  const toggleCatalogLocation = (locationName: string) => {
    setSelectedCatalogLocations((current) =>
      current.includes(locationName)
        ? current.filter((item) => item !== locationName)
        : [...current, locationName],
    );
  };

  const addCustomRequirement = () => {
    const normalizedName = requirementDraft.trim();
    if (!normalizedName) {
      return;
    }

    setCatalogForm((current) => ({
      ...current,
      requerimientos: current.requerimientos.some((item) => item.toLowerCase() === normalizedName.toLowerCase())
        ? current.requerimientos
        : [...current.requerimientos, normalizedName],
    }));
    setRequirementDraft("");
  };

  const removeRequirement = (name: string) => {
    setCatalogForm((current) => ({
      ...current,
      requerimientos: current.requerimientos.filter((item) => item !== name),
    }));
  };

  const addManualRequirement = () => {
    const normalized = scheduleManualRequirementDraft.trim();
    if (!normalized) return;
    setScheduleManualForm((current) => ({
      ...current,
      requerimientos: current.requerimientos?.some((item) => item.toLowerCase() === normalized.toLowerCase())
        ? current.requerimientos
        : [...(current.requerimientos ?? []), normalized],
    }));
    setScheduleManualRequirementDraft("");
  };

  const removeManualRequirement = (name: string) => {
    setScheduleManualForm((current) => ({
      ...current,
      requerimientos: (current.requerimientos ?? []).filter((item) => item !== name),
    }));
  };

  const pendingInstances = useMemo(
    () => instances.filter((task) => task.estado === "Pendiente" || task.estado === "Corregir"),
    [instances],
  );
  const activeInstances = useMemo(() => instances.filter((task) => task.estado === "En Progreso"), [instances]);
  const completedInstances = useMemo(() => instances.filter((task) => task.estado === "Completada"), [instances]);
  const catalogSectorOptions = useMemo(
    () => Array.from(new Set(catalog.map((task) => task.sector).filter((sector) => sector.trim().length > 0))).sort((a, b) => a.localeCompare(b, "es")),
    [catalog],
  );
  const filteredCatalog = useMemo(() => {
    const normalizedQuery = catalogSearchQuery.trim().toLowerCase();

    return catalog.filter((task) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        task.nombre.toLowerCase().includes(normalizedQuery) ||
        task.id.toLowerCase().includes(normalizedQuery) ||
        task.sector.toLowerCase().includes(normalizedQuery);
      const matchesType = catalogTypeFilter === "todos" || task.tipo === catalogTypeFilter;
      const matchesSector = catalogSectorFilter === "todos" || task.sector === catalogSectorFilter;

      return matchesQuery && matchesType && matchesSector;
    });
  }, [catalog, catalogSearchQuery, catalogTypeFilter, catalogSectorFilter]);

  const assignedCatalogTasks = useMemo(
    () => filteredCatalog.filter((task) => (task.staffAsignadosIds ?? []).length > 0),
    [filteredCatalog],
  );

  const assignedInstanceTasks = useMemo(
    () =>
      instances
        .flatMap((instance) => {
          if (!instance.staffAsignadoId) {
            return [];
          }

          const sourceCatalogTask = catalogById.get(instance.tareaCatalogoId);
          const shouldSkipInstancePreview =
            sourceCatalogTask?.tipo === "Recurrente" &&
            (sourceCatalogTask.staffAsignadosIds ?? []).includes(instance.staffAsignadoId);

          if (shouldSkipInstancePreview) {
            return [];
          }

          const previewTask = buildInstancePreviewTask(instance, catalogById);
          if (!previewTask) {
            return [];
          }

          return [{ staffId: instance.staffAsignadoId, task: previewTask }];
        }),
    [instances, catalogById],
  );

  const assignedTasksByStaff = useMemo(() => {
    const buckets = new Map<string, { staffId: string; person: StaffItem | null; tasks: ScheduleTaskItem[] }>();

    assignedCatalogTasks.forEach((task) => {
      const uniqueStaff = Array.from(new Set(task.staffAsignadosIds ?? []));
      const previewTask = buildCatalogPreviewTask(task);

      uniqueStaff.forEach((staffId) => {
        const existing = buckets.get(staffId);
        if (existing) {
          existing.tasks.push(previewTask);
          return;
        }

        buckets.set(staffId, {
          staffId,
          person: staff.find((member) => member.id === staffId) ?? null,
          tasks: [previewTask],
        });
      });
    });

    assignedInstanceTasks.forEach(({ staffId, task }) => {
      const existing = buckets.get(staffId);
      if (existing) {
        existing.tasks.push(task);
        return;
      }

      buckets.set(staffId, {
        staffId,
        person: staff.find((member) => member.id === staffId) ?? null,
        tasks: [task],
      });
    });

    return Array.from(buckets.values()).sort((a, b) => {
      const aName = a.person ? staffLabel(a.person) : a.staffId;
      const bName = b.person ? staffLabel(b.person) : b.staffId;
      return aName.localeCompare(bName, "es");
    });
  }, [assignedCatalogTasks, assignedInstanceTasks, staff]);

  const allAssignedCatalogTasks = useMemo(
    () => catalog.filter((task) => (task.staffAsignadosIds ?? []).length > 0),
    [catalog],
  );

  const schedulePreviewByShift = useMemo(() => {
    const tasksByStaffId = new Map<string, ScheduleTaskItem[]>();

    allAssignedCatalogTasks.forEach((task) => {
      const uniqueStaff = Array.from(new Set(task.staffAsignadosIds ?? []));
      const previewTask = buildCatalogPreviewTask(task);
      uniqueStaff.forEach((staffId) => {
        const bucket = tasksByStaffId.get(staffId) ?? [];
        bucket.push(previewTask);
        tasksByStaffId.set(staffId, bucket);
      });
    });

    assignedInstanceTasks.forEach(({ staffId, task }) => {
      const bucket = tasksByStaffId.get(staffId) ?? [];
      bucket.push(task);
      tasksByStaffId.set(staffId, bucket);
    });

    const baseWorkers = visibleStaff
      .filter(
        (person) =>
          tasksByStaffId.has(person.id) ||
          (staffJornadasByStaffId[person.id] ?? []).length > 0 ||
          (staffPausasByStaffId[person.id] ?? []).length > 0,
      )
      .map((person) => {
        const tasks = tasksByStaffId.get(person.id) ?? [];
        const jornadas = staffJornadasByStaffId[person.id] ?? [];
        const pauses = staffPausasByStaffId[person.id] ?? [];
        const previewRange = getWorkerPreviewRangeWithPauses(tasks, jornadas, pauses);
        const matrix = buildPreviewMatrix(tasks, jornadas, pauses, previewRange);
        const segments = getWorkerPreviewSegments(matrix, previewRange);

        return {
          staff: person,
          tasks,
          jornadas,
          pausas: pauses,
          segments,
          matrix,
        };
      })
      .flatMap((worker) => {
        const groupedSegments = SHIFT_DEFINITIONS.flatMap((shift) => {
          const shiftSegments = worker.segments.filter((segment) => getShiftForRange(segment.start, segment.end) === shift.id);
          if (shiftSegments.length === 0) {
            return [];
          }

          const { summaryDays, summaryEntries } = summarizeWorkerPreviewSegments(worker.matrix, shiftSegments);

          return [
            {
              ...worker,
              shiftId: shift.id,
              shiftLabel: shift.label,
              segments: shiftSegments,
              summaryDays,
              summaryEntries,
            },
          ];
        });

        return groupedSegments;
      });

    return SHIFT_DEFINITIONS.map((shift) => ({
      ...shift,
      workers: baseWorkers
        .filter((worker) => worker.shiftId === shift.id)
        .sort((a, b) => staffLabel(a.staff).localeCompare(staffLabel(b.staff), "es")),
    }));
  }, [allAssignedCatalogTasks, assignedInstanceTasks, staffJornadasByStaffId, staffPausasByStaffId, visibleStaff]);

  const previewStaffCount = useMemo(() => {
    const uniqueIds = new Set<string>();
    schedulePreviewByShift.forEach((shiftGroup) => {
      shiftGroup.workers.forEach((worker) => {
        uniqueIds.add(worker.staff.id);
      });
    });
    return uniqueIds.size;
  }, [schedulePreviewByShift]);

  const filteredSchedulePreviewByShift = useMemo(() => {
    const normalizedQuery = scheduleSearchQuery.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
      return schedulePreviewByShift;
    }

    return schedulePreviewByShift
      .map((shiftGroup) => ({
        ...shiftGroup,
        workers: shiftGroup.workers.filter((worker) => staffLabel(worker.staff).toLowerCase().includes(normalizedQuery)),
      }))
      .filter((shiftGroup) => shiftGroup.workers.length > 0);
  }, [schedulePreviewByShift, scheduleSearchQuery]);

  const filteredPreviewStaffCount = useMemo(() => {
    const uniqueIds = new Set<string>();
    filteredSchedulePreviewByShift.forEach((shiftGroup) => {
      shiftGroup.workers.forEach((worker) => {
        uniqueIds.add(worker.staff.id);
      });
    });

    return uniqueIds.size;
  }, [filteredSchedulePreviewByShift]);

  useEffect(() => {
    if (isLimitedTaskAccess && tasksSubtab !== "horario") {
      setTasksSubtab("horario");
    }
  }, [isLimitedTaskAccess, tasksSubtab]);

  useEffect(() => {
    if (isLimitedTaskAccess) {
      setSelectedScheduleCell(null);
    }
  }, [isLimitedTaskAccess]);

  const loadData = async (options?: { preserveNotice?: boolean }) => {
    const preserveNotice = options?.preserveNotice ?? false;
    if (!preserveNotice) {
      setNotice(null);
    }

    setLoadingTaskLocations(true);

    try {
      const [catalogBody, instancesBody, skillsBody, staffSkillsBody, staffBody, jornadasBody, pausasBody, roomsBody, spacesBody] = await Promise.all([
        fetchApiJson<TasksResponse>("/api/tasks/catalog", { cache: "no-store" }),
        fetchApiJson<InstancesResponse>("/api/tasks/instances", { cache: "no-store" }),
        fetchApiJson<SkillsResponse>("/api/tasks/skills", { cache: "no-store" }),
        fetchApiJson<StaffSkillsResponse>("/api/tasks/staff-habilidades", { cache: "no-store" }),
        fetchApiJson<StaffResponse>("/api/staff", { cache: "no-store" }),
        fetchApiJson<StaffJornadasBulkResponse>("/api/staff/jornadas-bulk", { cache: "no-store" }).catch(() => ({} as StaffJornadasBulkResponse)),
        fetchApiJson<StaffPausasBulkResponse>("/api/staff/pausas-bulk", { cache: "no-store" }).catch(() => ({} as StaffPausasBulkResponse)),
        fetchApiJson<RoomsInfoResponse>("/api/schedules/rooms-info", { cache: "no-store" }).catch(() => ({} as RoomsInfoResponse)),
        fetchApiJson<TaskSpacesResponse>("/api/tasks/spaces", { cache: "no-store" }).catch(() => ({} as TaskSpacesResponse)),
      ]);

      setCatalog((catalogBody.tasks ?? []).map((t: any) => ({
        ...t,
        diasSemana: Array.isArray(t.diasSemana) ? t.diasSemana.map((d: any) => Number(d)) : [],
      })));
      setInstances(instancesBody.tasks ?? []);
      setSkills(skillsBody.skills ?? []);
      setStaffSkills(staffSkillsBody.links ?? []);
      setStaff(staffBody.staff ?? []);
      setStaffJornadasByStaffId(jornadasBody.jornadas ?? {});
      setStaffPausasByStaffId(pausasBody.pausas ?? {});
      const uniqueRooms = Array.from(
        new Map(
          (roomsBody.roomsByFloor ?? [])
            .flat()
            .filter(Boolean)
            .map((room) => [room.id, room] as const),
        ).values(),
      );
      setRooms(uniqueRooms);
      setTaskSpaces(spacesBody.spaces ?? []);

      setCatalogForm((current) => ({
        ...current,
        sector: current.sector,
        habilidadesRequeridasIds: current.habilidadesRequeridasIds.filter((id) => (skillsBody.skills ?? []).some((skill) => skill.id === id)),
        requerimientos: current.requerimientos.filter((item) => item.trim().length > 0),
        staffAsignadosIds: current.staffAsignadosIds.filter((id) => (staffBody.staff ?? []).some((person) => person.id === id)),
      }));
      setInstanceForm((current) => ({
        ...current,
        tareaCatalogoId: current.tareaCatalogoId || catalogBody.tasks?.[0]?.id || "",
        salonId: current.salonId || uniqueRooms[0]?.id || "",
      }));
      setLinkSkillForm((current) => ({
        ...current,
        staffId: current.staffId || staffBody.staff?.[0]?.id || "",
        habilidadId: current.habilidadId || skillsBody.skills?.[0]?.id || "",
      }));
      setAssignmentForm((current) => ({
        ...current,
        tareaInstanciaId: current.tareaInstanciaId || instancesBody.tasks?.[0]?.id || "",
        staffId: current.staffId || staffBody.staff?.[0]?.id || "",
      }));
      setReviewForm((current) => ({
        ...current,
        asignacionId: current.asignacionId || instancesBody.tasks?.find((task) => task.asignacionId)?.asignacionId || "",
        monitorId: current.monitorId || staffBody.staff?.find((person) => person.roleId === 1 || person.roleId === 2)?.id || staffBody.staff?.[0]?.id || "",
      }));
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudieron cargar las tareas.",
      });
    } finally {
      setLoadingTaskLocations(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadData({ preserveNotice: true });
  };

  const submitSkill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = skillName.trim();
    if (!trimmedName) {
      setNotice({ kind: "error", text: "Escribe un nombre de habilidad." });
      return;
    }

    try {
      setBusyAction("skill-create");
      await fetchApiJson<{ message: string; id: string }>("/api/tasks/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: trimmedName }),
      });
      setSkillName("");
      setNotice({ kind: "success", text: "Habilidad creada correctamente." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo crear la habilidad." });
    } finally {
      setBusyAction(null);
    }
  };

  const beginEditTaskSpace = (space: TaskSpaceItem) => {
    setEditingSpaceId(space.id);
    setEditingSpaceName(space.nombre);
    setNotice(null);
  };

  const cancelEditTaskSpace = () => {
    setEditingSpaceId(null);
    setEditingSpaceName("");
  };

  const submitTaskSpaceEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingSpaceId) {
      setNotice({ kind: "error", text: "Selecciona un espacio para editar." });
      return;
    }

    const trimmedName = editingSpaceName.trim();
    if (!trimmedName) {
      setNotice({ kind: "error", text: "Escribe un nombre para el espacio." });
      return;
    }

    try {
      setBusyAction(`space-edit-${editingSpaceId}`);
      await fetchApiJson<{ message: string; id: string }>(`/api/tasks/spaces/${editingSpaceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: trimmedName }),
      });
      setNotice({ kind: "success", text: "Espacio actualizado correctamente." });
      cancelEditTaskSpace();
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo actualizar el espacio." });
    } finally {
      setBusyAction(null);
    }
  };

  const deleteTaskSpace = async (id: string) => {
    if (!(await confirmToast("¿Estás seguro de que deseas eliminar este espacio de tareas?", {
      title: "Eliminar espacio",
      confirmLabel: "Eliminar",
    }))) {
      return;
    }

    try {
      setDeletingSpaceId(id);
      setBusyAction(`space-delete-${id}`);
      await fetchApiJson<{ message: string; id: string }>(`/api/tasks/spaces/${id}`, {
        method: "DELETE",
      });
      setNotice({ kind: "success", text: "Espacio eliminado correctamente." });
      if (editingSpaceId === id) {
        cancelEditTaskSpace();
      }
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo eliminar el espacio." });
    } finally {
      setDeletingSpaceId(null);
      setBusyAction(null);
    }
  };

  const beginEditSkill = (skill: SkillItem) => {
    setEditingSkillId(skill.id);
    setEditingSkillName(skill.nombre);
    setNotice(null);
  };

  const cancelEditSkill = () => {
    setEditingSkillId(null);
    setEditingSkillName("");
  };

  const submitSkillEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingSkillId) {
      setNotice({ kind: "error", text: "Selecciona una habilidad para editar." });
      return;
    }

    const trimmedName = editingSkillName.trim();
    if (!trimmedName) {
      setNotice({ kind: "error", text: "Escribe un nombre de habilidad." });
      return;
    }

    try {
      setBusyAction(`skill-edit-${editingSkillId}`);
      await fetchApiJson<{ message: string; id: string }>(`/api/tasks/skills/${editingSkillId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: trimmedName }),
      });
      setNotice({ kind: "success", text: "Habilidad actualizada correctamente." });
      setEditingSkillId(null);
      setEditingSkillName("");
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo actualizar la habilidad." });
    } finally {
      setBusyAction(null);
    }
  };

  const deleteSkill = async (skillId: string) => {
    if (!(await confirmToast("¿Estás seguro de que deseas eliminar esta habilidad?", {
      title: "Eliminar habilidad",
      confirmLabel: "Eliminar",
    }))) {
      return;
    }

    try {
      setBusyAction(`skill-delete-${skillId}`);
      setDeletingSkillId(skillId);
      await fetchApiJson<{ message: string; id: string }>(`/api/tasks/skills/${skillId}`, {
        method: "DELETE",
      });
      setNotice({ kind: "success", text: "Habilidad eliminada correctamente." });
      setEditingSkillId(null);
      setEditingSkillName("");
      setDeletingSkillId(null);
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo eliminar la habilidad." });
      setDeletingSkillId(null);
    } finally {
      setBusyAction(null);
    }
  };

  const submitCatalog = async (event: FormEvent<HTMLFormElement>) : Promise<boolean> => {
    event.preventDefault();
    setCatalogSubmitErrorModalMessage(null);

    const validationFields = selectedScheduleCell?.isEditing ? scheduleEditMissingFields : missingCatalogFields;

    if (validationFields.length > 0) {
      setCatalogSubmitErrorModalMessage(validationFields.join(" · "));
      setShowCatalogValidationModal(true);
      return false;
    }

    const nombre = catalogForm.nombre.trim();
    const tiempoEstimadoMin = Number(catalogForm.tiempoEstimadoMin);
    const cantidadPersonal = Number(catalogForm.cantidadPersonal);

    try {
      const isEditing = Boolean(editingCatalogId);
      setBusyAction(isEditing ? "catalog-update" : "catalog-create");

      if (!isEditing) {
        const selectedSkills = catalogForm.habilidadesRequeridasIds
          .map((id) => skills.find((skill) => skill.id === id)?.nombre)
          .filter((value): value is string => Boolean(value));
        const selectedRequirements = catalogForm.requerimientos.filter((item) => item.trim().length > 0);
        const selectedStaff = catalogForm.staffAsignadosIds
          .map((id) => staff.find((person) => person.id === id))
          .filter((value): value is StaffItem => Boolean(value))
          .map((person) => staffLabel(person));
        const selectedLocationLabels = editingCatalogId ? [catalogForm.sector] : selectedCatalogLocations;

        const resumen = [
          `Nombre: ${nombre}`,
          `Tipo: ${catalogForm.tipo || DEFAULT_CATALOG_TASK_TYPE}`,
          `Lugar(es): ${selectedLocationLabels.join(", ")}`,
          `Modo de asignación: ${assignmentModeLabels[catalogForm.modoAsignacion || DEFAULT_CATALOG_ASSIGNMENT_MODE]}`,
          `Cantidad de personal: ${cantidadPersonal}`,
          `Personal sugerido: ${selectedStaff.length ? selectedStaff.join(", ") : "Sin personal predefinido"}`,
          `Tiempo estimado: ${tiempoEstimadoMin} min`,
          `Habilidades: ${selectedSkills.length ? selectedSkills.join(", ") : "Sin requerimientos"}`,
          `Checklist: ${selectedRequirements.length ? selectedRequirements.join(", ") : "Sin checklist"}`,
          (catalogForm.tipo || DEFAULT_CATALOG_TASK_TYPE) === "Recurrente"
            ? `Recurrencia: ${catalogForm.programacionRecurrente === "programada" ? "Programada" : "Diaria en cualquier momento"}`
            : `Fecha/Hora esporádica: ${catalogForm.fechaEsporadica} ${catalogForm.horaEsporadica}`,
        ].join("\n");

        const confirmed = await confirmToast(`¿Seguro que deseas crear este catálogo?\n\n${resumen}`, {
          title: "Confirmar catálogo",
          confirmLabel: "Crear",
        });
        if (!confirmed) {
          setBusyAction(null);
          return false;
        }
      }

      const blockingWarnings: string[] = [];
      const softWarnings: string[] = [];
      const effectiveStaffIds = selectedScheduleCell?.isEditing
        ? Array.from(new Set([...catalogForm.staffAsignadosIds, selectedScheduleCell.staffId]))
        : catalogForm.staffAsignadosIds;

      const selectedStaffMembers = effectiveStaffIds
        .map((id) => staff.find((person) => person.id === id))
        .filter((value): value is StaffItem => Boolean(value));

      const taskStartTime =
        catalogForm.tipo === "Recurrente" && catalogForm.programacionRecurrente === "programada"
          ? catalogForm.horaProgramada
          : "";

      const taskStartMin = parseTimeToMinutes(taskStartTime);
      const taskDurationMin = Math.max(1, tiempoEstimadoMin);
      const taskEndMin = taskStartMin !== null ? taskStartMin + taskDurationMin : null;

      const relevantDays = (() => {
        if (catalogForm.tipo !== "Recurrente" || catalogForm.programacionRecurrente !== "programada") return [] as string[];
        return catalogForm.diasSemana.map((dayIndex) => weekDayNames[dayIndex] ?? "").filter(Boolean);
      })();

      if (selectedStaffMembers.length > 0 && taskStartMin !== null && taskEndMin !== null && relevantDays.length > 0) {
        if (taskEndMin > 24 * 60) {
          blockingWarnings.push(`La tarea termina fuera del día laboral (${toAmPmLabel(taskStartTime)} + ${taskDurationMin} min).`);
        }

        for (const member of selectedStaffMembers) {
          const jornadas = staffJornadasByStaffId[member.id] ?? [];

          for (const dayName of relevantDays) {
            const dayKey = normalizeDayLabel(dayName);
            const jornadasDelDia = jornadas.filter((item) => normalizeDayLabel(item.diaSemana) === dayKey);

            if (jornadasDelDia.length === 0) {
              blockingWarnings.push(`${staffLabel(member)} no tiene jornada registrada para ${dayName}.`);
              continue;
            }

            const fitsInAnySlot = jornadasDelDia.some((slot) => {
              const entryMin = parseTimeToMinutes(slot.horaEntrada);
              const exitMin = parseTimeToMinutes(slot.horaSalida);
              if (entryMin === null || exitMin === null) {
                return false;
              }

              return taskStartMin >= entryMin && taskEndMin <= exitMin;
            });

            if (!fitsInAnySlot) {
              const jornadaTexto = jornadasDelDia
                .map((slot) => `${toAmPmLabel(slot.horaEntrada)} - ${toAmPmLabel(slot.horaSalida)}`)
                .join(" / ");
              const finalLabel = `${String(Math.floor(taskEndMin / 60)).padStart(2, "0")}:${String(taskEndMin % 60).padStart(2, "0")}`;
              blockingWarnings.push(
                `${staffLabel(member)} (${dayName}) trabaja en ${jornadaTexto}. La tarea quedaría de ${toAmPmLabel(taskStartTime)} a ${toAmPmLabel(finalLabel)}.`,
              );
            }
          }
        }
      }

      if (blockingWarnings.length > 0) {
        setBusyAction(null);
        const preview = blockingWarnings.slice(0, 8).map((line) => `• ${line}`).join("\n");
        const extra = blockingWarnings.length > 8 ? `\n\nY ${blockingWarnings.length - 8} advertencia(s) más.` : "";
        setNotice({ kind: "error", text: `No se puede crear la tarea debido a las siguientes incompatibilidades de jornada:\n\n${preview}${extra}` });
        return false;
      }

      if (softWarnings.length > 0) {
        const warningPreview = softWarnings.slice(0, 8).map((line) => `• ${line}`).join("\n");
        const extraText = softWarnings.length > 8 ? `\n\nY ${softWarnings.length - 8} advertencia(s) más.` : "";
        const proceed = await confirmToast(
          `Alerta: se detectó que esta asignación puede quedar fuera de horario laboral.\n\n${warningPreview}${extraText}\n\n¿Deseas continuar de todos modos?`,
          {
            title: "Advertencia de horario",
            confirmLabel: "Continuar",
          },
        );

        if (!proceed) {
          setBusyAction(null);
          return false;
        }
      }

      const basePayload = {
        nombre,
        tipo: catalogForm.tipo || DEFAULT_CATALOG_TASK_TYPE,
        modoAsignacion: catalogForm.modoAsignacion || DEFAULT_CATALOG_ASSIGNMENT_MODE,
        programacionRecurrente: catalogForm.programacionRecurrente,
        cantidadPersonal,
        habilidadesRequeridasIds: catalogForm.habilidadesRequeridasIds,
        requerimientos: catalogForm.requerimientos,
        staffAsignadosIds: effectiveStaffIds,
        diasSemana: Array.from(new Set(catalogForm.diasSemana)).sort((left, right) => left - right),
        horaProgramada:
          (catalogForm.tipo || DEFAULT_CATALOG_TASK_TYPE) === "Recurrente" && catalogForm.programacionRecurrente === "programada"
            ? catalogForm.horaProgramada
            : null,
        fechaEsporadica: null,
        horaEsporadica: null,
        requiereFinalizacion: catalogForm.requiereFinalizacion,
        tareaFinalizacion: catalogForm.requiereFinalizacion ? catalogForm.tareaFinalizacion.trim() : null,
        fechaFinalizacion: catalogForm.requiereFinalizacion ? catalogForm.fechaFinalizacion : null,
        horaFinalizacion: catalogForm.requiereFinalizacion ? catalogForm.horaFinalizacion : null,
        tiempoEstimadoMin,
      };

      let createdCount = 1;

      if (isEditing && editingCatalogId) {
        await fetchApiJson<{ message: string; id: string }>(`/api/tasks/catalog/${editingCatalogId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...basePayload,
            sector: catalogForm.sector.trim(),
          }),
        });
      } else {
        const sectorsToCreate = Array.from(
          new Set(selectedCatalogLocations.map((sector) => sector.trim()).filter((sector) => sector.length > 0)),
        );

        const hasFixedStartTime =
          (catalogForm.tipo === "Recurrente" && catalogForm.programacionRecurrente === "programada" && Boolean(catalogForm.horaProgramada)) ||
          (catalogForm.tipo === "Esporadica" && Boolean(catalogForm.horaEsporadica));

        const baseStartTime = catalogForm.tipo === "Recurrente" ? catalogForm.horaProgramada : catalogForm.horaEsporadica;
        const baseStartMin = hasFixedStartTime && baseStartTime ? parseTimeToMinutes(baseStartTime) : null;

        const sequentialSchedule = sectorsToCreate.map((sector, index) => {
          if (baseStartMin === null) {
            return { sector, start: null as string | null, end: null as string | null };
          }

          const startMin = baseStartMin + index * tiempoEstimadoMin;
          const endMin = startMin + tiempoEstimadoMin;
          return {
            sector,
            start: minutesToHHMM(startMin),
            end: minutesToHHMM(endMin),
          };
        });

        if (baseStartMin !== null && sectorsToCreate.length > 1) {
          const totalEnd = baseStartMin + sectorsToCreate.length * tiempoEstimadoMin;
          if (totalEnd > 24 * 60) {
            setBusyAction(null);
            setNotice({
              kind: "error",
              text: "No alcanza el día para encadenar todas las tareas seleccionadas. Ajusta hora inicial, duración o reduce lugares.",
            });
            return false;
          }

          const previewLines = sequentialSchedule
            .map((item) => `• ${item.sector}: ${toAmPmLabel(item.start ?? "")} - ${toAmPmLabel(item.end ?? "")}`)
            .join("\n");

          const confirmSequential = await confirmToast(
            `Se detectaron ${sectorsToCreate.length} lugares.\n\nSe programarán automáticamente una detrás de otra con esta secuencia:\n${previewLines}\n\n¿Deseas crear el catálogo con estos horarios?`,
            {
              title: "Programación secuencial",
              confirmLabel: "Crear",
            },
          );

          if (!confirmSequential) {
            setBusyAction(null);
            return false;
          }
        }

        for (const [index, sector] of sectorsToCreate.entries()) {
          let adjustedHoraProgramada: string | null = basePayload.horaProgramada;
          let adjustedHoraEsporadica: string | null = basePayload.horaEsporadica;

          if (baseStartMin !== null) {
            const shiftedStart = minutesToHHMM(baseStartMin + index * tiempoEstimadoMin);
            if (catalogForm.tipo === "Recurrente") {
              adjustedHoraProgramada = shiftedStart;
            } else if (catalogForm.tipo === "Esporadica") {
              adjustedHoraEsporadica = shiftedStart;
            }
          }

          await fetchApiJson<{ message: string; id?: string; ids?: string[] }>("/api/tasks/catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...basePayload,
              horaProgramada: adjustedHoraProgramada,
              horaEsporadica: adjustedHoraEsporadica,
              sector,
            }),
          });
        }

        createdCount = sectorsToCreate.length;
      }
      setCatalogForm((current) => ({
        ...current,
        nombre: "",
        tipo: "",
        sector: "",
        modoAsignacion: "",
        programacionRecurrente: "",
        cantidadPersonal: "1",
        habilidadesRequeridasIds: [],
        requerimientos: [],
        staffAsignadosIds: [],
        diasSemana: [1, 2, 3, 4, 5],
        horaProgramada: "08:00",
        fechaEsporadica: new Date().toISOString().slice(0, 10),
        horaEsporadica: "08:00",
        requiereFinalizacion: false,
        tareaFinalizacion: "",
        fechaFinalizacion: new Date().toISOString().slice(0, 10),
        horaFinalizacion: "09:00",
        tiempoEstimadoMin: "25",
      }));
      setSelectedCatalogLocations([]);
      setRequirementDraft("");
      setEditingCatalogId(null);
      setNotice({
        kind: "success",
        text: isEditing
          ? "Tarea de catalogo actualizada correctamente."
          : createdCount > 1
            ? `Tareas de catalogo creadas correctamente (${createdCount}).`
            : "Tarea de catalogo creada correctamente.",
      });
      await refresh();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la tarea de catalogo.";
      setNotice({ kind: "error", text: message });
      setCatalogSubmitErrorModalMessage(message);
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const beginEditCatalog = (task: TaskCatalogItem, overrides?: Partial<CatalogFormState>) => {
    setEditingCatalogId(task.id);

    const baseForm: CatalogFormState = {
      nombre: task.nombre,
      tipo: DEFAULT_CATALOG_TASK_TYPE,
      sector: task.sector,
      modoAsignacion: DEFAULT_CATALOG_ASSIGNMENT_MODE,
      programacionRecurrente: "programada",
      cantidadPersonal: String(task.cantidadPersonal),
      habilidadesRequeridasIds: task.habilidadesRequeridasIds,
      requerimientos: task.requerimientos,
      staffAsignadosIds: task.staffAsignadosIds,
      diasSemana: [...task.diasSemana],
      horaProgramada: task.horaProgramada ?? "08:00",
      fechaEsporadica: task.fechaEsporadica ?? new Date().toISOString().slice(0, 10),
      horaEsporadica: task.horaEsporadica ?? "08:00",
      requiereFinalizacion: task.requiereFinalizacion,
      tareaFinalizacion: task.tareaFinalizacion ?? "",
      fechaFinalizacion: task.fechaFinalizacion ?? new Date().toISOString().slice(0, 10),
      horaFinalizacion: task.horaFinalizacion ?? "09:00",
      tiempoEstimadoMin: String(task.tiempoEstimadoMin),
    };

    const merged = overrides ? { ...baseForm, ...overrides } : baseForm;

    setCatalogForm(merged);
    setSelectedCatalogLocations([merged.sector || task.sector]);
    setRequirementDraft("");
    setNotice(null);
  };

  const cancelEditCatalog = () => {
    setEditingCatalogId(null);
    setSelectedCatalogLocations([]);
    setCatalogForm((current) => ({
      ...current,
      nombre: "",
      tipo: DEFAULT_CATALOG_TASK_TYPE,
      sector: "",
      modoAsignacion: DEFAULT_CATALOG_ASSIGNMENT_MODE,
      programacionRecurrente: "programada",
      cantidadPersonal: "1",
      habilidadesRequeridasIds: [],
      requerimientos: [],
      staffAsignadosIds: [],
      diasSemana: [1, 2, 3, 4, 5],
      horaProgramada: "08:00",
      fechaEsporadica: new Date().toISOString().slice(0, 10),
      horaEsporadica: "08:00",
      requiereFinalizacion: false,
      tareaFinalizacion: "",
      fechaFinalizacion: new Date().toISOString().slice(0, 10),
      horaFinalizacion: "09:00",
      tiempoEstimadoMin: "25",
    }));
    setRequirementDraft("");
  };

  const deleteCatalog = async (catalogId: string) => {
    if (!(await confirmToast("¿Estás seguro de que deseas eliminar esta tarea del catálogo?", {
      title: "Eliminar catálogo",
      confirmLabel: "Eliminar",
    }))) {
      return;
    }

    try {
      setBusyAction(`catalog-delete-${catalogId}`);
      setDeletingCatalogId(catalogId);
      await fetchApiJson<{ message: string; id: string }>(`/api/tasks/catalog/${catalogId}`, {
        method: "DELETE",
      });
      if (editingCatalogId === catalogId) {
        cancelEditCatalog();
      }
      setNotice({ kind: "success", text: "Tarea de catálogo eliminada correctamente." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo eliminar la tarea de catálogo." });
    } finally {
      setDeletingCatalogId(null);
      setBusyAction(null);
    }
  };

  const removeScheduleTask = async (task: ScheduleTaskItem, staffId: string) => {
    const taskInstance = instances.find((item) => item.id === task.id);
    const taskCatalogId = taskInstance?.tareaCatalogoId ?? task.id;
    const shouldDeleteLinkedCatalog = task.tipo === "Recurrente" && task.diasSemana.length > 0;
    const confirmMessage = taskInstance?.asignacionId
      ? "¿Estás seguro de que deseas quitar esta asignación del horario?"
      : shouldDeleteLinkedCatalog
        ? "¿Estás seguro de que deseas eliminar esta tarea recurrente y todos sus días vinculados?"
        : "¿Estás seguro de que deseas quitar esta tarea predefinida de este trabajador?";

    if (!(await confirmToast(confirmMessage, {
      title: "Quitar tarea",
      confirmLabel: "Quitar",
    }))) {
      return;
    }

    try {
      setBusyAction("schedule-remove");

      if (taskInstance?.asignacionId) {
        await fetchApiJson<{ message: string; asignacionId: string; tareaInstanciaId: string }>(`/api/tasks/assignments/${taskInstance.asignacionId}`, {
          method: "DELETE",
        });
      } else if (shouldDeleteLinkedCatalog) {
        await fetchApiJson<{ message: string; id: string }>(`/api/tasks/catalog/${taskCatalogId}`, {
          method: "DELETE",
        });
      } else {
        await fetchApiJson<{ message: string; tareaCatalogoId: string; staffId: string }>(`/api/tasks/catalog/${taskCatalogId}/staff/${staffId}`, {
          method: "DELETE",
        });
      }

      setNotice({ kind: "success", text: "La tarea fue quitada correctamente." });
      setSelectedScheduleCell(null);
      await refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudo quitar la tarea asignada.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const submitTaskSpace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nombre = spaceName.trim();
    if (!nombre) {
      setNotice({ kind: "error", text: "Escribe un nombre para el nuevo espacio." });
      return;
    }

    try {
      setBusyAction("space-create");
      await fetchApiJson<{ message: string; id: string }>("/api/tasks/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });

      setSpaceName("");
      setNotice({ kind: "success", text: "Espacio creado correctamente." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo crear el espacio." });
    } finally {
      setBusyAction(null);
    }
  };

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reviewForm.asignacionId || !reviewForm.monitorId) {
      setNotice({ kind: "error", text: "Selecciona una asignacion y un monitor." });
      return;
    }

    try {
      setBusyAction("task-review");
      await fetchApiJson<{ message: string; tareaInstanciaId: string; estado: string }>(`/api/tasks/assignments/${reviewForm.asignacionId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monitorId: reviewForm.monitorId,
          decision: reviewForm.decision,
          observacionesRevision: reviewForm.observacionesRevision.trim() || null,
          rechazoEstado: reviewForm.rechazoEstado,
        }),
      });
      setNotice({
        kind: "success",
        text: reviewForm.decision === "aprobar" ? "Tarea aprobada." : "Tarea enviada a correccion.",
      });
      setReviewForm((current) => ({
        ...current,
        observacionesRevision: "",
      }));
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo revisar la tarea." });
    } finally {
      setBusyAction(null);
    }
  };

  const startTask = async (assignmentId: string) => {
    try {
      setBusyAction(`start-${assignmentId}`);
      await fetchApiJson<{ message: string }>(`/api/tasks/assignments/${assignmentId}/start`, {
        method: "PATCH",
      });
      setNotice({ kind: "success", text: "La tarea paso a En Progreso." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo iniciar la tarea." });
    } finally {
      setBusyAction(null);
    }
  };

  const sendToReview = async (assignmentId: string) => {
    try {
      setBusyAction(`review-${assignmentId}`);
      await fetchApiJson<{ message: string }>(`/api/tasks/assignments/${assignmentId}/send-review`, {
        method: "PATCH",
      });
      setNotice({ kind: "success", text: "La tarea paso a revision." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo enviar a revision." });
    } finally {
      setBusyAction(null);
    }
  };

  const reviewableCount = reviewQueue.length;
  const linkedSkillsCount = staffSkills.length;
  const selectChevronStyle = {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23566166' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "left 0.7rem center",
    backgroundSize: "16px 16px",
    paddingLeft: "2.25rem",
  } as const;
  const primaryButtonClass =
    "inline-flex items-center gap-2 rounded-md bg-[#3a5f94] px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-white uppercase transition-transform hover:brightness-110 disabled:opacity-60";
  const visibleTaskSubtabs: TasksSubtab[] = isLimitedTaskAccess ? ["horario"] : ["horario", "tareas-creadas", "lugares"];

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
          <div className="flex flex-col gap-2 bg-[linear-gradient(180deg,#f7f9fb_0%,#eef3f8_100%)] px-5 py-4 sm:px-6">
            <div className="max-w-3xl space-y-1">
              <p className="text-[9px] font-black tracking-[0.34em] text-slate-500 uppercase">Inteligencia Institucional</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Centro de Control de Tareas</h1>
              <p className="max-w-2xl text-xs leading-5 text-slate-600">
                Tareas reales, habilidades reales y revisiones trazables.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(42,52,57,0.06)] sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {visibleTaskSubtabs.map((subtab) => (
              <button
                key={subtab}
                type="button"
                onClick={() => setTasksSubtab(subtab)}
                className={`rounded-md px-4 py-2 text-[11px] font-bold tracking-[0.18em] uppercase transition ${
                  tasksSubtab === subtab
                    ? "bg-[#3a5f94] text-white shadow-sm"
                    : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {subtab === "horario" ? "Horario" : subtab === "tareas-creadas" ? "Tareas Creadas" : "Lugares"}
              </button>
            ))}

          </div>
        </section>

        {tasksSubtab === "gestion" ? (
        <section className="grid gap-5">

            <form onSubmit={submitCatalog} className="rounded-xl border border-[#d5e3ff] bg-white p-4 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-1.5 text-[#3a5f94] text-xl">category</span>
              <div>
                <p className="text-[9px] font-bold tracking-[0.26em] text-slate-500 uppercase">Catálogo</p>
                <h2 className="text-base font-black text-slate-900">{editingCatalogId ? "Editar tarea" : "Crear Tarea"}</h2>
              </div>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <label className="block space-y-0.5 sm:col-span-2 lg:col-span-4">
                <span className="text-xs font-bold text-slate-500">Nombre</span>
                <input
                  value={catalogForm.nombre}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, nombre: event.target.value }))}
                  className="w-full rounded-md border-none bg-[#e8eff3] px-2 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                  placeholder="Limpieza general del bloque norte"
                />
              </label>

              

              {editingCatalogId ? (
                <label className="block space-y-1 sm:col-span-2 lg:col-span-6">
                  <span className="text-xs font-bold text-slate-500">Lugar de la tarea</span>
                  <select
                    style={selectChevronStyle}
                    value={catalogForm.sector}
                    onChange={(event) => setCatalogForm((current) => ({ ...current, sector: event.target.value }))}
                    className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                  >
                    <option value="">Aún no seleccionado</option>
                    {taskLocationOptions.map((location) => (
                      <option key={location.id} value={location.nombre}>
                        {location.nombre}{location.source === "salon" ? " (Salón)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2 lg:col-span-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">Lugares de la tarea</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {selectedCatalogLocations.length} seleccionados
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogLocations(taskLocationOptions.map((location) => location.nombre))}
                      disabled={loadingTaskLocations}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-600 uppercase transition hover:bg-slate-50"
                    >
                      Seleccionar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogLocations([])}
                      disabled={loadingTaskLocations}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-600 uppercase transition hover:bg-slate-50"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto pr-1">
                    {loadingTaskLocations ? (
                      <p className="text-[11px] font-semibold text-slate-500">Cargando lugares...</p>
                    ) : taskLocationOptions.length === 0 ? (
                      <p className="text-[11px] text-slate-500">No hay lugares disponibles para seleccionar.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {taskLocationOptions.map((location) => {
                          const checked = selectedCatalogLocations.includes(location.nombre);
                          return (
                            <label key={location.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCatalogLocation(location.nombre)}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900"
                              />
                              <span>
                                {location.nombre}{location.source === "salon" ? " (Salón)" : ""}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">Se creará una tarea por cada lugar seleccionado.</p>
                </div>
              )}

              <label className="block space-y-1 lg:col-span-2">
                <span className="text-xs font-bold text-slate-500">Tiempo estimado (min)</span>
                <input
                  type="number"
                  min={1}
                  value={catalogForm.tiempoEstimadoMin}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, tiempoEstimadoMin: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>

              

              <label className="block space-y-1 lg:col-span-2">
                <span className="text-xs font-bold text-slate-500">Cantidad de personal</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={catalogForm.cantidadPersonal}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, cantidadPersonal: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>

              <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2 lg:col-span-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500">Habilidades requeridas</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">Filtro de personal</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {skills.map((skill) => {
                    const checked = catalogForm.habilidadesRequeridasIds.includes(skill.id);
                    return (
                      <label key={skill.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const enabled = event.target.checked;
                            setCatalogForm((current) => ({
                              ...current,
                              habilidadesRequeridasIds: enabled
                                ? [...current.habilidadesRequeridasIds, skill.id]
                                : current.habilidadesRequeridasIds.filter((id) => id !== skill.id),
                            }));
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900"
                        />
                        {skill.nombre}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2 lg:col-span-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-sm font-black tracking-[0.08em] text-[#274a83] uppercase">
                    <span className="material-symbols-outlined text-[16px] leading-none">checklist</span>
                    Checklist de subtareas
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">{catalogForm.requerimientos.length} seleccionados</span>
                </div>
                <p className="text-[11px] text-[#335a94]">Estas subtareas son las que debes completar en cada ejecución de la tarea.</p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={requirementDraft}
                    onChange={(event) => setRequirementDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomRequirement();
                      }
                    }}
                    className="min-w-0 flex-1 rounded-md border-none bg-white px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                    placeholder="Agregar subtarea al checklist"
                  />
                  <button
                    type="button"
                    onClick={addCustomRequirement}
                    className="inline-flex items-center justify-center gap-1 rounded-md bg-[#3a5f94] px-3 py-1.5 text-[10px] font-bold text-white uppercase transition-transform hover:brightness-110"
                  >
                    <span className="material-symbols-outlined text-[14px] leading-none">add_circle</span>
                    Agregar
                  </button>
                </div>

                {catalogForm.requerimientos.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Escribe y agrega subtareas para construir el checklist.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {catalogForm.requerimientos.map((item) => (
                      <div key={item} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked
                            readOnly
                            className="h-4 w-4 rounded border-slate-300 text-slate-900"
                          />
                          <span>{item}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeRequirement(item)}
                          className="text-slate-400 transition hover:text-red-600"
                          aria-label={`Eliminar requerimiento ${item}`}
                        >
                          <span className="material-symbols-outlined text-[14px] leading-none">remove_circle</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="block space-y-1 lg:col-span-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                  Modo de asignación de la tarea
                  <span
                    title="Define cómo se asigna la tarea: Manual para elegir a la persona, Automatica para que el sistema proponga según reglas y disponibilidad."
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600"
                  >
                    ?
                  </span>
                </span>
                <select
                  style={selectChevronStyle}
                  value={catalogForm.modoAsignacion}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, modoAsignacion: event.target.value as AssignmentMode | "" }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Aún no seleccionado</option>
                  <option value="manual">Manual</option>
                  <option value="automatica">Automatica</option>
                </select>
              </label>

              {catalogForm.modoAsignacion === "manual" ? (
                <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2 lg:col-span-6">
                  <span className="text-xs font-bold text-slate-500">Personal sugerido para asignación</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {suggestedStaffForManualAssignment.map((person) => {
                      const checked = catalogForm.staffAsignadosIds.includes(person.id);
                      return (
                        <label key={person.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              const enabled = event.target.checked;
                              setCatalogForm((current) => ({
                                ...current,
                                staffAsignadosIds: enabled
                                  ? [...current.staffAsignadosIds, person.id]
                                  : current.staffAsignadosIds.filter((id) => id !== person.id),
                              }));
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900"
                          />
                          {person.cedula ? (
                            <img
                              src={getStaffPhotoUrl(person.cedula)}
                              alt={staffLabel(person)}
                              className="h-7 w-7 shrink-0 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600">
                              {staffInitials(person)}
                            </div>
                          )}
                          <span className="truncate">{staffLabel(person)}</span>
                        </label>
                      );
                    })}
                  </div>
                  {suggestedStaffForManualAssignment.length === 0 ? (
                    <p className="text-[11px] text-amber-700">Sin personal compatible con las habilidades requeridas.</p>
                  ) : null}
                </div>
              ) : null}

              <label className="block space-y-0.5 sm:col-span-2 lg:col-span-2">
                <span className="text-xs font-bold text-slate-500">Tipo de tarea</span>
                <select
                  style={selectChevronStyle}
                  value={catalogForm.tipo}
                  onChange={(event) => {
                    const nextType = event.target.value as TaskType | "";
                    setCatalogForm((current) => ({
                      ...current,
                      tipo: nextType,
                      programacionRecurrente: nextType === "Recurrente" ? "" : current.programacionRecurrente,
                    }));
                  }}
                  className="w-full rounded-md border-none bg-[#e8eff3] px-2 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Aún no seleccionado</option>
                  {(["Recurrente", "Esporadica"] as TaskType[]).map((type) => (
                    <option key={type} value={type}>
                      {taskTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>

              {catalogForm.tipo === "Recurrente" ? (
                <>
                  <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2 lg:col-span-6">
                    <span className="text-xs font-bold text-slate-500">Tipo de recurrencia</span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setCatalogForm((current) => ({ ...current, programacionRecurrente: "programada" }))}
                        className={`flex-1 rounded-md border px-3 py-2.5 text-left text-xs font-semibold transition ${
                          catalogForm.programacionRecurrente === "programada"
                            ? "border-[#3a5f94] bg-[#dce8f7] text-[#23456f] shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          Programada por días y hora
                          <span
                            title="Usa esta opción si la tarea debe ejecutarse en días específicos y a una hora definida, por ejemplo lunes y miércoles a las 07:00."
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600"
                          >
                            ?
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCatalogForm((current) => ({ ...current, programacionRecurrente: "diaria_libre" }))}
                        className={`flex-1 rounded-md border px-3 py-2.5 text-left text-xs font-semibold transition ${
                          catalogForm.programacionRecurrente === "diaria_libre"
                            ? "border-[#3a5f94] bg-[#dce8f7] text-[#23456f] shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          Diaria en cualquier momento
                          <span
                            title="Usa esta opción si la tarea debe hacerse todos los días, pero no necesita una hora exacta."
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600"
                          >
                            ?
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>

                  {catalogForm.programacionRecurrente === "programada" ? (
                    <>
                      <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2 lg:col-span-6">
                        <span className="text-xs font-bold text-slate-500">Dias recurrentes</span>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                          {dayLabels.map((label, dayIndex) => (
                            <label key={label} className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={catalogForm.diasSemana.includes(dayIndex)}
                                onChange={(event) => {
                                  const enabled = event.target.checked;
                                  setCatalogForm((current) => {
                                    const nextDays = enabled
                                      ? Array.from(new Set([...current.diasSemana, dayIndex])).sort((left, right) => left - right)
                                      : current.diasSemana.filter((day) => day !== dayIndex);

                                    return { ...current, diasSemana: nextDays };
                                  });
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-slate-900"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="block max-w-[240px] space-y-1 sm:col-span-2 lg:col-span-2">
                        <span className="text-xs font-bold text-slate-500">Hora recurrente</span>
                        <select
                          value={catalogForm.horaProgramada}
                          onChange={(event) => setCatalogForm((current) => ({ ...current, horaProgramada: event.target.value }))}
                          className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                        >
                          {recurringTimeOptions.map((time) => (
                            <option key={time} value={time}>
                              {toAmPmLabel(time)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                </>
              ) : catalogForm.tipo === "Esporadica" ? (
                <>
                  <label className="block max-w-[240px] space-y-1 lg:col-span-1">
                    <span className="text-xs font-bold text-slate-500">Fecha esporádica</span>
                    <input
                      type="date"
                      value={catalogForm.fechaEsporadica}
                      onChange={(event) => setCatalogForm((current) => ({ ...current, fechaEsporadica: event.target.value }))}
                      className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                    />
                  </label>
                  <label className="block max-w-[220px] space-y-1 lg:col-span-1">
                    <span className="text-xs font-bold text-slate-500">Hora esporádica</span>
                    <input
                      type="time"
                      lang="en-US"
                      value={catalogForm.horaEsporadica}
                      onChange={(event) => setCatalogForm((current) => ({ ...current, horaEsporadica: event.target.value }))}
                      className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                    />
                  </label>

                  <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2 lg:col-span-6">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={catalogForm.requiereFinalizacion}
                        onChange={(event) => setCatalogForm((current) => ({ ...current, requiereFinalizacion: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                      Requiere tarea de finalización
                    </label>

                    {catalogForm.requiereFinalizacion ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-xs font-bold text-slate-500">¿Qué tarea de finalización?</span>
                          <input
                            value={catalogForm.tareaFinalizacion}
                            onChange={(event) => setCatalogForm((current) => ({ ...current, tareaFinalizacion: event.target.value }))}
                            className="w-full appearance-none rounded-md border-none bg-white px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                            placeholder="Ej: Verificación final, cierre de inventario, limpieza de cierre"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-bold text-slate-500">Fecha finalización</span>
                          <input
                            type="date"
                            value={catalogForm.fechaFinalizacion}
                            onChange={(event) => setCatalogForm((current) => ({ ...current, fechaFinalizacion: event.target.value }))}
                            className="w-full appearance-none rounded-md border-none bg-white px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-bold text-slate-500">Hora finalización</span>
                          <input
                            type="time"
                            lang="en-US"
                            value={catalogForm.horaFinalizacion}
                            onChange={(event) => setCatalogForm((current) => ({ ...current, horaFinalizacion: event.target.value }))}
                            className="w-full appearance-none rounded-md border-none bg-white px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}

              <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
                <button
                  type="submit"
                  disabled={busyAction === "catalog-create" || busyAction === "catalog-update"}
                  className={`${primaryButtonClass} flex-1 justify-center`}
                >
                  <span className="material-symbols-outlined text-[18px]">{editingCatalogId ? "save" : "add_circle"}</span>
                  {busyAction === "catalog-update"
                    ? "Guardando..."
                    : busyAction === "catalog-create"
                      ? "Creando..."
                      : editingCatalogId
                        ? "Guardar cambios"
                        : "Crear catalogo de tarea"}
                </button>
                {editingCatalogId ? (
                  <button
                    type="button"
                    onClick={cancelEditCatalog}
                    className="rounded-md border border-slate-200 px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-slate-600 uppercase transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          {showCatalogValidationModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined rounded-xl bg-amber-100 p-2 text-amber-700">warning</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black tracking-[0.26em] text-amber-600 uppercase">Validación requerida</p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Faltan campos por completar</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Antes de crear el catálogo revisa estos campos:
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-amber-50 p-4">
                  <ul className="space-y-2">
                    {missingCatalogFields.map((field) => (
                      <li key={field} className="flex items-start gap-2 text-sm text-amber-900">
                        <span className="mt-1 text-amber-600">•</span>
                        <span>{field}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCatalogValidationModal(false)}
                    className="rounded-md border border-slate-200 px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-slate-600 uppercase transition hover:bg-slate-50"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {catalogSubmitErrorModalMessage ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined rounded-xl bg-rose-100 p-2 text-rose-700">error</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black tracking-[0.26em] text-rose-600 uppercase">No se pudo guardar</p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Error al crear/editar catálogo</h3>
                    <p className="mt-1 text-sm text-slate-600">Revisa el detalle para corregir y volver a intentar.</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-rose-50 p-4">
                  <p className="text-sm text-rose-900">{catalogSubmitErrorModalMessage}</p>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setCatalogSubmitErrorModalMessage(null)}
                    className="rounded-md border border-slate-200 px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-slate-600 uppercase transition hover:bg-slate-50"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {assignmentScheduleWarningMessage ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined rounded-xl bg-amber-100 p-2 text-amber-700">warning</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black tracking-[0.26em] text-amber-600 uppercase">Alerta de horario</p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Asignación fuera de jornada</h3>
                    <p className="mt-1 text-sm text-slate-600">Esta asignación puede quedar fuera del horario laboral de la colaboradora.</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-amber-50 p-4">
                  <p className="text-sm text-amber-900">{assignmentScheduleWarningMessage}</p>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentScheduleWarningMessage(null);
                      setPendingAssignmentPayload(null);
                    }}
                    className="rounded-md border border-slate-200 px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-slate-600 uppercase transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const payload = pendingAssignmentPayload;
                      setAssignmentScheduleWarningMessage(null);
                      setPendingAssignmentPayload(null);
                      if (!payload) return;

                      try {
                        setBusyAction("task-assign");
                        await fetchApiJson<{ message: string; asignacionId: string }>("/api/tasks/assignments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        setNotice({ kind: "success", text: "Tarea asignada correctamente." });
                        await refresh();
                      } catch (error) {
                        setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo asignar la tarea." });
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="rounded-md bg-[#3a5f94] px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-white uppercase transition hover:brightness-110"
                  >
                    Continuar de todos modos
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
        ) : null}

        {tasksSubtab === "gestion" ? (
        <section className="grid gap-4">
          <div>
          <form onSubmit={submitReview} className="rounded-xl border border-[#d3e4fe] bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-2 text-[#3a5f94]">fact_check</span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Revision</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Quality Review</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Asignacion</span>
                <select
                  style={selectChevronStyle}
                  value={reviewForm.asignacionId}
                  onChange={(event) => setReviewForm((current) => ({ ...current, asignacionId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Selecciona una asignacion</option>
                  {instances
                    .filter((task) => task.asignacionId)
                    .map((task) => (
                      <option key={task.asignacionId ?? task.id} value={task.asignacionId ?? ""}>
                        {task.tareaNombre} · {task.estado} · {task.staffAsignadoNombre ?? "Sin staff"}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Monitor revisor</span>
                <select
                  style={selectChevronStyle}
                  value={reviewForm.monitorId}
                  onChange={(event) => setReviewForm((current) => ({ ...current, monitorId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Selecciona un monitor</option>
                  {staff
                    .filter((person) => person.roleId === 1 || person.roleId === 2)
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {staffLabel(person)}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Decisión</span>
                <select
                  style={selectChevronStyle}
                  value={reviewForm.decision}
                  onChange={(event) => setReviewForm((current) => ({ ...current, decision: event.target.value as "aprobar" | "rechazar" }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="aprobar">Aprobar</option>
                  <option value="rechazar">Rechazar</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Estado al rechazar</span>
                <select
                  style={selectChevronStyle}
                  value={reviewForm.rechazoEstado}
                  onChange={(event) => setReviewForm((current) => ({ ...current, rechazoEstado: event.target.value as "Corregir" | "Rechazada" }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="Corregir">Corregir</option>
                  <option value="Rechazada">Rechazada</option>
                </select>
              </label>

              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Observaciones</span>
                <textarea
                  value={reviewForm.observacionesRevision}
                  onChange={(event) => setReviewForm((current) => ({ ...current, observacionesRevision: event.target.value }))}
                  rows={3}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                  placeholder="Motivo de rechazo, confirmacion o notas del monitor..."
                />
              </label>

              <button
                type="submit"
                disabled={busyAction === "task-review"}
                className={`${primaryButtonClass} justify-center sm:col-span-2`}
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                {busyAction === "task-review" ? "Aplicando..." : "Aplicar revision"}
              </button>
            </div>
          </form>
          </div>
        </section>
        ) : null}

        {tasksSubtab === "habilidades" ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <form onSubmit={submitSkill} className="rounded-xl border border-[#d3e4fe] bg-white p-4 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-1.5 text-[#3a5f94] text-xl">psychology</span>
              <div>
                <p className="text-[9px] font-bold tracking-[0.26em] text-slate-500 uppercase">Habilidades</p>
                <h2 className="text-base font-black text-slate-900">Matriz</h2>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Nombre</span>
                <input
                  value={skillName}
                  onChange={(event) => setSkillName(event.target.value)}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-2 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>
              <button
                type="submit"
                disabled={busyAction === "skill-create"}
                className="w-full rounded-md bg-[#3a5f94] px-3 py-1.5 text-[10px] font-bold text-white uppercase transition-transform hover:brightness-110 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                {busyAction === "skill-create" ? "Guardando..." : "Crear habilidad"}
              </button>
            </div>
          </form>

          <section className="rounded-xl border border-[#d3e4fe] bg-white p-4 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-1.5 text-[#3a5f94] text-xl">list</span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Listado</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Ver y editar habilidades</h2>
              </div>
            </div>

            <div className="mt-5 max-h-64 space-y-2 overflow-y-auto pr-1">
              {skills.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Aun no hay habilidades registradas.
                </div>
              ) : (
                skills.map((skill) => (
                  <div key={skill.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{skill.nombre}</p>
                      <p className="text-[11px] text-slate-500">{staffSkills.filter((link) => link.habilidadId === skill.id).length} staff vinculados</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => beginEditSkill(skill)}
                        className="rounded-md bg-[#3a5f94] px-3 py-2 text-[11px] font-bold tracking-[0.18em] text-white uppercase transition hover:brightness-110"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSkill(skill.id)}
                        disabled={deletingSkillId === skill.id || busyAction?.startsWith("skill-delete-")}
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold tracking-[0.18em] text-red-600 uppercase transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingSkillId === skill.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitSkillEdit} className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold tracking-[0.24em] text-slate-500 uppercase">Edición</p>
              <div className="mt-2 space-y-1.5">
                <label className="block space-y-0.5">
                  <span className="text-xs font-bold text-slate-500">Nombre</span>
                  <input
                    value={editingSkillName}
                    onChange={(event) => setEditingSkillName(event.target.value)}
                    disabled={!editingSkillId}
                    className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder={editingSkillId ? "Escribe el nuevo nombre" : "Selecciona una habilidad para editar"}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!editingSkillId || busyAction?.startsWith("skill-edit-")}
                    className={`${primaryButtonClass} flex-1 justify-center`}
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    {editingSkillId && busyAction === `skill-edit-${editingSkillId}` ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditSkill}
                    disabled={!editingSkillId}
                    className="rounded-md border border-slate-200 px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-slate-600 uppercase transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </section>
        </section>
        ) : null}

        {tasksSubtab === "lugares" ? (
        <section>
          <section className="rounded-xl border border-[#d3e4fe] bg-white p-4 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-1.5 text-[#3a5f94] text-xl">meeting_room</span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Espacios</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Lugares de tareas</h2>
              </div>
            </div>

            <form onSubmit={submitTaskSpace} className="mt-4 space-y-2">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Nuevo espacio personalizado</span>
                <input
                  value={spaceName}
                  onChange={(event) => setSpaceName(event.target.value)}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>
              <button
                type="submit"
                disabled={busyAction === "space-create"}
                className="w-full rounded-md bg-[#3a5f94] px-3 py-1.5 text-[10px] font-bold text-white uppercase transition-transform hover:brightness-110 disabled:opacity-60"
              >
                {busyAction === "space-create" ? "Creando..." : "Crear espacio"}
              </button>
            </form>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {taskSpaces.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Aun no hay lugares registrados.
                </div>
              ) : (
                taskSpaces.map((space) => (
                  <div key={space.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{space.nombre}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => beginEditTaskSpace(space)}
                        className="rounded-md bg-[#3a5f94] px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-white uppercase transition hover:brightness-110"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTaskSpace(space.id)}
                        disabled={deletingSpaceId === space.id || busyAction === `space-delete-${space.id}`}
                        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-red-600 uppercase transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingSpaceId === space.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitTaskSpaceEdit} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-bold tracking-[0.24em] text-slate-500 uppercase">Editar lugar</p>
              <div className="mt-2 space-y-1.5">
                <label className="block space-y-0.5">
                  <span className="text-xs font-bold text-slate-500">Nombre</span>
                  <input
                    value={editingSpaceName}
                    onChange={(event) => setEditingSpaceName(event.target.value)}
                    disabled={!editingSpaceId}
                    className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder={editingSpaceId ? "Escribe el nuevo nombre" : "Selecciona un lugar para editar"}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!editingSpaceId || busyAction?.startsWith("space-edit-")}
                    className={`${primaryButtonClass} flex-1 justify-center`}
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    {editingSpaceId && busyAction === `space-edit-${editingSpaceId}` ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditTaskSpace}
                    disabled={!editingSpaceId}
                    className="rounded-md border border-slate-200 px-4 py-2 text-[11px] font-bold tracking-[0.18em] text-slate-600 uppercase transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </section>
        </section>
        ) : null}

        {tasksSubtab === "tareas-creadas" ? (
        <section>
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#f0f4f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Catálogo activo</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Tareas definidas</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                {filteredCatalog.length} tareas
              </span>
            </div>
            <div className="grid gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:grid-cols-3">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">Buscar</span>
                <input
                  value={catalogSearchQuery}
                  onChange={(event) => setCatalogSearchQuery(event.target.value)}
                  placeholder="Nombre, ID o sector"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-[#3a5f94] focus:bg-white focus:outline-none"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">Tipo</span>
                <select
                  style={selectChevronStyle}
                  value={catalogTypeFilter}
                  onChange={(event) => setCatalogTypeFilter(event.target.value as TaskType | "todos")}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-[#3a5f94] focus:bg-white focus:outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="Recurrente">Recurrente</option>
                  <option value="Esporadica">Esporadica</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">Sector</span>
                <select
                  style={selectChevronStyle}
                  value={catalogSectorFilter}
                  onChange={(event) => setCatalogSectorFilter(event.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-[#3a5f94] focus:bg-white focus:outline-none"
                >
                  <option value="todos">Todos</option>
                  {catalogSectorOptions.map((sector) => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    setCatalogSearchQuery("");
                    setCatalogTypeFilter("todos");
                    setCatalogSectorFilter("todos");
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold tracking-[0.16em] text-slate-600 uppercase transition hover:bg-slate-100"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Nombre</th>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Tipo</th>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Sector</th>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Habilidades</th>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Checklist</th>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Tiempo</th>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Asignación</th>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Programación</th>
                    <th className="px-3 py-2 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCatalog.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500">
                        No hay tareas que coincidan con los filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredCatalog.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5">
                          <p className="text-sm font-bold text-slate-900">{task.nombre}</p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{task.tipo}</td>
                        <td className="px-3 py-2.5 text-slate-600">{task.sector}</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {task.habilidadesRequeridasIds.length > 0
                            ? task.habilidadesRequeridasIds.map((skillId) => skillById.get(skillId)?.nombre ?? skillId).join(", ")
                            : "Sin requisito"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {task.requerimientos.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {task.requerimientos.map((item) => (
                                <span key={item} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "Sin checklist"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{task.tiempoEstimadoMin} min</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {assignmentModeLabels[task.modoAsignacion]} · {task.cantidadPersonal} persona(s)
                          <p className="mt-1 text-xs text-slate-500">
                            Personal: {(task.staffAsignadosIds ?? []).length > 0
                              ? (task.staffAsignadosIds ?? []).map((staffId) => staff.find((person) => person.id === staffId)).filter((value): value is StaffItem => Boolean(value)).map((person) => staffLabel(person)).join(", ")
                              : "Sin lista predefinida"}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {task.tipo === "Recurrente"
                            ? task.horaProgramada && task.diasSemana.length > 0
                              ? `${task.diasSemana.map((day) => dayLabels[day] ?? day).join("/")} ${task.horaProgramada}`
                              : "Diaria en cualquier momento"
                            : `${task.fechaEsporadica ?? "Sin fecha"}${task.horaEsporadica ? ` ${task.horaEsporadica}` : ""}`}
                          {task.requiereFinalizacion ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Finalización: {task.tareaFinalizacion ?? "(sin detalle)"} · {task.fechaFinalizacion ?? "sin fecha"} {task.horaFinalizacion ?? ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => beginEditCatalog(task)}
                              className="rounded-md bg-[#3a5f94] px-3 py-2 text-[10px] font-bold tracking-[0.18em] text-white uppercase transition hover:brightness-110"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteCatalog(task.id)}
                              disabled={deletingCatalogId === task.id || busyAction === `catalog-delete-${task.id}`}
                              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold tracking-[0.18em] text-red-600 uppercase transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingCatalogId === task.id ? "Eliminando..." : "Eliminar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </section>
        ) : null}

        {tasksSubtab === "horario" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(42,52,57,0.06)] sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Previsualización tipo EXCEL</p>
              <h3 className="mt-0.5 text-sm font-black text-slate-900">Horario con tareas asignadas</h3>
              <p className="mt-1 text-[11px] text-slate-500">Los trabajadores se agrupan por mañana, tarde y noche. Los huecos libres se marcan como DISPONIBLE.</p>
              {isLimitedTaskAccess ? (
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Vista de solo lectura para tu usuario.</p>
              ) : null}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <label className="w-full sm:w-72">
                <span className="sr-only">Buscar trabajador</span>
                <input
                  type="search"
                  value={scheduleSearchQuery}
                  onChange={(event) => setScheduleSearchQuery(event.target.value)}
                  placeholder="Buscar por nombre..."
                  className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                />
              </label>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {filteredPreviewStaffCount} trabajador(es)
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {isLimitedTaskAccess && visibleStaff.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                No se encontró el usuario asociado a tu sesión para mostrar su horario.
              </div>
            ) : null}
            {filteredSchedulePreviewByShift.map((shiftGroup) => (
              <section key={shiftGroup.id} className="rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Turno</p>
                    <h4 className="text-sm font-black text-slate-900">{shiftGroup.label}</h4>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                    {shiftGroup.workers.length} trabajador(es)
                  </span>
                </div>

                <div className="space-y-2 border-t border-slate-200 p-3">
                  {shiftGroup.workers.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500">
                      No hay trabajadores en este turno con tareas o jornada registrada.
                    </p>
                  ) : (
                    shiftGroup.workers.map((worker) => {
                      return (
                        <div key={worker.staff.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                          <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              {worker.staff.cedula ? (
                                <img
                                  src={getStaffPhotoUrl(worker.staff.cedula)}
                                  alt={staffLabel(worker.staff)}
                                  className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover shadow-sm"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-600 shadow-sm">
                                  {staffInitials(worker.staff)}
                                </div>
                              )}

                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-slate-900">{staffLabel(worker.staff)}</p>
                                <p className="text-[10px] text-slate-500">
                                  {staffRoleLabel(worker.staff)} · {worker.tasks.length} tarea(s) · {shiftGroup.label}
                                </p>
                              </div>
                            </div>

                            <div className="text-right text-[10px] text-slate-600">
                              <div className="font-semibold">{worker.summaryDays || "Sin días asignados"}</div>
                              <div className="mt-1 space-y-0.5">
                                {worker.summaryEntries.length > 0 ? (
                                  worker.summaryEntries.map((entry) => (
                                    <div key={`${worker.staff.id}-${shiftGroup.id}-${entry}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                      {entry}
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                    Sin horario definido
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 p-3">
                            {worker.segments.map((segment, segmentIndex) => {
                              const slotStarts = Array.from({ length: Math.max(0, (segment.end - segment.start) / 30) }, (_, idx) => segment.start + idx * 30);
                              const segmentLabel = `${toAmPmLabel(minutesToHHMM(segment.start))} - ${toAmPmLabel(minutesToHHMM(segment.end))}`;
                              const segmentShiftLabel = getShiftLabel(getShiftForRange(segment.start, segment.end));

                              return (
                                <div key={`${worker.staff.id}-${shiftGroup.id}-segment-${segmentIndex}`} className="rounded-lg border border-slate-200 bg-slate-50">
                                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                                    <div>
                                      <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase">Bloque {segmentIndex + 1} · {segmentShiftLabel}</p>
                                      <p className="text-[11px] font-semibold text-slate-700">{segmentLabel}</p>
                                    </div>
                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm">
                                      {slotStarts.length} franjas
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="min-w-[980px] w-full border-separate border-spacing-0 text-[10px]">
                                      <thead>
                                        <tr>
                                          <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-bold text-slate-600">
                                            Hora
                                          </th>
                                          {PREVIEW_DAY_ORDER.map((dayIndex) => (
                                            <th key={`${worker.staff.id}-${shiftGroup.id}-head-${segmentIndex}-${dayIndex}`} className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center font-bold text-slate-600 last:border-r-0">
                                              {WEEK_DAY_SHORT_LABELS[dayIndex] ?? ""}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {slotStarts.map((slotStart) => {
                                          const slotEnd = slotStart + 30;
                                          const rowLabel = `${toAmPmLabel(minutesToHHMM(slotStart))} - ${toAmPmLabel(minutesToHHMM(slotEnd))}`;

                                          return (
                                            <tr key={`${worker.staff.id}-${shiftGroup.id}-${segmentIndex}-${slotStart}`}>
                                              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-700">
                                                {rowLabel}
                                              </th>
                                              {PREVIEW_DAY_ORDER.map((dayIndex) => {
                                                const cell = worker.matrix[dayIndex]?.[slotStart] ?? { label: "FUERA DE TURNO", status: "off" as const };
                                                const tasksInSlot = cell.status === "task" ? findTasksInSlot(worker.tasks, dayIndex, slotStart) : [];
                                                const isClickable = (cell.status === "task" && tasksInSlot.length > 0) || cell.status === "available";

                                                return (
                                                  <td
                                                    key={`${worker.staff.id}-${shiftGroup.id}-${segmentIndex}-${dayIndex}-${slotStart}`}
                                                    onClick={() => {
                                                        if (canEditTaskSchedule && isClickable) {
                                                        setSelectedScheduleCell({
                                                          staffId: worker.staff.id,
                                                          dayIndex,
                                                          slotStart,
                                                          taskId: tasksInSlot[0]?.id,
                                                        });
                                                      }
                                                    }}
                                                      className={`border-b border-r border-slate-200 px-2 py-2 align-top last:border-r-0 transition-colors ${
                                                        canEditTaskSchedule && isClickable ? "cursor-pointer hover:brightness-95" : "cursor-default"
                                                    } ${
                                                      cell.status === "off"
                                                        ? "bg-slate-100 text-slate-400"
                                                        : cell.status === "break"
                                                          ? "bg-amber-50 text-amber-700"
                                                          : cell.status === "available"
                                                            ? "bg-white text-slate-400"
                                                            : selectedScheduleCell?.staffId === worker.staff.id &&
                                                                selectedScheduleCell?.dayIndex === dayIndex &&
                                                                selectedScheduleCell?.slotStart === slotStart
                                                              ? "bg-[#c5d9f1] text-[#274b7a]"
                                                              : "bg-[#edf5ff] text-[#274b7a]"
                                                    }`}
                                                  >
                                                    <div className="min-h-8 whitespace-normal break-words text-center leading-tight font-semibold">
                                                      {cell.label}
                                                    </div>
                                                  </td>
                                                );
                                              })}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>
        ) : null}

        {tasksSubtab === "horario" && selectedScheduleCell && canEditTaskSchedule ? (
        <div className="fixed bottom-0 right-0 top-0 z-40 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
          {(() => {
            const selectedWorker = filteredSchedulePreviewByShift
              .flatMap((shift) => shift.workers)
              .find((w) => w.staff.id === selectedScheduleCell.staffId);

            if (!selectedWorker) {
              return (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm text-slate-500">Trabajador no encontrado</p>
                </div>
              );
            }

            const tasksInSlot = findTasksInSlot(
              selectedWorker.tasks,
              selectedScheduleCell.dayIndex,
              selectedScheduleCell.slotStart,
            );

            if (tasksInSlot.length === 0) {
              const slotStart = selectedScheduleCell.slotStart;
              const slotEnd = slotStart + 30;
              const rowLabel = `${toAmPmLabel(minutesToHHMM(slotStart))} - ${toAmPmLabel(minutesToHHMM(slotEnd))}`;
              const dayIndex = selectedScheduleCell.dayIndex;

              // Función para validar solapamientos
              const validateNoOverlap = (catalogId: string): string | null => {
                const selectedCatalog = catalog.find((item) => item.id === catalogId);
                if (!selectedCatalog) return null;

                const durationMin = Math.max(1, selectedCatalog.tiempoEstimadoMin);
                const taskEndMin = slotStart + durationMin;

                // Verificar si se solapa con otras tareas del mismo trabajador en el mismo día
                const existingTasks = selectedWorker.tasks.filter(
                  (task) => task.diasSemana && task.diasSemana.includes(dayIndex)
                );

                for (const task of existingTasks) {
                  const taskStartMin = getTaskStartMinutes(task) ?? 0;
                  const taskDurationMin = Math.max(1, task.tiempoEstimadoMin);
                  const taskEnd = taskStartMin + taskDurationMin;

                  // Verificar solapamiento
                  if (!(taskEnd <= slotStart || taskStartMin >= taskEndMin)) {
                    const taskStartTime = minutesToHHMM(taskStartMin);
                    const taskEndTime = calculateEndTimeLabel(taskStartTime, taskDurationMin);
                    return `Solapa con "${task.nombre}" (${taskStartTime} - ${taskEndTime ?? "??:??"})`;
                  }
                }

                return null;
              };

              return (
                <div className="flex flex-col">
                  <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase">Crear Tarea</p>
                      <p className="mt-0.5 text-sm font-black text-slate-900">{WEEK_DAY_SHORT_LABELS[dayIndex]}</p>
                    </div>
                    <button
                      onClick={() => setSelectedScheduleCell(null)}
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();

                      if (scheduleTaskMode === "manual") {
                        const nombre = scheduleManualForm.nombre.trim();
                        const sector = scheduleManualForm.sector.trim();
                        const tiempoEstimadoMin = Number(scheduleManualForm.tiempoEstimadoMin);
                        const diasSemana = Array.from(new Set([...scheduleManualForm.diasSemana, dayIndex])).sort((left, right) => left - right);

                        if (!nombre) {
                          setNotice({ kind: "error", text: "Escribe un nombre para la tarea manual." });
                          return;
                        }

                        if (!sector) {
                          setNotice({ kind: "error", text: "Selecciona un sector o lugar para la tarea manual." });
                          return;
                        }

                        if (!Number.isFinite(tiempoEstimadoMin) || tiempoEstimadoMin < 1) {
                          setNotice({ kind: "error", text: "Ingresa una duración válida mayor a 0." });
                          return;
                        }

                        if (!scheduleManualForm.horaProgramada) {
                          setNotice({ kind: "error", text: "Selecciona una hora programada." });
                          return;
                        }

                        const manualOverlapError = (() => {
                          const existingTasks = selectedWorker.tasks.filter((task) => task.diasSemana && task.diasSemana.includes(dayIndex));
                          const taskEndMin = slotStart + tiempoEstimadoMin;

                          for (const existingTask of existingTasks) {
                            const existingTaskStartMin = getTaskStartMinutes(existingTask) ?? 0;
                            const existingTaskEndMin = existingTaskStartMin + Math.max(1, existingTask.tiempoEstimadoMin);

                            if (!(existingTaskEndMin <= slotStart || existingTaskStartMin >= taskEndMin)) {
                              const taskStartTime = minutesToHHMM(existingTaskStartMin);
                              const taskEndTime = calculateEndTimeLabel(taskStartTime, existingTask.tiempoEstimadoMin);
                              return `Solapa con "${existingTask.nombre}" (${taskStartTime} - ${taskEndTime ?? "??:??"})`;
                            }
                          }

                          return null;
                        })();

                        if (manualOverlapError) {
                          setNotice({ kind: "error", text: `No se puede crear: ${manualOverlapError}` });
                          return;
                        }

                        // Validar que la tarea quepa dentro de la jornada del trabajador seleccionado
                        const taskEndMin = slotStart + tiempoEstimadoMin;
                        const jornadas = staffJornadasByStaffId[selectedWorker.staff.id] ?? [];
                        const fitsJornada = isRangeInsideAnyJornada(dayIndex, slotStart, taskEndMin, jornadas);
                        if (!fitsJornada) {
                          const jornadaTexto = (jornadas
                            .filter((j) => normalizeDayLabel(j.diaSemana) === normalizeDayLabel(weekDayNames[dayIndex]))
                            .map((j) => `${toAmPmLabel(j.horaEntrada)} - ${toAmPmLabel(j.horaSalida)}`)
                            .join(" / ")) || "sin jornada en ese día";

                          setNotice({ kind: "error", text: `No se puede crear: la tarea no cabe en la jornada del trabajador (${jornadaTexto}).` });
                          return;
                        }

                        void (async () => {
                          try {
                            setBusyAction("schedule-instance-create");
                            const createdCatalog = await fetchApiJson<{ message: string; ids: string[] }>("/api/tasks/catalog", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                nombre,
                                tipo: "Recurrente",
                                sector,
                                modoAsignacion: "manual",
                                cantidadPersonal: 1,
                                habilidadesRequeridasIds: [],
                                requerimientos: scheduleManualForm.requerimientos ?? [],
                                programacionRecurrente: "programada",
                                diasSemana,
                                horaProgramada: scheduleManualForm.horaProgramada,
                                fechaEsporadica: null,
                                horaEsporadica: null,
                                requiereFinalizacion: false,
                                tareaFinalizacion: null,
                                fechaFinalizacion: null,
                                horaFinalizacion: null,
                                staffAsignadosIds: [selectedScheduleCell.staffId],
                                tiempoEstimadoMin,
                              }),
                            });

                            const catalogId = createdCatalog.ids?.[0];
                            if (!catalogId) {
                              throw new Error("No se pudo crear la tarea manual.");
                            }

                            setNotice({ kind: "success", text: "Tarea manual creada correctamente." });
                            setSelectedScheduleCell(null);
                            await refresh();
                          } catch (error) {
                            setNotice({
                              kind: "error",
                              text: error instanceof Error ? error.message : "No se pudo crear la tarea manual.",
                            });
                          } finally {
                            setBusyAction(null);
                          }
                        })();

                        return;
                      }

                      const catalogId = (document.getElementById("schedule-task-catalog") as HTMLSelectElement)?.value;
                      if (!catalogId) {
                        setNotice({ kind: "error", text: "Selecciona una tarea del catálogo." });
                        return;
                      }

                      const overlapError = validateNoOverlap(catalogId);
                      if (overlapError) {
                        setNotice({ kind: "error", text: `No se puede crear: ${overlapError}` });
                        return;
                      }

                      void (async () => {
                        try {
                          setBusyAction("schedule-instance-create");
                          const fechaProgramada = getDateForWeekday(dayIndex);
                          const createdInstance = await fetchApiJson<{ message: string; id: string }>("/api/tasks/instances", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              tareaCatalogoId: catalogId,
                              salonId: null,
                              detalleAdicional: null,
                              prioridad: "Media",
                              fechaProgramada,
                              horaProgramada: minutesToHHMM(slotStart),
                              asignacionAutomatica: false,
                            }),
                          });
                          await fetchApiJson<{ message: string; asignacionId: string }>("/api/tasks/assignments", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              tareaInstanciaId: createdInstance.id,
                              staffId: selectedScheduleCell.staffId,
                            }),
                          });
                          setNotice({ kind: "success", text: "Tarea creada correctamente." });
                          setSelectedScheduleCell(null);
                          await refresh();
                        } catch (error) {
                          setNotice({
                            kind: "error",
                            text: error instanceof Error ? error.message : "No se pudo crear la tarea.",
                          });
                        } finally {
                          setBusyAction(null);
                        }
                      })();
                    }}
                    className="space-y-4 px-4 py-4"
                  >
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase">Detalles del Horario</p>
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Trabajador:</span>
                          <span className="font-semibold text-slate-900">{staffLabel(selectedWorker.staff)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Día:</span>
                          <span className="font-semibold text-slate-900">{WEEK_DAY_SHORT_LABELS[dayIndex]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Horario:</span>
                          <span className="font-semibold text-slate-900">{rowLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setScheduleTaskMode("catalog")}
                        className={`flex-1 rounded-md px-3 py-2 text-[11px] font-bold tracking-[0.16em] uppercase transition ${
                          scheduleTaskMode === "catalog"
                            ? "bg-[#3a5f94] text-white shadow-sm"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Catálogo
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleTaskMode("manual")}
                        className={`flex-1 rounded-md px-3 py-2 text-[11px] font-bold tracking-[0.16em] uppercase transition ${
                          scheduleTaskMode === "manual"
                            ? "bg-[#3a5f94] text-white shadow-sm"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        Manual
                      </button>
                    </div>

                    {scheduleTaskMode === "catalog" ? (
                      <div>
                        <label htmlFor="schedule-task-catalog" className="block text-xs font-bold text-slate-600">
                          Selecciona Tarea del Catálogo
                        </label>
                        <select
                          id="schedule-task-catalog"
                          required
                          onChange={(e) => {
                            const catalogId = e.target.value;
                            const overlapError = validateNoOverlap(catalogId);
                            if (overlapError) {
                              setNotice({ kind: "error", text: `Validación: ${overlapError}` });
                              return;
                            }

                            setNotice(null);

                            const task = catalog.find((c) => c.id === catalogId);
                            if (!task) return;

                            // Prefill catalog editor so the user can tweak before creating/assigning
                            beginEditCatalog(task, {
                              cantidadPersonal: "1",
                              horaProgramada: minutesToHHMM(slotStart),
                              diasSemana: task.diasSemana.length > 0 ? task.diasSemana : [dayIndex],
                            });

                            // Show quick editor and open the editing panel for this schedule cell
                            setShowQuickCatalogEditor(true);
                            setSelectedScheduleCell((current) => (current ? { ...current, isEditing: true } : current));
                          }}
                          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#3a5f94] focus:ring-1 focus:ring-[#3a5f94]"
                        >
                          <option value="">-- Selecciona una tarea --</option>
                          {catalog.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.nombre} · {item.sector || "Sin lugar"} ({item.tiempoEstimadoMin} min)
                            </option>
                          ))}
                        </select>

                        {showQuickCatalogEditor && editingCatalogId && selectedScheduleCell?.isEditing ? (
                          <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                            <p className="text-sm font-black text-slate-900">Editor rápido (Catálogo)</p>
                            <label className="block">
                              <span className="text-xs font-bold text-slate-500">Nombre de la tarea</span>
                              <input
                                value={catalogForm.nombre}
                                onChange={(e) => setCatalogForm((c) => ({ ...c, nombre: e.target.value }))}
                                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                              />
                            </label>

                            <label className="block">
                              <span className="text-xs font-bold text-slate-500">Sector/Lugar</span>
                              <select value={catalogForm.sector} onChange={(e) => setCatalogForm((c) => ({ ...c, sector: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                                <option value="">Aún no seleccionado</option>
                                {taskLocationOptions.map((location) => (
                                  <option key={location.id} value={location.nombre}>{location.nombre}</option>
                                ))}
                              </select>
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                              <label>
                                <span className="text-xs font-bold text-slate-500">Duración (min)</span>
                                <input type="number" min={1} value={catalogForm.tiempoEstimadoMin} onChange={(e) => setCatalogForm((c) => ({ ...c, tiempoEstimadoMin: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" />
                              </label>

                              <label>
                                <span className="text-xs font-bold text-slate-500">Hora programada</span>
                                <select value={catalogForm.horaProgramada} onChange={(e) => setCatalogForm((c) => ({ ...c, horaProgramada: e.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm">
                                  {Array.from(new Set([minutesToHHMM(selectedScheduleCell.slotStart), catalogForm.horaProgramada, ...TASK_RECURRENT_TIME_OPTIONS])).map((time) => (
                                    <option key={time} value={time}>{toAmPmLabel(time)}</option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div>
                              <span className="text-xs font-bold text-slate-500">Días de semana</span>
                              <div className="mt-2 grid grid-cols-7 gap-2">
                                {dayLabels.map((label, idx) => (
                                  <label key={label} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                    <input type="checkbox" checked={catalogForm.diasSemana.includes(idx)} onChange={(e) => {
                                      const enabled = e.target.checked;
                                      setCatalogForm((current) => ({
                                        ...current,
                                        diasSemana: enabled ? [...current.diasSemana, idx].sort((a,b)=>a-b) : current.diasSemana.filter(d=>d!==idx),
                                      }));
                                    }} className="h-3.5 w-3.5 rounded" />
                                    <span>{label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500">Checklist de subtareas</span>
                                <span className="text-[11px] font-semibold text-slate-500">{catalogForm.requerimientos.length} seleccionados</span>
                              </div>
                              <div className="grid gap-2">
                                {catalogForm.requerimientos.length === 0 ? (
                                  <p className="text-[11px] text-slate-500">Escribe y agrega subtareas para construir el checklist.</p>
                                ) : (
                                  catalogForm.requerimientos.map((item) => (
                                    <div key={item} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                                      <span>{item}</span>
                                      <button type="button" onClick={() => removeRequirement(item)} className="text-slate-400 hover:text-red-600">✕</button>
                                    </div>
                                  ))
                                )}
                                <div className="flex gap-2">
                                  <input value={requirementDraft} onChange={(e) => setRequirementDraft(e.target.value)} placeholder="Agregar subtarea" className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm" />
                                  <button type="button" onClick={addCustomRequirement} className="rounded-md bg-[#3a5f94] px-3 py-2 text-sm text-white">Agregar</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase">Nombre de la tarea</label>
                          <input
                            type="text"
                            value={scheduleManualForm.nombre}
                            onChange={(event) => setScheduleManualForm((current) => ({ ...current, nombre: event.target.value }))}
                            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                            placeholder="Limpieza general"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase">Sector/Lugar</label>
                          <div className="relative mt-1">
                            {scheduleManualForm.sector ? (
                              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <span className="flex-1 text-sm font-medium text-slate-900">{scheduleManualForm.sector}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setScheduleManualForm((current) => ({ ...current, sector: "" }));
                                    setScheduleManualSectorSearchQuery("");
                                  }}
                                  className="text-slate-400 transition hover:text-slate-600"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={scheduleManualSectorSearchQuery}
                                  onChange={(event) => setScheduleManualSectorSearchQuery(event.target.value)}
                                  placeholder="Buscar lugar..."
                                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                                />
                                {scheduleManualSectorSearchQuery ? (
                                  <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                                    {(() => {
                                      const filtered = taskLocationOptions.filter((location) =>
                                        location.nombre.toLowerCase().includes(scheduleManualSectorSearchQuery.toLowerCase())
                                      );
                                      return filtered.length > 0 ? (
                                        filtered.map((location) => (
                                          <button
                                            key={location.id}
                                            type="button"
                                            onClick={() => {
                                              setScheduleManualForm((current) => ({ ...current, sector: location.nombre }));
                                              setScheduleManualSectorSearchQuery("");
                                            }}
                                            className="w-full px-3 py-2 text-left text-sm transition hover:bg-slate-100"
                                          >
                                            <span className="font-medium text-slate-900">{location.nombre}</span>
                                            <span className="ml-2 text-[10px] text-slate-500">
                                              ({location.source === "espacio" ? "Espacio" : "Salón"})
                                            </span>
                                          </button>
                                        ))
                                      ) : (
                                        <div className="px-3 py-2 text-sm text-slate-500">No hay lugares coincidentes</div>
                                      );
                                    })()}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase">Duración (min)</label>
                            <input
                              type="number"
                              min={1}
                              value={scheduleManualForm.tiempoEstimadoMin}
                              onChange={(event) => setScheduleManualForm((current) => ({ ...current, tiempoEstimadoMin: event.target.value }))}
                              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase">Hora programada</label>
                            <select
                              value={scheduleManualForm.horaProgramada}
                              onChange={(event) => setScheduleManualForm((current) => ({ ...current, horaProgramada: event.target.value }))}
                              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                            >
                              {Array.from(new Set([minutesToHHMM(slotStart), scheduleManualForm.horaProgramada, ...TASK_RECURRENT_TIME_OPTIONS])).map((time) => (
                                <option key={time} value={time}>
                                  {toAmPmLabel(time)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase">Días de semana</label>
                          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                            {dayLabels.map((label, idx) => {
                              const checked = scheduleManualForm.diasSemana.includes(idx);
                              return (
                                <label key={label} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                      const nextDays = event.target.checked
                                        ? [...scheduleManualForm.diasSemana, idx]
                                        : scheduleManualForm.diasSemana.filter((day) => day !== idx);
                                      setScheduleManualForm((current) => ({ ...current, diasSemana: nextDays }));
                                    }}
                                    className="h-3.5 w-3.5 rounded border-slate-300"
                                  />
                                  <span>{label}</span>
                                </label>
                              );
                            })}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-500">El día actual se incluirá automáticamente al guardar.</p>
                        </div>
                        <div className="space-y-3 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2 lg:col-span-6">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-sm font-black tracking-[0.08em] text-[#274a83] uppercase">
                              <span className="material-symbols-outlined text-[16px] leading-none">checklist</span>
                              Checklist de subtareas
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">{(scheduleManualForm.requerimientos ?? []).length} seleccionados</span>
                          </div>
                          <p className="text-[11px] text-[#335a94]">Estas subtareas son las que debes completar en cada ejecución de la tarea.</p>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={scheduleManualRequirementDraft}
                              onChange={(event) => setScheduleManualRequirementDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addManualRequirement();
                                }
                              }}
                              className="min-w-0 flex-1 rounded-md border-none bg-white px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                              placeholder="Agregar subtarea al checklist"
                            />
                            <button
                              type="button"
                              onClick={addManualRequirement}
                              className="inline-flex items-center justify-center gap-1 rounded-md bg-[#3a5f94] px-3 py-1.5 text-[10px] font-bold text-white uppercase transition-transform hover:brightness-110"
                            >
                              <span className="material-symbols-outlined text-[14px] leading-none">add_circle</span>
                              Agregar
                            </button>
                          </div>

                          {(scheduleManualForm.requerimientos ?? []).length === 0 ? (
                            <p className="text-[11px] text-slate-500">Escribe y agrega subtareas para construir el checklist.</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(scheduleManualForm.requerimientos ?? []).map((item) => (
                                <div key={item} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                                  <label className="inline-flex items-center gap-2">
                                    <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-slate-300 text-slate-900" />
                                    <span>{item}</span>
                                  </label>
                                  <button type="button" onClick={() => removeManualRequirement(item)} className="text-slate-400 transition hover:text-red-600" aria-label={`Eliminar requerimiento ${item}`}>
                                    <span className="material-symbols-outlined text-[14px] leading-none">remove_circle</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={busyAction === "schedule-instance-create"}
                        className="flex-1 rounded-md bg-[#3a5f94] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#2d5387] disabled:opacity-60"
                      >
                        {busyAction === "schedule-instance-create" ? "Creando..." : "Crear Tarea"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedScheduleCell(null)}
                        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              );
            }

            const task = tasksInSlot[0];
            const taskInstance = instances.find((item) => item.id === task.id);
            const taskCatalog = catalog.find((item) => item.id === (taskInstance?.tareaCatalogoId ?? task.id)) ?? null;
            const slotStart = selectedScheduleCell.slotStart;
            const slotEnd = slotStart + 30;
            const rowLabel = `${toAmPmLabel(minutesToHHMM(slotStart))} - ${toAmPmLabel(minutesToHHMM(slotEnd))}`;
            const dayLabel = WEEK_DAY_SHORT_LABELS[selectedScheduleCell.dayIndex] ?? "";

            return (
              <div className="flex flex-col">
                <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase">
                      {selectedScheduleCell?.isEditing ? "Editar Tarea" : "Tarea Seleccionada"}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">{task.nombre}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedScheduleCell?.isEditing) {
                        setScheduleSectorSearchQuery("");
                        setSelectedScheduleCell((current) =>
                          current ? { ...current, isEditing: false } : null
                        );
                      } else {
                        setScheduleSectorSearchQuery("");
                        setSelectedScheduleCell(null);
                      }
                    }}
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    {selectedScheduleCell?.isEditing ? "←" : "✕"}
                  </button>
                </div>

                {selectedScheduleCell?.isEditing ? (
                  <form onSubmit={submitCatalog} className="flex flex-col overflow-y-auto">
                    <div className="space-y-3 px-4 py-4">
                      <div>
                        <label htmlFor="schedule-nombre" className="block text-xs font-bold text-slate-600 uppercase">
                          Nombre de la Tarea
                        </label>
                        <input
                          id="schedule-nombre"
                          type="text"
                          value={catalogForm.nombre}
                          onChange={(e) => setCatalogForm((c) => ({ ...c, nombre: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                          placeholder="Nombre..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="schedule-sector-search" className="block text-xs font-bold text-slate-600 uppercase">
                            Sector/Lugar
                          </label>
                          <div className="relative mt-1">
                            {catalogForm.sector ? (
                              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                <span className="flex-1 text-sm font-medium text-slate-900">{catalogForm.sector}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCatalogForm((c) => ({ ...c, sector: "" }));
                                    setScheduleSectorSearchQuery("");
                                  }}
                                  className="text-slate-400 hover:text-slate-600 transition"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <>
                                <input
                                  id="schedule-sector-search"
                                  type="text"
                                  value={scheduleSectorSearchQuery}
                                  onChange={(e) => setScheduleSectorSearchQuery(e.target.value)}
                                  placeholder="Buscar lugar..."
                                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                                />
                                {scheduleSectorSearchQuery && (
                                  <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg z-20">
                                    {(() => {
                                      const filtered = taskLocationOptions.filter((location) =>
                                        location.nombre.toLowerCase().includes(scheduleSectorSearchQuery.toLowerCase())
                                      );
                                      return filtered.length > 0 ? (
                                        filtered.map((location) => (
                                          <button
                                            key={location.id}
                                            type="button"
                                            onClick={() => {
                                              setCatalogForm((c) => ({ ...c, sector: location.nombre }));
                                              setScheduleSectorSearchQuery("");
                                            }}
                                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 transition"
                                          >
                                            <span className="font-medium text-slate-900">{location.nombre}</span>
                                            <span className="ml-2 text-[10px] text-slate-500">
                                              ({location.source === "espacio" ? "Espacio" : "Salón"})
                                            </span>
                                          </button>
                                        ))
                                      ) : (
                                        <div className="px-3 py-2 text-sm text-slate-500">No hay lugares coincidentes</div>
                                      );
                                    })()}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          <label htmlFor="schedule-tiempo" className="block text-xs font-bold text-slate-600 uppercase">
                            Duración (min)
                          </label>
                          <input
                            id="schedule-tiempo"
                            type="number"
                            value={catalogForm.tiempoEstimadoMin}
                            onChange={(e) => setCatalogForm((c) => ({ ...c, tiempoEstimadoMin: e.target.value }))}
                            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                            min="1"
                          />
                        </div>

                        
                      </div>

                      <div>
                        <label htmlFor="schedule-hora" className="block text-xs font-bold text-slate-600 uppercase">
                          Hora Programada
                        </label>
                        <select
                          id="schedule-hora"
                          value={catalogForm.horaProgramada}
                          onChange={(e) => setCatalogForm((c) => ({ ...c, horaProgramada: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-sm outline-none transition focus:border-slate-400"
                        >
                          {recurringTimeOptions.map((time) => (
                            <option key={time} value={time}>
                              {toAmPmLabel(time)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase">Días de Semana</label>
                        <div className="mt-1 grid grid-cols-4 gap-1.5">
                          {dayLabels.map((label, idx) => (
                            <label key={idx} className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={catalogForm.diasSemana.includes(idx)}
                                onChange={(e) => {
                                  const enabled = e.target.checked;
                                  setCatalogForm((current) => {
                                    const nextDays = enabled
                                      ? Array.from(new Set([...current.diasSemana, idx])).sort((left, right) => left - right)
                                      : current.diasSemana.filter((day) => day !== idx);

                                    return { ...current, diasSemana: nextDays };
                                  });
                                }}
                                className="rounded border-slate-200"
                              />
                              <span className="text-[10px] text-slate-600">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 px-4 py-4 space-y-2 flex flex-col">
                      <button
                        type="submit"
                        disabled={busyAction === "catalog-update"}
                        className="w-full rounded-md bg-green-600 px-3 py-2.5 text-sm font-bold tracking-[0.14em] text-white uppercase transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === "catalog-update" ? "Guardando..." : "Guardar Cambios"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleSectorSearchQuery("");
                          setSelectedScheduleCell((current) =>
                            current ? { ...current, isEditing: false } : null
                          );
                        }}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4 px-4 py-4 overflow-y-auto flex-1">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase">Detalles</p>
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Trabajador:</span>
                          <span className="font-semibold text-slate-900">{staffLabel(selectedWorker.staff)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Día:</span>
                          <span className="font-semibold text-slate-900">{dayLabel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Horario:</span>
                          <span className="font-semibold text-slate-900">{rowLabel}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Tipo:</span>
                          <span className="rounded-full bg-[#dce8f7] px-2 py-0.5 text-[10px] font-semibold text-[#284e7a]">
                            {task.tipo}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Sector:</span>
                          <span className="font-semibold text-slate-900">{task.sector}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Duración:</span>
                          <span className="font-semibold text-slate-900">{task.tiempoEstimadoMin} min</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Asignación:</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            {assignmentModeLabels[task.modoAsignacion] || task.modoAsignacion}
                          </span>
                        </div>
                      </div>
                    </div>

                    {task.requerimientos.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase">Requerimientos</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {task.requerimientos.map((req) => (
                            <span key={req} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              {req}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!taskCatalog) {
                            setNotice({ kind: "error", text: "No se pudo cargar el catálogo para editar esta tarea." });
                            return;
                          }

                          beginEditCatalog(taskCatalog, {
                            cantidadPersonal: "1",
                            horaProgramada: minutesToHHMM(slotStart),
                            diasSemana: taskCatalog.diasSemana.length > 0 ? taskCatalog.diasSemana : [selectedScheduleCell.dayIndex],
                          });
                          setShowQuickCatalogEditor(true);
                          setSelectedScheduleCell((current) => (current ? { ...current, isEditing: true } : null));
                        }}
                        className="w-full rounded-md bg-[#3a5f94] px-3 py-2.5 text-sm font-bold tracking-[0.14em] text-white uppercase transition hover:brightness-110"
                      >
                        Editar Tarea
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeScheduleTask(task, selectedScheduleCell.staffId)}
                        disabled={busyAction === "schedule-remove"}
                        className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold tracking-[0.14em] text-red-600 uppercase transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === "schedule-remove" ? "Quitando..." : "Quitar tarea"}
                      </button>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase mb-2">Acción Rápida</p>
                      <button
                        type="button"
                        onClick={() => setSelectedScheduleCell(null)}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cerrar Panel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        ) : null}

        {tasksSubtab === "tareas-asignadas" ? (
        <section>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Asignaciones predefinidas</p>
                  <h3 className="mt-0.5 text-sm font-black text-slate-900">Tareas Asignadas</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {assignedTasksByStaff.length} personas
                </span>
              </div>

              <div className="mt-2.5 space-y-1.5">
                {assignedTasksByStaff.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-500">
                    No hay tareas con trabajador predefinido para los filtros actuales.
                  </p>
                ) : (
                  assignedTasksByStaff.map((group) => (
                    <details key={`assigned-staff-${group.staffId}`} className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2.5 marker:content-none">
                        <div className="flex min-w-0 items-center gap-2">
                          {group.person?.cedula ? (
                            <img
                              src={getStaffPhotoUrl(group.person.cedula)}
                              alt={staffLabel(group.person)}
                              className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-600">
                              {group.person ? staffInitials(group.person) : "--"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-black text-slate-900">{group.person ? staffLabel(group.person) : `Personal ${group.staffId.slice(0, 8)}`}</p>
                            <p className="text-[10px] text-slate-500">{group.person ? staffRoleLabel(group.person) : "Personal"}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-slate-600">
                          {group.tasks.length} tarea(s)
                        </span>
                      </summary>

                      <div className="space-y-1.5 border-t border-slate-200 px-2.5 py-2">
                        {(() => {
                          // Agrupar por lugar/sector
                          const buckets = new Map<string, TaskCatalogItem[]>();
                          group.tasks.forEach((task) => {
                            const place = (task.sector ?? "Sin lugar").trim() || "Sin lugar";
                            const bucket = buckets.get(place) ?? [];
                            bucket.push(task);
                            buckets.set(place, bucket);
                          });

                          // Helper para obtener clave de orden: día (si aplica) y minutos de inicio
                          const getSortKey = (task: TaskCatalogItem) => {
                            // DiasSemana usa índices 0..6 (Dom..Sab) según la definición en este módulo
                            const dayIndex = (task.diasSemana && task.diasSemana.length > 0) ? Math.min(...task.diasSemana) : 7;
                            const timeValue = task.tipo === "Recurrente" ? (task.horaProgramada ?? "00:00") : (task.horaEsporadica ?? "00:00");
                            const minutes = parseTimeToMinutes(timeValue) ?? 0;
                            return `${String(dayIndex).padStart(2, "0")}:${String(minutes).padStart(5, "0")}`;
                          };

                          const sortedPlaces = Array.from(buckets.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));

                          return sortedPlaces.map(([place, tasks]) => {
                            tasks.sort((a, b) => {
                              const ka = getSortKey(a);
                              const kb = getSortKey(b);
                              return ka.localeCompare(kb);
                            });

                            // Build a compact combined label for the place: union of days and full time range
                            const combinedDays = new Set<number>();
                            let earliestStart: number | null = null;
                            let latestEnd: number | null = null;

                            tasks.forEach((t) => {
                              if (t.diasSemana && t.diasSemana.length > 0) {
                                t.diasSemana.forEach((d) => combinedDays.add(d));
                              }

                              const startTime = t.tipo === "Recurrente" ? t.horaProgramada ?? null : t.horaEsporadica ?? null;
                              const startMinutes = startTime ? parseTimeToMinutes(startTime) ?? null : null;
                              const duration = Number.isFinite(Number(t.tiempoEstimadoMin)) ? Number(t.tiempoEstimadoMin) : 0;
                              const endMinutes = startMinutes !== null ? (startMinutes + duration) : null;

                              if (startMinutes !== null) {
                                earliestStart = earliestStart === null ? startMinutes : Math.min(earliestStart, startMinutes);
                              }

                              if (endMinutes !== null) {
                                latestEnd = latestEnd === null ? endMinutes : Math.max(latestEnd, endMinutes);
                              }
                            });

                            const combinedDaysLabel = (() => {
                              if (combinedDays.size === 0) return null;
                              const sorted = Array.from(combinedDays).sort((a, b) => a - b);
                              return sorted.map((d) => dayLabels[d] ?? String(d)).join("/");
                            })();

                            const combinedTimeLabel = (() => {
                              if (earliestStart === null || latestEnd === null) return null;
                              const startStr = minutesToHHMM(earliestStart);
                              const endStr = minutesToHHMM(latestEnd);
                              return `Inicio ${toAmPmLabel(startStr)} · Fin ${toAmPmLabel(endStr)}`;
                            })();

                            return (
                              <details key={`${group.staffId}-place-${place}`} className="rounded-md border border-slate-100 bg-white">
                                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-slate-900">{place}</p>
                                    <p className="text-[11px] text-slate-500">{tasks.length} tarea(s)</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {combinedDaysLabel || combinedTimeLabel ? (
                                      <div className="text-right text-[11px] text-slate-600">
                                        {combinedDaysLabel ? <div className="font-semibold">{combinedDaysLabel}</div> : null}
                                        {combinedTimeLabel ? <div className="text-[10px]">{combinedTimeLabel}</div> : null}
                                      </div>
                                    ) : null}
                                    <span className="text-slate-400">▸</span>
                                  </div>
                                </summary>

                                <div className="px-3 pb-3 pt-0 space-y-2">
                                  {tasks.map((task) => (
                                    <div key={`${group.staffId}-${task.id}`} className="rounded-lg border border-slate-200 bg-white p-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="truncate text-[13px] font-black text-slate-900">{task.nombre}</p>
                                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{task.sector}</span>
                                            <span className="rounded-full bg-[#dce8f7] px-2 py-0.5 text-[10px] font-semibold text-[#284e7a]">{task.tipo}</span>
                                          </div>
                                          <p className="mt-1 text-[10px] font-semibold text-[#355b8e]">Programación: {assignedTaskScheduleLabel(task)}</p>
                                          <p className="mt-0.5 text-[10px] font-semibold text-slate-600">Horario: {assignedTaskTimeWindowLabel(task)}</p>
                                        </div>
                                      </div>

                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            beginEditCatalog(task);
                                            setTasksSubtab("gestion");
                                          }}
                                          className="rounded-md bg-[#3a5f94] px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-white uppercase transition hover:brightness-110"
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void deleteCatalog(task.id)}
                                          disabled={deletingCatalogId === task.id || busyAction === `catalog-delete-${task.id}`}
                                          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-red-600 uppercase transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {deletingCatalogId === task.id ? "Eliminando..." : "Eliminar"}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            );
                          });
                        })()}
                      </div>
                    </details>
                  ))
                )}
              </div>
            </div>
          </div>

        </section>
        ) : null}

        {tasksSubtab === "gestion" ? (
        <section className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)] overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-[#f0f4f7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[9px] font-bold tracking-[0.26em] text-slate-500 uppercase">Estado operativo</p>
                <h2 className="text-base font-black text-slate-900">Estado</h2>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] font-semibold text-slate-600">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">Pendientes {pendingInstances.length}</span>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">En progreso {activeInstances.length}</span>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">Rev {reviewQueue.length}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">Done {completedInstances.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase">Tarea</th>
                    <th className="px-3 py-2 text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase">Estado</th>
                    <th className="px-3 py-2 text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase">Prioridad</th>
                    <th className="px-3 py-2 text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase">Horario</th>
                    <th className="px-3 py-2 text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase">Asignado</th>
                    <th className="px-3 py-2 text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {instances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-500">
                        No hay instancias programadas.
                      </td>
                    </tr>
                  ) : (
                    instances.map((task) => (
                      <tr key={task.id} className="align-top hover:bg-slate-50/80 text-xs">
                        <td className="px-3 py-2">
                          <p className="text-sm font-bold text-slate-900">{task.tareaNombre}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {task.salonNombre ? roomLabel(roomById.get(task.salonId ?? "") ?? { id: task.salonId ?? task.id, nombre: task.salonNombre, piso: null }) : "Sin salon"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {formatDateLabel(task.fechaProgramada)} · {formatTimeLabel(task.horaProgramada)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">ID {task.id}</p>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${stateStyles[task.estado]}`}>{task.estado}</span>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityStyles[task.prioridad]}`}>{task.prioridad}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          <p className="text-[10px]">{formatDateLabel(task.fechaProgramada)}</p>
                          <p className="text-[9px] text-slate-500">{formatTimeLabel(task.horaProgramada)}</p>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          <p className="font-semibold text-slate-900 text-[10px]">{task.staffAsignadoNombre ?? "Sin asignar"}</p>
                          <p className="text-[9px] text-slate-500">{task.asignacionId ? `${task.asignacionId.slice(0, 8)}` : "No asignada"}</p>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="flex flex-wrap gap-1">
                            {task.asignacionId ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void startTask(task.asignacionId ?? "")}
                                  disabled={busyAction === `start-${task.asignacionId}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-[#3a5f94] px-2 py-1 text-[10px] font-bold text-white uppercase transition-transform hover:brightness-110 disabled:opacity-60"
                                >
                                  Iniciar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void sendToReview(task.asignacionId ?? "")}
                                  disabled={busyAction === `review-${task.asignacionId}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-[#3a5f94] px-2 py-1 text-[10px] font-bold text-white uppercase transition-transform hover:brightness-110 disabled:opacity-60"
                                >
                                  Rev
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setInstanceForm((current) => ({ ...current, tareaCatalogoId: task.tareaCatalogoId }))}
                                className={primaryButtonClass}
                              >
                                Reusar catalogo
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (!task.asignacionId) {
                                  setNotice({ kind: "error", text: "Esta tarea aun no tiene asignacion activa." });
                                  return;
                                }
                                setReviewForm((current) => ({ ...current, asignacionId: task.asignacionId ?? current.asignacionId }));
                                setNotice({ kind: "success", text: "La asignacion se cargo en el formulario de revision." });
                              }}
                              className={primaryButtonClass}
                            >
                              Cargar revision
                            </button>
                          </div>
                          {task.observacionesRevision ? <p className="mt-2 max-w-xs text-[11px] text-slate-500">{task.observacionesRevision}</p> : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
              <p className="text-[9px] font-bold tracking-[0.26em] text-slate-500 uppercase">Resumen</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  { label: "Pendientes", value: pendingInstances.length },
                  { label: "En progreso", value: activeInstances.length },
                  { label: "Revisión", value: reviewQueue.length },
                  { label: "Completadas", value: completedInstances.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[8px] font-bold tracking-[0.24em] text-slate-500 uppercase">{item.label}</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
              <p className="text-[9px] font-bold tracking-[0.26em] text-slate-500 uppercase">En Revisión</p>
              <div className="mt-2 space-y-2 max-h-96 overflow-y-auto">
                {reviewQueue.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs text-slate-500">Sin tareas en revisión.</p>
                ) : (
                  reviewQueue.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setReviewForm((current) => ({ ...current, asignacionId: task.asignacionId ?? current.asignacionId }))}
                      className={`${primaryButtonClass} flex w-full items-start justify-between rounded-md p-4 text-left`}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{task.tareaNombre}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{task.staffAsignadoNombre ?? "Sin staff"}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {task.fechaProgramada} · {task.horaProgramada}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${stateStyles[task.estado]}`}>{task.estado}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
        ) : null}
      </div>
    </main>
  );
}
