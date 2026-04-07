"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";

type TaskType = "Recurrente" | "Esporadica";
type TaskPriority = "Baja" | "Media" | "Alta" | "Urgente";
type TaskState = "Pendiente" | "En Progreso" | "En Revision" | "Completada" | "Rechazada" | "Corregir" | "Cancelada";

type TaskCatalogItem = {
  id: string;
  nombre: string;
  tipo: TaskType;
  habilidadRequeridaId: string | null;
  tiempoEstimadoMin: number;
  puntosOtorgados: number;
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

type RoomsInfoResponse = {
  roomsByFloor?: RoomItem[][];
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
  tipo: TaskType;
  habilidadRequeridaId: string;
  tiempoEstimadoMin: string;
  puntosOtorgados: string;
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

function roomLabel(room: RoomItem): string {
  return room.piso ? `Piso ${room.piso} · ${room.nombre}` : room.nombre;
}

function staffLabel(staff: StaffItem): string {
  return `${staff.nombres} ${staff.apellidos}`.trim();
}

export default function TasksPage() {
  const [catalog, setCatalog] = useState<TaskCatalogItem[]>([]);
  const [instances, setInstances] = useState<TaskInstanceItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [staffSkills, setStaffSkills] = useState<StaffSkillLink[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);

  const [skillName, setSkillName] = useState("");
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>({
    nombre: "",
    tipo: "Recurrente",
    habilidadRequeridaId: "",
    tiempoEstimadoMin: "45",
    puntosOtorgados: "5",
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

  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const skillById = useMemo(() => new Map(skills.map((item) => [item.id, item])), [skills]);
  const roomById = useMemo(() => new Map(rooms.map((item) => [item.id, item])), [rooms]);

  const selectedCatalogSkillId = catalogById.get(instanceForm.tareaCatalogoId)?.habilidadRequeridaId ?? null;
  const eligibleStaffIds = useMemo(() => {
    if (!selectedCatalogSkillId) {
      return new Set<string>(staff.map((person) => person.id));
    }

    return new Set(
      staffSkills.filter((link) => link.habilidadId === selectedCatalogSkillId).map((link) => link.staffId),
    );
  }, [selectedCatalogSkillId, staff, staffSkills]);

  const selectedAssignmentCatalogSkillId = catalogById.get(
    instances.find((task) => task.id === assignmentForm.tareaInstanciaId)?.tareaCatalogoId ?? "",
  )?.habilidadRequeridaId ?? null;
  const assignmentEligibleStaffIds = useMemo(() => {
    if (!selectedAssignmentCatalogSkillId) {
      return new Set<string>(staff.map((person) => person.id));
    }

    return new Set(
      staffSkills.filter((link) => link.habilidadId === selectedAssignmentCatalogSkillId).map((link) => link.staffId),
    );
  }, [selectedAssignmentCatalogSkillId, staff, staffSkills]);

  const reviewQueue = useMemo(
    () => instances.filter((task) => task.estado === "En Revision" && Boolean(task.asignacionId)),
    [instances],
  );

  const pendingInstances = useMemo(
    () => instances.filter((task) => task.estado === "Pendiente" || task.estado === "Corregir"),
    [instances],
  );
  const activeInstances = useMemo(() => instances.filter((task) => task.estado === "En Progreso"), [instances]);
  const completedInstances = useMemo(() => instances.filter((task) => task.estado === "Completada"), [instances]);

  const loadData = async () => {
    setLoading(true);
    setNotice(null);

    try {
      const [catalogBody, instancesBody, skillsBody, staffSkillsBody, staffBody, roomsBody] = await Promise.all([
        fetchApiJson<TasksResponse>("/api/tasks/catalog", { cache: "no-store" }),
        fetchApiJson<InstancesResponse>("/api/tasks/instances", { cache: "no-store" }),
        fetchApiJson<SkillsResponse>("/api/tasks/skills", { cache: "no-store" }),
        fetchApiJson<StaffSkillsResponse>("/api/tasks/staff-habilidades", { cache: "no-store" }),
        fetchApiJson<StaffResponse>("/api/staff", { cache: "no-store" }),
        fetchApiJson<RoomsInfoResponse>("/api/schedules/rooms-info", { cache: "no-store" }).catch(() => ({} as RoomsInfoResponse)),
      ]);

      setCatalog(catalogBody.tasks ?? []);
      setInstances(instancesBody.tasks ?? []);
      setSkills(skillsBody.skills ?? []);
      setStaffSkills(staffSkillsBody.links ?? []);
      setStaff(staffBody.staff ?? []);
      setRooms((roomsBody.roomsByFloor ?? []).flat().filter(Boolean));

      setCatalogForm((current) => ({
        ...current,
        habilidadRequeridaId: current.habilidadRequeridaId || skillsBody.skills?.[0]?.id || "",
      }));
      setInstanceForm((current) => ({
        ...current,
        tareaCatalogoId: current.tareaCatalogoId || catalogBody.tasks?.[0]?.id || "",
        salonId: current.salonId || roomsBody.roomsByFloor?.flat()?.[0]?.id || "",
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
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
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

  const submitCatalog = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nombre = catalogForm.nombre.trim();
    if (!nombre) {
      setNotice({ kind: "error", text: "Escribe un nombre para la tarea de catalogo." });
      return;
    }

    const tiempoEstimadoMin = Number(catalogForm.tiempoEstimadoMin);
    const puntosOtorgados = Number(catalogForm.puntosOtorgados);

    if (!Number.isFinite(tiempoEstimadoMin) || tiempoEstimadoMin < 1) {
      setNotice({ kind: "error", text: "El tiempo estimado debe ser mayor a 0." });
      return;
    }

    if (!Number.isFinite(puntosOtorgados) || puntosOtorgados < 0) {
      setNotice({ kind: "error", text: "Los puntos deben ser un numero valido." });
      return;
    }

    try {
      setBusyAction("catalog-create");
      await fetchApiJson<{ message: string; id: string }>("/api/tasks/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          tipo: catalogForm.tipo,
          habilidadRequeridaId: catalogForm.habilidadRequeridaId || null,
          tiempoEstimadoMin,
          puntosOtorgados,
        }),
      });
      setCatalogForm((current) => ({
        ...current,
        nombre: "",
        tipo: "Recurrente",
        habilidadRequeridaId: skills[0]?.id ?? "",
        tiempoEstimadoMin: "45",
        puntosOtorgados: "5",
      }));
      setNotice({ kind: "success", text: "Tarea de catalogo creada correctamente." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo crear la tarea de catalogo." });
    } finally {
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
        text: reviewForm.decision === "aprobar" ? "Tarea aprobada y puntaje aplicado." : "Tarea enviada a correccion.",
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
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
          <div className="flex flex-col gap-6 bg-[linear-gradient(180deg,#f7f9fb_0%,#eef3f8_100%)] px-6 py-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <p className="text-[10px] font-black tracking-[0.34em] text-slate-500 uppercase">Institutional Intelligence</p>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Tasks Control Center</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Real tasks, real skills, and traceable reviews.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[560px]">
              {[
                { label: "Catalogo", value: catalog.length, tone: "bg-white/12" },
                { label: "Instancias", value: instances.length, tone: "bg-white/12" },
                { label: "Pendientes", value: pendingInstances.length, tone: "bg-white/12" },
                { label: "Revision", value: reviewableCount, tone: "bg-white/12" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
                  <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">{item.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{item.value}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#3a5f94]" style={{ width: `${Math.max(20, Math.min(100, item.value * 18))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-md bg-[#3a5f94] px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-white uppercase transition-transform hover:brightness-110 disabled:opacity-60"
              disabled={refreshing}
            >
              <span className={`material-symbols-outlined text-[18px] ${refreshing ? "animate-spin" : ""}`}>refresh</span>
              {refreshing ? "Actualizando" : "Refrescar datos"}
            </button>
            <div className="rounded-md bg-slate-100 px-4 py-2 text-[11px] font-semibold text-slate-600">
              {staff.filter((person) => eligibleStaffIds.has(person.id)).length} staff compatibles · {linkedSkillsCount} vinculaciones activas
            </div>
            {notice ? (
              <div className={`rounded-md px-4 py-2 text-[11px] font-semibold ${notice.kind === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {notice.text}
              </div>
            ) : null}
          </div>
        </section>

        {loading ? (
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-[24px] border border-slate-200 bg-white/80" />
            ))}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr]">
          <div className="space-y-4">
            <form onSubmit={submitSkill} className="rounded-xl border border-[#d3e4fe] bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-2 text-[#3a5f94]">psychology</span>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Habilidades</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Skill Matrix</h2>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500">Nombre de la habilidad</span>
                  <input
                    value={skillName}
                    onChange={(event) => setSkillName(event.target.value)}
                    className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                    placeholder="Electricidad, Limpieza, Soporte, etc."
                  />
                </label>
                <button
                  type="submit"
                  disabled={busyAction === "skill-create"}
                  className={`${primaryButtonClass} w-full justify-center`}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {busyAction === "skill-create" ? "Guardando..." : "Crear habilidad"}
                </button>
              </div>
            </form>

            <form onSubmit={submitLinkSkill} className="rounded-xl border border-[#d9e4ea] bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-2 text-[#3a5f94]">link</span>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Vinculos</p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">Skill Links</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500">Staff</span>
                  <select
                  style={selectChevronStyle}
                    value={linkSkillForm.staffId}
                    onChange={(event) => setLinkSkillForm((current) => ({ ...current, staffId: event.target.value }))}
                    className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                  >
                    <option value="">Selecciona una persona</option>
                    {staff.map((person) => (
                      <option key={person.id} value={person.id}>
                        {staffLabel(person)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-bold text-slate-500">Habilidad</span>
                  <select
                  style={selectChevronStyle}
                    value={linkSkillForm.habilidadId}
                    onChange={(event) => setLinkSkillForm((current) => ({ ...current, habilidadId: event.target.value }))}
                    className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                  >
                    <option value="">Selecciona una habilidad</option>
                    {skills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={busyAction === "skill-link"}
                  className={`${primaryButtonClass} w-full justify-center`}
                >
                  <span className="material-symbols-outlined text-[18px]">group_add</span>
                  {busyAction === "skill-link" ? "Vinculando..." : "Vincular habilidad"}
                </button>
              </div>
            </form>
          </div>

          <form onSubmit={submitCatalog} className="rounded-xl border border-[#d5e3ff] bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-2 text-[#3a5f94]">category</span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Catalogo</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Task Catalog</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Nombre</span>
                <input
                  value={catalogForm.nombre}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, nombre: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                  placeholder="Limpieza general del bloque norte"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Tipo</span>
                <select
                  style={selectChevronStyle}
                  value={catalogForm.tipo}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, tipo: event.target.value as TaskType }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  {(["Recurrente", "Esporadica"] as TaskType[]).map((type) => (
                    <option key={type} value={type}>
                      {taskTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Habilidad requerida</span>
                <select
                  style={selectChevronStyle}
                  value={catalogForm.habilidadRequeridaId}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, habilidadRequeridaId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Sin habilidad obligatoria</option>
                  {skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Tiempo estimado (min)</span>
                <input
                  type="number"
                  min={1}
                  value={catalogForm.tiempoEstimadoMin}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, tiempoEstimadoMin: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Puntos otorgados</span>
                <input
                  type="number"
                  min={0}
                  value={catalogForm.puntosOtorgados}
                  onChange={(event) => setCatalogForm((current) => ({ ...current, puntosOtorgados: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>

              <button
                type="submit"
                disabled={busyAction === "catalog-create"}
                className={`${primaryButtonClass} justify-center sm:col-span-2`}
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                {busyAction === "catalog-create" ? "Creando..." : "Crear catalogo de tarea"}
              </button>
            </div>
          </form>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <form onSubmit={submitInstance} className="rounded-xl border border-[#d9e4ea] bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-2 text-[#3a5f94]">calendar_add_on</span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Instancias</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Scheduling</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Tarea de catalogo</span>
                <select
                  style={selectChevronStyle}
                  value={instanceForm.tareaCatalogoId}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, tareaCatalogoId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Selecciona un catalogo</option>
                  {catalog.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Salon</span>
                <select
                  style={selectChevronStyle}
                  value={instanceForm.salonId}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, salonId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Sin salon asignado</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {roomLabel(room)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Prioridad</span>
                <select
                  style={selectChevronStyle}
                  value={instanceForm.prioridad}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, prioridad: event.target.value as TaskPriority }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  {(["Baja", "Media", "Alta", "Urgente"] as TaskPriority[]).map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Fecha programada</span>
                <input
                  type="date"
                  value={instanceForm.fechaProgramada}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, fechaProgramada: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Hora programada</span>
                <input
                  type="time"
                  value={instanceForm.horaProgramada}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, horaProgramada: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                />
              </label>

              <label className="flex items-center gap-3 rounded-md border border-[#d9e4ea] bg-[#f0f4f7] px-4 py-2.5 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={instanceForm.asignacionAutomatica}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, asignacionAutomatica: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                <span className="text-sm font-semibold text-slate-700">Activar asignacion automatica</span>
              </label>

              <label className="block space-y-2 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Detalle adicional</span>
                <textarea
                  value={instanceForm.detalleAdicional}
                  onChange={(event) => setInstanceForm((current) => ({ ...current, detalleAdicional: event.target.value }))}
                  rows={4}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                  placeholder="Instrucciones, prioridad operativa, observaciones..."
                />
              </label>

              <button
                type="submit"
                disabled={busyAction === "instance-create"}
                className={`${primaryButtonClass} justify-center sm:col-span-2`}
              >
                <span className="material-symbols-outlined text-[18px]">add_task</span>
                {busyAction === "instance-create" ? "Programando..." : "Crear instancia"}
              </button>
            </div>
          </form>

          <div className="space-y-4">
          <form onSubmit={submitTaskAssignment} className="rounded-xl border border-[#d9d7f8] bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-2 text-[#3a5f94]">assignment_ind</span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Asignaciones</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Operational Assignment</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Instancia</span>
                <select
                  style={selectChevronStyle}
                  value={assignmentForm.tareaInstanciaId}
                  onChange={(event) => setAssignmentForm((current) => ({ ...current, tareaInstanciaId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Selecciona una instancia</option>
                  {instances.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.tareaNombre} · {task.estado} · {task.fechaProgramada}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Staff</span>
                <select
                  style={selectChevronStyle}
                  value={assignmentForm.staffId}
                  onChange={(event) => setAssignmentForm((current) => ({ ...current, staffId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="">Selecciona un staff</option>
                  {staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {staffLabel(person)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={busyAction === "task-assign"}
                className={`${primaryButtonClass} justify-center sm:col-span-2`}
              >
                <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
                {busyAction === "task-assign" ? "Asignando..." : "Crear asignacion"}
              </button>
            </div>
          </form>

          <form onSubmit={submitReview} className="rounded-xl border border-[#d3e4fe] bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-2xl bg-[#d5e3ff]/50 p-2 text-[#3a5f94]">fact_check</span>
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Revision</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Quality Review</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Asignacion</span>
                <select
                  style={selectChevronStyle}
                  value={reviewForm.asignacionId}
                  onChange={(event) => setReviewForm((current) => ({ ...current, asignacionId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
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

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Monitor revisor</span>
                <select
                  style={selectChevronStyle}
                  value={reviewForm.monitorId}
                  onChange={(event) => setReviewForm((current) => ({ ...current, monitorId: event.target.value }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
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

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Decision</span>
                <select
                  style={selectChevronStyle}
                  value={reviewForm.decision}
                  onChange={(event) => setReviewForm((current) => ({ ...current, decision: event.target.value as "aprobar" | "rechazar" }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="aprobar">Aprobar</option>
                  <option value="rechazar">Rechazar</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500">Estado al rechazar</span>
                <select
                  style={selectChevronStyle}
                  value={reviewForm.rechazoEstado}
                  onChange={(event) => setReviewForm((current) => ({ ...current, rechazoEstado: event.target.value as "Corregir" | "Rechazada" }))}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
                >
                  <option value="Corregir">Corregir</option>
                  <option value="Rechazada">Rechazada</option>
                </select>
              </label>

              <label className="block space-y-2 sm:col-span-2">
                <span className="text-xs font-bold text-slate-500">Observaciones</span>
                <textarea
                  value={reviewForm.observacionesRevision}
                  onChange={(event) => setReviewForm((current) => ({ ...current, observacionesRevision: event.target.value }))}
                  rows={4}
                  className="w-full appearance-none rounded-md border-none bg-[#e8eff3] px-3 py-2.5 text-sm font-medium text-[#2a3439] shadow-inner shadow-slate-200/70 focus:ring-2 focus:ring-[#3a5f94]/20"
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

        <section className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#f0f4f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Catálogo activo</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Tareas definidas</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                {catalog.length} tareas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Nombre</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Tipo</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Habilidad</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Tiempo</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {catalog.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                        No hay tareas de catalogo todavia.
                      </td>
                    </tr>
                  ) : (
                    catalog.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-slate-900">{task.nombre}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{task.id}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{task.tipo}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {task.habilidadRequeridaId ? skillById.get(task.habilidadRequeridaId)?.nombre ?? task.habilidadRequeridaId : "Sin requisito"}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{task.tiempoEstimadoMin} min</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{task.puntosOtorgados}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Habilidades</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Catalogo y vínculos</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {skills.length} habilidades
              </span>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {skills.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-2">
                    Aun no hay habilidades registradas.
                  </div>
                ) : (
                  skills.map((skill) => (
                    <div key={skill.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">{skill.nombre}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{staffSkills.filter((link) => link.habilidadId === skill.id).length} staff vinculados</p>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold tracking-[0.24em] text-slate-500 uppercase">Compatible con</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {staff.filter((person) => eligibleStaffIds.has(person.id)).slice(0, 8).map((person) => (
                    <span key={person.id} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                      {staffLabel(person)}
                    </span>
                  ))}
                  {eligibleStaffIds.size === 0 ? <span className="text-sm text-slate-500">No hay staff compatible con el requisito seleccionado.</span> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold tracking-[0.24em] text-slate-500 uppercase">Vinculos activos</p>
                <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
                  {staffSkills.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay vinculos registrados.</p>
                  ) : (
                    staffSkills.map((link) => (
                      <div key={link.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <div>
                          <p className="font-semibold text-slate-900">{link.staffNombre ?? link.staffId}</p>
                          <p className="text-[11px] text-slate-500">{link.habilidadNombre ?? link.habilidadId}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setBusyAction(`unlink-${link.id}`);
                              await fetchApiJson<{ message: string; id: string }>(`/api/tasks/staff-habilidades/${link.id}`, {
                                method: "DELETE",
                              });
                              setNotice({ kind: "success", text: "Vinculo eliminado correctamente." });
                              await refresh();
                            } catch (error) {
                              setNotice({ kind: "error", text: error instanceof Error ? error.message : "No se pudo eliminar el vinculo." });
                            } finally {
                              setBusyAction(null);
                            }
                          }}
                          className={primaryButtonClass}
                          disabled={busyAction === `unlink-${link.id}`}
                        >
                          Quitar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="rounded-xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)] overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#f0f4f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Estado operativo</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Operational State</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">Pendientes {pendingInstances.length}</span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">En progreso {activeInstances.length}</span>
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">Revision {reviewQueue.length}</span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Completadas {completedInstances.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Tarea</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Estado</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Prioridad</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Horario</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Asignado</th>
                    <th className="px-5 py-3 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {instances.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                        No hay instancias programadas.
                      </td>
                    </tr>
                  ) : (
                    instances.map((task) => (
                      <tr key={task.id} className="align-top hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-slate-900">{task.tareaNombre}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {task.salonNombre ? roomLabel(roomById.get(task.salonId ?? "") ?? { id: task.salonId ?? task.id, nombre: task.salonNombre, piso: null }) : "Sin salon"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {formatDateLabel(task.fechaProgramada)} · {formatTimeLabel(task.horaProgramada)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">ID {task.id}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${stateStyles[task.estado]}`}>{task.estado}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${priorityStyles[task.prioridad]}`}>{task.prioridad}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <p>{formatDateLabel(task.fechaProgramada)}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{formatTimeLabel(task.horaProgramada)}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900">{task.staffAsignadoNombre ?? "Sin asignar"}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{task.asignacionId ? `Asignacion ${task.asignacionId.slice(0, 8)}` : "Aun no asignada"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {task.asignacionId ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void startTask(task.asignacionId ?? "")}
                                  disabled={busyAction === `start-${task.asignacionId}`}
                                  className={primaryButtonClass}
                                >
                                  Iniciar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void sendToReview(task.asignacionId ?? "")}
                                  disabled={busyAction === `review-${task.asignacionId}`}
                                  className={primaryButtonClass}
                                >
                                  A revision
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReviewForm((current) => ({ ...current, asignacionId: task.asignacionId ?? current.asignacionId }))}
                                  className={primaryButtonClass}
                                >
                                  Revisar
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

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
              <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Resumen</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Pendientes", value: pendingInstances.length },
                  { label: "En progreso", value: activeInstances.length },
                  { label: "Revision", value: reviewQueue.length },
                  { label: "Completadas", value: completedInstances.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold tracking-[0.24em] text-slate-500 uppercase">{item.label}</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
              <p className="text-[10px] font-bold tracking-[0.26em] text-slate-500 uppercase">Linea de revision</p>
              <div className="mt-4 space-y-3">
                {reviewQueue.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No hay tareas en revision por ahora.</p>
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
      </div>
    </main>
  );
}
