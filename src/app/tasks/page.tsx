"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";

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

type TasksSubtab = "gestion" | "tareas-creadas" | "habilidades" | "lugares";

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

function staffMatchesAllSkills(staffId: string, requiredSkills: string[], links: StaffSkillLink[]): boolean {
  if (requiredSkills.length === 0) {
    return true;
  }

  const skillSet = new Set(links.filter((link) => link.staffId === staffId).map((link) => link.habilidadId));
  return requiredSkills.every((skillId) => skillSet.has(skillId));
}

export default function TasksPage() {
  const [catalog, setCatalog] = useState<TaskCatalogItem[]>([]);
  const [instances, setInstances] = useState<TaskInstanceItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [staffSkills, setStaffSkills] = useState<StaffSkillLink[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [taskSpaces, setTaskSpaces] = useState<TaskSpaceItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [spaceName, setSpaceName] = useState("");
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
  const [selectedCatalogLocations, setSelectedCatalogLocations] = useState<string[]>([]);
  const [tasksSubtab, setTasksSubtab] = useState<TasksSubtab>("gestion");
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<TaskType | "todos">("todos");
  const [catalogSectorFilter, setCatalogSectorFilter] = useState("todos");
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>({
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
  });
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
  const [showRecurrenceAlertModal, setShowRecurrenceAlertModal] = useState(false);
  const [showCatalogValidationModal, setShowCatalogValidationModal] = useState(false);

  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const skillById = useMemo(() => new Map(skills.map((item) => [item.id, item])), [skills]);
  const roomById = useMemo(() => new Map(rooms.map((item) => [item.id, item])), [rooms]);

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
    if (!catalogForm.tipo) missing.push("Tipo de tarea");
    if (!catalogForm.modoAsignacion) missing.push("Modo de asignación");
    if (!editingCatalogId && selectedCatalogLocations.length === 0) missing.push("Lugares de la tarea");
    if (editingCatalogId && !catalogForm.sector.trim()) missing.push("Lugar de la tarea");
    if (!catalogForm.tiempoEstimadoMin || Number(catalogForm.tiempoEstimadoMin) < 1) missing.push("Tiempo estimado válido");
    if (!catalogForm.cantidadPersonal || Number(catalogForm.cantidadPersonal) < 1) missing.push("Cantidad de personal válida");

    if (catalogForm.tipo === "Recurrente") {
      if (!catalogForm.programacionRecurrente) missing.push("Tipo de recurrencia");
      if (catalogForm.programacionRecurrente === "programada") {
        if (catalogForm.diasSemana.length === 0) missing.push("Días de semana para la tarea");
        if (!catalogForm.horaProgramada) missing.push("Hora programada");
      }
    } else if (catalogForm.tipo === "Esporadica") {
      if (!catalogForm.fechaEsporadica) missing.push("Fecha esporádica");
      if (!catalogForm.horaEsporadica) missing.push("Hora esporádica");
      if (catalogForm.requiereFinalizacion) {
        if (!catalogForm.tareaFinalizacion.trim()) missing.push("Descripción de la tarea de finalización");
        if (!catalogForm.fechaFinalizacion) missing.push("Fecha de finalización");
        if (!catalogForm.horaFinalizacion) missing.push("Hora de finalización");
      }
    }

    if (catalogForm.modoAsignacion === "manual" && catalogForm.staffAsignadosIds.length === 0) {
      missing.push("Personal para asignación manual");
    }

    return missing;
  }, [catalogForm, selectedCatalogLocations.length, editingCatalogId]);

  const eligibleStaffIds = useMemo(() => {
    return new Set(staff.filter((person) => staffMatchesAllSkills(person.id, selectedCatalogSkillIds, staffSkills)).map((person) => person.id));
  }, [selectedCatalogSkillIds, staff, staffSkills]);

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

  const loadData = async (options?: { preserveNotice?: boolean }) => {
    const preserveNotice = options?.preserveNotice ?? false;
    if (!preserveNotice) {
      setNotice(null);
    }

    try {
      const [catalogBody, instancesBody, skillsBody, staffSkillsBody, staffBody, roomsBody, spacesBody] = await Promise.all([
        fetchApiJson<TasksResponse>("/api/tasks/catalog", { cache: "no-store" }),
        fetchApiJson<InstancesResponse>("/api/tasks/instances", { cache: "no-store" }),
        fetchApiJson<SkillsResponse>("/api/tasks/skills", { cache: "no-store" }),
        fetchApiJson<StaffSkillsResponse>("/api/tasks/staff-habilidades", { cache: "no-store" }),
        fetchApiJson<StaffResponse>("/api/staff", { cache: "no-store" }),
        fetchApiJson<RoomsInfoResponse>("/api/schedules/rooms-info", { cache: "no-store" }).catch(() => ({} as RoomsInfoResponse)),
        fetchApiJson<TaskSpacesResponse>("/api/tasks/spaces", { cache: "no-store" }).catch(() => ({} as TaskSpacesResponse)),
      ]);

      setCatalog(catalogBody.tasks ?? []);
      setInstances(instancesBody.tasks ?? []);
      setSkills(skillsBody.skills ?? []);
      setStaffSkills(staffSkillsBody.links ?? []);
      setStaff(staffBody.staff ?? []);
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
    if (!confirm("¿Estás seguro de que deseas eliminar este espacio de tareas?")) {
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
    if (!confirm("¿Estás seguro de que deseas eliminar esta habilidad?")) {
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

  const submitCatalog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (missingCatalogFields.length > 0) {
      setShowCatalogValidationModal(true);
      return;
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
          `Tipo: ${catalogForm.tipo}`,
          `Lugar(es): ${selectedLocationLabels.join(", ")}`,
          `Modo de asignación: ${assignmentModeLabels[catalogForm.modoAsignacion as AssignmentMode]}`,
          `Cantidad de personal: ${cantidadPersonal}`,
          `Personal sugerido: ${selectedStaff.length ? selectedStaff.join(", ") : "Sin personal predefinido"}`,
          `Tiempo estimado: ${tiempoEstimadoMin} min`,
          `Habilidades: ${selectedSkills.length ? selectedSkills.join(", ") : "Sin requerimientos"}`,
          `Checklist: ${selectedRequirements.length ? selectedRequirements.join(", ") : "Sin checklist"}`,
          catalogForm.tipo === "Recurrente"
            ? `Recurrencia: ${catalogForm.programacionRecurrente === "programada" ? "Programada" : "Diaria en cualquier momento"}`
            : `Fecha/Hora esporádica: ${catalogForm.fechaEsporadica} ${catalogForm.horaEsporadica}`,
        ].join("\n");

        const confirmed = confirm(`¿Seguro que deseas crear este catálogo?\n\n${resumen}`);
        if (!confirmed) {
          setBusyAction(null);
          return;
        }
      }

      const basePayload = {
        nombre,
        tipo: catalogForm.tipo as TaskType,
        modoAsignacion: catalogForm.modoAsignacion as AssignmentMode,
        programacionRecurrente: catalogForm.programacionRecurrente,
        cantidadPersonal,
        habilidadesRequeridasIds: catalogForm.habilidadesRequeridasIds,
        requerimientos: catalogForm.requerimientos,
        staffAsignadosIds: catalogForm.staffAsignadosIds,
        diasSemana:
          catalogForm.tipo === "Recurrente" && catalogForm.programacionRecurrente === "programada"
            ? catalogForm.diasSemana
            : [],
        horaProgramada:
          catalogForm.tipo === "Recurrente" && catalogForm.programacionRecurrente === "programada"
            ? catalogForm.horaProgramada
            : null,
        fechaEsporadica: catalogForm.tipo === "Esporadica" ? catalogForm.fechaEsporadica : null,
        horaEsporadica: catalogForm.tipo === "Esporadica" ? catalogForm.horaEsporadica : null,
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

        for (const sector of sectorsToCreate) {
          await fetchApiJson<{ message: string; id?: string; ids?: string[] }>("/api/tasks/catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...basePayload,
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
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo guardar la tarea de catalogo." });
    } finally {
      setBusyAction(null);
    }
  };

  const beginEditCatalog = (task: TaskCatalogItem) => {
    setEditingCatalogId(task.id);
    setCatalogForm({
      nombre: task.nombre,
      tipo: task.tipo,
      sector: task.sector,
      modoAsignacion: task.modoAsignacion,
      programacionRecurrente: task.tipo === "Recurrente" && task.horaProgramada && task.diasSemana.length > 0 ? "programada" : "diaria_libre",
      cantidadPersonal: String(task.cantidadPersonal),
      habilidadesRequeridasIds: task.habilidadesRequeridasIds,
      requerimientos: task.requerimientos,
      staffAsignadosIds: task.staffAsignadosIds,
      diasSemana: task.diasSemana,
      horaProgramada: task.horaProgramada ?? "08:00",
      fechaEsporadica: task.fechaEsporadica ?? new Date().toISOString().slice(0, 10),
      horaEsporadica: task.horaEsporadica ?? "08:00",
      requiereFinalizacion: task.requiereFinalizacion,
      tareaFinalizacion: task.tareaFinalizacion ?? "",
      fechaFinalizacion: task.fechaFinalizacion ?? new Date().toISOString().slice(0, 10),
      horaFinalizacion: task.horaFinalizacion ?? "09:00",
      tiempoEstimadoMin: String(task.tiempoEstimadoMin),
    });
    setSelectedCatalogLocations([task.sector]);
    setRequirementDraft("");
    setNotice(null);
  };

  const cancelEditCatalog = () => {
    setEditingCatalogId(null);
    setSelectedCatalogLocations([]);
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
    setRequirementDraft("");
  };

  const deleteCatalog = async (catalogId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta tarea del catálogo?")) {
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

  const submitInstance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!instanceForm.tareaCatalogoId) {
      setNotice({ kind: "error", text: "Selecciona una tarea de catalogo." });
      return;
    }

    if (!instanceForm.fechaProgramada || !instanceForm.horaProgramada) {
      setNotice({ kind: "error", text: "Completa fecha y hora programada." });
      return;
    }

    try {
      setBusyAction("instance-create");
      const response = await fetchApiJson<{ message: string; id: string }>("/api/tasks/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tareaCatalogoId: instanceForm.tareaCatalogoId,
          salonId: instanceForm.salonId || null,
          detalleAdicional: instanceForm.detalleAdicional.trim() || null,
          prioridad: instanceForm.prioridad,
          fechaProgramada: instanceForm.fechaProgramada,
          horaProgramada: instanceForm.horaProgramada,
          asignacionAutomatica: instanceForm.asignacionAutomatica,
        }),
      });
      setInstanceForm((current) => ({
        ...current,
        detalleAdicional: "",
      }));
      setNotice({ kind: "success", text: `Instancia creada correctamente. ID ${response.id}` });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo crear la instancia." });
    } finally {
      setBusyAction(null);
    }
  };

  const submitLinkSkill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!linkSkillForm.staffId || !linkSkillForm.habilidadId) {
      setNotice({ kind: "error", text: "Selecciona un staff y una habilidad." });
      return;
    }

    try {
      setBusyAction("skill-link");
      await fetchApiJson<{ message: string; id: string }>("/api/tasks/staff-habilidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: linkSkillForm.staffId,
          habilidadId: linkSkillForm.habilidadId,
        }),
      });
      setNotice({ kind: "success", text: "Habilidad vinculada al staff correctamente." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo vincular la habilidad." });
    } finally {
      setBusyAction(null);
    }
  };

  const submitTaskAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!assignmentForm.tareaInstanciaId || !assignmentForm.staffId) {
      setNotice({ kind: "error", text: "Selecciona una instancia y un staff para asignar." });
      return;
    }

    try {
      setBusyAction("task-assign");
      await fetchApiJson<{ message: string; asignacionId: string }>("/api/tasks/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tareaInstanciaId: assignmentForm.tareaInstanciaId,
          staffId: assignmentForm.staffId,
        }),
      });
      setNotice({ kind: "success", text: "Tarea asignada correctamente." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo asignar la tarea." });
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

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
          <div className="flex flex-col gap-4 bg-[linear-gradient(180deg,#f7f9fb_0%,#eef3f8_100%)] px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl space-y-1">
              <p className="text-[9px] font-black tracking-[0.34em] text-slate-500 uppercase">Inteligencia Institucional</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Centro de Control de Tareas</h1>
              <p className="max-w-2xl text-xs leading-5 text-slate-600">
                Tareas reales, habilidades reales y revisiones trazables.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[480px]">
              {[
                { label: "Catalogo", value: catalog.length, tone: "bg-white/12" },
                { label: "Instancias", value: instances.length, tone: "bg-white/12" },
                { label: "Pendientes", value: pendingInstances.length, tone: "bg-white/12" },
                { label: "Revision", value: reviewableCount, tone: "bg-white/12" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
                  <p className="text-[9px] font-bold tracking-[0.26em] text-slate-500 uppercase">{item.label}</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{item.value}</p>
                  <div className="mt-2 h-1 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#3a5f94]" style={{ width: `${Math.max(20, Math.min(100, item.value * 18))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3 sm:px-6">
            <div className="rounded-md bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
              {staff.filter((person) => eligibleStaffIds.has(person.id)).length} staff compatibles · {linkedSkillsCount} vinculaciones activas
            </div>
            {refreshing ? (
              <div className="rounded-md bg-[#3a5f94]/10 px-3 py-1 text-[10px] font-semibold text-[#3a5f94]">
                Actualizando datos...
              </div>
            ) : null}
            {notice ? (
              <div className={`rounded-md px-3 py-1 text-[10px] font-semibold ${notice.kind === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {notice.text}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(42,52,57,0.06)] sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTasksSubtab("gestion")}
              className={`rounded-md px-4 py-2 text-[11px] font-bold tracking-[0.18em] uppercase transition ${
                tasksSubtab === "gestion"
                  ? "bg-[#3a5f94] text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Gestión
            </button>
            <button
              type="button"
              onClick={() => setTasksSubtab("tareas-creadas")}
              className={`rounded-md px-4 py-2 text-[11px] font-bold tracking-[0.18em] uppercase transition ${
                tasksSubtab === "tareas-creadas"
                  ? "bg-[#3a5f94] text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Tareas Creadas
            </button>
            <button
              type="button"
              onClick={() => setTasksSubtab("habilidades")}
              className={`rounded-md px-4 py-2 text-[11px] font-bold tracking-[0.18em] uppercase transition ${
                tasksSubtab === "habilidades"
                  ? "bg-[#3a5f94] text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Habilidades
            </button>
            <button
              type="button"
              onClick={() => setTasksSubtab("lugares")}
              className={`rounded-md px-4 py-2 text-[11px] font-bold tracking-[0.18em] uppercase transition ${
                tasksSubtab === "lugares"
                  ? "bg-[#3a5f94] text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              Lugares
            </button>
            <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              {filteredCatalog.length} visibles de {catalog.length}
            </span>
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

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block space-y-0.5 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Nombre</span>
                <input
                  value={catalogForm.nombre}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, nombre: event.target.value }))}
                  className="w-full rounded-md border-none bg-[#e8eff3] px-2 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                  placeholder="Limpieza general del bloque norte"
                />
              </label>

              <label className="block space-y-0.5">
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

              {editingCatalogId ? (
                <label className="block space-y-1">
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
                <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2">
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
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-600 uppercase transition hover:bg-slate-50"
                    >
                      Seleccionar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCatalogLocations([])}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-slate-600 uppercase transition hover:bg-slate-50"
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="max-h-44 overflow-y-auto pr-1">
                    {taskLocationOptions.length === 0 ? (
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

              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-500">Tiempo estimado (min)</span>
                <input
                  type="number"
                  min={1}
                  value={catalogForm.tiempoEstimadoMin}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, tiempoEstimadoMin: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>

              <label className="block space-y-1">
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

              <label className="block space-y-1">
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

              <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2">
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

              <div className="space-y-3 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2">
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

              {catalogForm.modoAsignacion === "manual" ? (
                <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2">
                  <span className="text-xs font-bold text-slate-500">Personal sugerido para asignación</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {staff
                      .filter((person) => staffMatchesAllSkills(person.id, catalogForm.habilidadesRequeridasIds, staffSkills))
                      .map((person) => {
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
                            {staffLabel(person)}
                          </label>
                        );
                      })}
                  </div>
                  {staff.filter((person) => staffMatchesAllSkills(person.id, catalogForm.habilidadesRequeridasIds, staffSkills)).length === 0 ? (
                    <p className="text-[11px] text-amber-700">Sin personal compatible con las habilidades requeridas.</p>
                  ) : null}
                </div>
              ) : null}

              {catalogForm.tipo === "Recurrente" && !catalogForm.programacionRecurrente ? (
                <div className="rounded-lg border-l-4 border-sky-400 bg-sky-50 p-4 dark:bg-sky-900/20 sm:col-span-2">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined mt-0.5 flex-shrink-0 text-sky-600 dark:text-sky-400">info</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                        Selecciona el tipo de recurrencia
                      </p>
                      <p className="mt-2 text-xs text-sky-800 dark:text-sky-300">
                        Define cómo se ejecutará esta tarea recurrente. Puedes elegir entre dos opciones:
                      </p>
                      <div className="mt-3 space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCatalogForm((current) => ({ ...current, programacionRecurrente: "programada" }));
                            setShowRecurrenceAlertModal(false);
                          }}
                          className="w-full rounded-md bg-sky-100 px-3 py-2.5 text-left text-xs font-semibold text-sky-900 transition hover:bg-sky-200 dark:bg-sky-800 dark:text-sky-100 dark:hover:bg-sky-700"
                        >
                          <span className="block font-bold">Programada por días y hora</span>
                          <span className="block text-[10px] font-normal opacity-90">
                            Ejecutar en días específicos (ej: lunes y miércoles) a una hora definida
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCatalogForm((current) => ({ ...current, programacionRecurrente: "diaria_libre" }));
                            setShowRecurrenceAlertModal(false);
                          }}
                          className="w-full rounded-md bg-sky-100 px-3 py-2.5 text-left text-xs font-semibold text-sky-900 transition hover:bg-sky-200 dark:bg-sky-800 dark:text-sky-100 dark:hover:bg-sky-700"
                        >
                          <span className="block font-bold">Diaria en cualquier momento</span>
                          <span className="block text-[10px] font-normal opacity-90">
                            Ejecutar todos los días sin requerir una hora específica
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : catalogForm.tipo === "Recurrente" ? (
                <>
                  <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2">
                    <span className="text-xs font-bold text-slate-500">Tipo de recurrencia</span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="programacionRecurrente"
                          checked={catalogForm.programacionRecurrente === "programada"}
                          onChange={() => setCatalogForm((current) => ({ ...current, programacionRecurrente: "programada" }))}
                          className="h-4 w-4 border-slate-300 text-slate-900"
                        />
                        <span className="inline-flex items-center gap-1">
                          Programada por dias y hora
                          <span
                            title="Usa esta opción si la tarea debe ejecutarse en días específicos y a una hora definida, por ejemplo lunes y miércoles a las 07:00."
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600"
                          >
                            ?
                          </span>
                        </span>
                      </label>
                      <label className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="programacionRecurrente"
                          checked={catalogForm.programacionRecurrente === "diaria_libre"}
                          onChange={() => setCatalogForm((current) => ({ ...current, programacionRecurrente: "diaria_libre" }))}
                          className="h-4 w-4 border-slate-300 text-slate-900"
                        />
                        <span className="inline-flex items-center gap-1">
                          Diaria en cualquier momento
                          <span
                            title="Usa esta opción si la tarea debe hacerse todos los días, pero no necesita una hora exacta."
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600"
                          >
                            ?
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {catalogForm.programacionRecurrente === "programada" ? (
                    <>
                  <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2">
                    <span className="text-xs font-bold text-slate-500">Dias recurrentes</span>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {dayLabels.map((label, dayIndex) => (
                        <label key={label} className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={catalogForm.diasSemana.includes(dayIndex)}
                            onChange={(event) => {
                              const enabled = event.target.checked;
                              setCatalogForm((current) => ({
                                ...current,
                                diasSemana: enabled
                                  ? [...current.diasSemana, dayIndex].sort((a, b) => a - b)
                                  : current.diasSemana.filter((day) => day !== dayIndex),
                              }));
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="block space-y-1 sm:col-span-2">
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
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-500">Fecha esporádica</span>
                    <input
                      type="date"
                      value={catalogForm.fechaEsporadica}
                      onChange={(event) => setCatalogForm((current) => ({ ...current, fechaEsporadica: event.target.value }))}
                      className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold text-slate-500">Hora esporádica</span>
                    <input
                      type="time"
                      lang="en-US"
                      value={catalogForm.horaEsporadica}
                      onChange={(event) => setCatalogForm((current) => ({ ...current, horaEsporadica: event.target.value }))}
                      className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-1 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                    />
                  </label>

                  <div className="space-y-2 rounded-md border border-[#d9e4ea] bg-[#f3f7fa] px-3 py-2 sm:col-span-2">
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

              <div className="flex gap-2 sm:col-span-2">
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
