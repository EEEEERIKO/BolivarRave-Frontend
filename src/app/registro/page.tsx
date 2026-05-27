"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApiJson } from "@/lib/api-client";
import { readAuthSession, type AuthSession } from "@/lib/auth-session";

type StaffState = "Active" | "Inactive";
type StaffLiveStatus = "Activo" | "Descanso" | "Inactivo";

type StaffApi = {
  id: string;
  numeroStaff: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  rol: string;
  estado: StaffState;
};

type StaffJornadaItem = {
  id: string;
  staffId: string;
  diaSemana: string;
  horaEntrada: string;
  horaSalida: string;
  totalHorasDia: number;
};

type StaffPausaItem = {
  id: string;
  staffId: string;
  diaSemana: string;
  tipoPausa: "Comida" | "Descanso";
  horaInicio: string;
  horaFin: string;
};

type StaffJornadasBulkResponse = {
  jornadas?: Record<string, StaffJornadaItem[]>;
};

type StaffPausasBulkResponse = {
  pausas?: Record<string, StaffPausaItem[]>;
};

type AttendanceRecord = {
  id: string;
  staffId: string;
  jornadaId: string;
  fecha: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  minutosTarde: number;
  minutosSalidaAnticipada: number;
  minutosBalance: number;
  createdAt: string;
  updatedAt: string;
};

type AttendancePreview = {
  staff: {
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
    tipoContrato: string;
    conocimientoSonido: boolean;
    estado: string;
    balanceHoras: number;
    fechaCreacion: string;
    tieneCredencial: boolean;
    habilidades: Array<{ id: string; nombre: string }>;
    bloqueosClase: Array<{ id: string; diaSemana: string; horaInicio: string; horaFin: string }>;
  };
  fecha: string;
  diaSemana: string;
  horaActual: string;
  jornadasDelDia: Array<{ id: string; diaSemana: string; horaEntrada: string; horaSalida: string; totalHorasDia: number }>;
  jornadaActiva: { id: string; diaSemana: string; horaEntrada: string; horaSalida: string; totalHorasDia: number } | null;
  registrosHoy: AttendanceRecord[];
  registroAbierto: AttendanceRecord | null;
  minutosTardeHoy: number;
  minutosSalidaAnticipadaHoy: number;
  minutosBalanceHoy: number;
  puedeRegistrarEntrada: boolean;
  puedeRegistrarSalida: boolean;
  mensaje: string;
};

type AttendanceActionResponse = {
  preview?: AttendancePreview;
  mensaje?: string;
  alerta?: string | null;
};

type AttendanceDashboard = {
  fecha: string;
  horaActual: string;
  movimientosRecientes: Array<{
    id: string;
    staffId: string;
    nombreCompleto: string;
    actividad: "Entrada" | "Salida";
    estado: string;
    fecha: string;
    hora: string;
  }>;
  usuariosActivos: Array<{
    id: string;
    staffId: string;
    nombreCompleto: string;
    rol: string;
    horaEntrada: string;
  }>;
  usuariosActivosAhora: Array<{
    id: string;
    staffId: string;
    nombreCompleto: string;
    rol: string;
    horaEntrada: string;
    horaSalida: string;
    estadoRegistro: "registrado" | "no registrado";
  }>;
  usuariosRegistradosAhora: Array<{
    id: string;
    staffId: string;
    nombreCompleto: string;
    rol: string;
    horaEntrada: string;
    horaSalida: string;
    estadoRegistro: "registrado" | "no registrado";
  }>;
  usuariosNoRegistradosAhora: Array<{
    id: string;
    staffId: string;
    nombreCompleto: string;
    rol: string;
    horaEntrada: string;
    horaSalida: string;
    estadoRegistro: "registrado" | "no registrado";
  }>;
  totalActivosAhora: number;
  totalRegistradosAhora: number;
  totalNoRegistradosAhora: number;
  totalPresentes: number;
};

type DashboardResponse = {
  dashboard?: AttendanceDashboard;
};

type AttendanceAutoAction = "entrada" | "salida";

const formatShortDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  });
};

const formatTimeOfDay = (value: string) => {
  const [hoursText = "0", minutesText = "0", secondsText = "0"] = value.split(":");
  const parsed = new Date(`1970-01-01T${hoursText.padStart(2, "0")}:${minutesText.padStart(2, "0")}:${secondsText.padStart(2, "0")}`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatShiftRange = (start: string, end: string) => `${start} - ${end}`;

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

function getCurrentWorkWeekDay(): string {
  return new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    timeZone: "America/Bogota",
  });
}

function getLiveStatusFromSchedules(jornadas: StaffJornadaItem[], pausas: StaffPausaItem[]): StaffLiveStatus {
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

  const isWithinJornada = jornadasToday.some((row) => currentMinutes >= row.start && currentMinutes < row.end);

  if (!isWithinJornada) return "Inactivo";

  const pausesToday = pausas
    .filter((row) => normalizeDayName(row.diaSemana) === todayKey)
    .map((row) => ({
      start: timeToMinutes(row.horaInicio),
      end: timeToMinutes(row.horaFin),
    }))
    .filter((row) => row.start >= 0 && row.end > row.start);

  const isInPause = pausesToday.some((row) => currentMinutes >= row.start && currentMinutes < row.end);

  if (isInPause) return "Descanso";
  return "Activo";
}

const getAutoActionFromPreview = (preview: AttendancePreview): AttendanceAutoAction | null => {
  if (preview.registroAbierto) {
    return preview.puedeRegistrarSalida ? "salida" : null;
  }

  return preview.puedeRegistrarEntrada ? "entrada" : null;
};

export default function RegistroPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cedula, setCedula] = useState("");
  const [preview, setPreview] = useState<AttendancePreview | null>(null);
  const [dashboard, setDashboard] = useState<AttendanceDashboard | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<AttendanceAutoAction | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [staffList, setStaffList] = useState<StaffApi[]>([]);
  const [liveJornadaByStaffId, setLiveJornadaByStaffId] = useState<Record<string, StaffJornadaItem[]>>({});
  const [livePausaByStaffId, setLivePausaByStaffId] = useState<Record<string, StaffPausaItem[]>>({});
  const [isLoadingLiveSchedules, setIsLoadingLiveSchedules] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowLabel, setNowLabel] = useState("");

  useEffect(() => {
    const currentSession = readAuthSession();
    setSession(currentSession);
    setSessionReady(true);
  }, []);

  const loadDashboard = async () => {
    setIsLoadingDashboard(true);
    try {
      const response = await fetchApiJson<DashboardResponse>("/api/registro/dashboard", { cache: "no-store" });
      setDashboard(response.dashboard ?? null);
    } catch {
      setDashboard(null);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const loadStaffNow = async () => {
    setIsLoadingLiveSchedules(true);

    try {
      const [staffResponse, jornadasResponse, pausasResponse] = await Promise.all([
        fetchApiJson<{ staff?: StaffApi[] }>("/api/staff", { cache: "no-store" }).catch(() => ({ staff: [] })),
        fetchApiJson<StaffJornadasBulkResponse>("/api/staff/jornadas-bulk", { cache: "no-store" }).catch(() => ({ jornadas: {} })),
        fetchApiJson<StaffPausasBulkResponse>("/api/staff/pausas-bulk", { cache: "no-store" }).catch(() => ({ pausas: {} })),
      ]);

      const nextStaff = Array.isArray(staffResponse.staff) ? staffResponse.staff : [];
      const jornadasByStaffId = (jornadasResponse.jornadas ?? {}) as Record<string, StaffJornadaItem[]>;
      const pausasByStaffId = (pausasResponse.pausas ?? {}) as Record<string, StaffPausaItem[]>;
      const jornadasMap: Record<string, StaffJornadaItem[]> = {};
      const pausasMap: Record<string, StaffPausaItem[]> = {};

      for (const staff of nextStaff) {
        jornadasMap[staff.id] = jornadasByStaffId[staff.id] ?? [];
        pausasMap[staff.id] = pausasByStaffId[staff.id] ?? [];
      }

      setStaffList(nextStaff);
      setLiveJornadaByStaffId(jornadasMap);
      setLivePausaByStaffId(pausasMap);
    } finally {
      setIsLoadingLiveSchedules(false);
    }
  };

  useEffect(() => {
    if (!sessionReady || (session?.role !== "admin" && session?.role !== "registro")) {
      return;
    }

    void loadDashboard();
    void loadStaffNow();
    const timer = window.setInterval(() => {
      void loadDashboard();
      void loadStaffNow();
    }, 30000);

    return () => window.clearInterval(timer);
  }, [session, sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session) {
      router.replace("/login/admin");
      return;
    }

    if (session.role !== "admin" && session.role !== "registro") {
      router.replace("/");
    }
  }, [router, session, sessionReady]);

  useEffect(() => {
    const updateClock = () => {
      setNowLabel(
        new Date().toLocaleString("es-CO", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "America/Bogota",
        })
      );
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadPreview = async (cedulaValue: string) => {
    const cleanCedula = cedulaValue.trim();
    if (!cleanCedula) {
      setError("Ingresa una cédula para continuar.");
      return null;
    }

    setIsLoadingPreview(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetchApiJson<{ preview?: AttendancePreview }>(`/api/registro/preview?cedula=${encodeURIComponent(cleanCedula)}`, {
        cache: "no-store",
      });
      const nextPreview = response.preview ?? null;
      setPreview(nextPreview);
      setMessage(nextPreview?.mensaje ?? null);
      return nextPreview;
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "No se pudo consultar el registro.";
      setPreview(null);
      setError(text);
      return null;
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleAction = async (action: AttendanceAutoAction) => {
    if (!cedula.trim()) {
      setError("Primero ingresa una cédula válida.");
      return;
    }

    setIsSubmitting(action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetchApiJson<AttendanceActionResponse>(`/api/registro/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedula: cedula.trim() }),
      });

      if (response.preview) {
        setPreview(response.preview);
      } else {
        await loadPreview(cedula);
      }

      await loadDashboard();

      const combinedMessage = [response.mensaje, response.alerta].filter(Boolean).join(" · ");
      setMessage(combinedMessage || "Operación completada correctamente.");
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "No se pudo registrar el movimiento.";
      setError(text);
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const consultedPreview = await loadPreview(cedula);

    if (!consultedPreview) {
      return;
    }

    const autoAction = getAutoActionFromPreview(consultedPreview);
    if (!autoAction) {
      setMessage(consultedPreview.mensaje);
      return;
    }

    await handleAction(autoAction);
  };

  const canRender = sessionReady && (session?.role === "admin" || session?.role === "registro");
  const currentAutoAction = preview ? getAutoActionFromPreview(preview) : null;
  const currentLiveStatusByStaffId = staffList.reduce<Record<string, StaffLiveStatus>>((accumulator, staff) => {
    if (staff.estado !== "Active") {
      return accumulator;
    }

    accumulator[staff.id] = getLiveStatusFromSchedules(liveJornadaByStaffId[staff.id] ?? [], livePausaByStaffId[staff.id] ?? []);
    return accumulator;
  }, {});

  const staffActivosAhora = staffList.filter((staff) => currentLiveStatusByStaffId[staff.id] === "Activo");
  const registroIdsHoy = new Set((dashboard?.usuariosActivos ?? []).map((item) => item.staffId));
  const staffRegistradosAhora = staffActivosAhora.filter((staff) => registroIdsHoy.has(staff.id));
  const staffNoRegistradosAhora = staffActivosAhora.filter((staff) => !registroIdsHoy.has(staff.id));

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef4f8] px-4">
        <div className="rounded-2xl border border-[#d7e4ed] bg-white px-5 py-4 text-sm font-medium text-[#566166] shadow-sm">
          Cargando sesión...
        </div>
      </div>
    );
  }

  if (!canRender) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#2a3439] px-6 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#2a3439] mb-2">Control de Asistencia</h1>
            <p className="text-[#566166] text-lg">Registra tu entrada o salida diaria ingresando tu número de identificación.</p>
          </div>
          <div className="bg-gradient-to-br from-[#3a5f94] to-[#2d5387] text-[#f6f7ff] p-6 rounded-2xl shadow-xl flex flex-col items-center justify-center min-w-[280px]">
            <div className="text-3xl font-extrabold tracking-tight mb-1">{nowLabel ? nowLabel.split(", ").slice(-1)[0] : "--:--:--"}</div>
            <div className="text-xs font-medium opacity-90 uppercase tracking-widest text-center">
              {nowLabel ? nowLabel.split(", ").slice(0, -1).join(", ") : "Cargando fecha"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 items-start">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
            <div className="bg-white rounded-3xl p-10 shadow-sm flex flex-col items-center text-center border border-slate-100">
              <label className="text-sm font-bold text-[#3a5f94] mb-6 uppercase tracking-widest" htmlFor="cedula">Verificación de Identidad</label>
              <form className="w-full max-w-md" onSubmit={handleSearch}>
                <input
                  id="cedula"
                  className="w-full text-center text-2xl font-bold py-5 border-0 border-b-2 border-[#d9e4ea] focus:border-[#3a5f94] focus:ring-0 bg-transparent transition-all placeholder:text-[#cfdce3]"
                  placeholder="Número de Cédula"
                  type="text"
                  value={cedula}
                  onChange={(event) => {
                    setCedula(event.target.value);
                    setPreview(null);
                    setError(null);
                    setMessage(null);
                  }}
                />
                <div className="mt-8 flex justify-center">
                  <button
                    className="bg-[#3a5f94] text-[#f6f7ff] px-10 py-4 rounded-xl font-bold hover:bg-[#2d5387] active:scale-[0.98] transition-all flex items-center gap-3"
                    type="submit"
                    disabled={isLoadingPreview}
                  >
                    {isLoadingPreview ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                        Consultando...
                      </>
                    ) : (
                      <>
                        <span>Consultar</span>
                        <span className="material-symbols-outlined text-xl">person_search</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {preview ? (
                <div className="mt-12 transition-all duration-500 flex flex-col items-center gap-6 w-full opacity-100">
                  <div className="flex items-center gap-4 bg-[#f0f4f7] px-6 py-3 rounded-full mb-2">
                    <img
                      alt={`Foto de ${preview.staff.nombres} ${preview.staff.apellidos}`}
                      className="h-12 w-12 rounded-full border-2 border-white object-cover object-center"
                      src={`/api/staff-photo/${encodeURIComponent(preview.staff.cedula)}`}
                    />
                    <div className="text-left">
                      <p className="font-bold text-[#2a3439]">{preview.staff.nombres} {preview.staff.apellidos}</p>
                      <p className="text-xs text-[#566166]">{preview.staff.rol} • {preview.diaSemana}</p>
                    </div>
                  </div>

                  <div className="w-full max-w-md rounded-2xl border border-[#d9e4ea] bg-[#f8fbfd] px-5 py-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3a5f94]">Registro automático</p>
                    <p className="mt-2 text-sm text-[#566166]">
                      {isSubmitting
                        ? `Registrando ${isSubmitting === "entrada" ? "entrada" : "salida"} automáticamente...`
                        : currentAutoAction
                          ? `El sistema registrará ${currentAutoAction === "entrada" ? "entrada" : "salida"} al consultar la cédula.`
                          : preview.mensaje}
                    </p>
                  </div>
                </div>
              ) : null}

              {error ? <p className="mt-6 w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
              {message ? <p className="mt-4 w-full max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-[#2a3439]">Movimientos Recientes</h3>
                <button className="text-[#3a5f94] text-sm font-semibold hover:underline" type="button">Ver Historial Completo</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[#566166] text-xs font-bold uppercase tracking-widest border-b border-[#f0f4f7]">
                      <th className="pb-4">Fecha</th>
                      <th className="pb-4">Actividad</th>
                      <th className="pb-4">Hora</th>
                      <th className="pb-4">Nombre</th>
                      <th className="pb-4 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {isLoadingDashboard && !dashboard ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-sm text-[#566166]">Cargando movimientos...</td>
                      </tr>
                    ) : dashboard && dashboard.movimientosRecientes.length > 0 ? (
                      dashboard.movimientosRecientes.slice(0, 12).map((movement) => (
                        <tr key={movement.id} className="hover:bg-[#f7f9fb] transition-colors border-t border-[#f0f4f7]">
                          <td className="py-5 font-medium">{formatShortDate(movement.fecha)}</td>
                          <td className="py-5">{movement.actividad}</td>
                          <td className="py-5">{formatTimeOfDay(movement.hora)}</td>
                          <td className="py-5 text-[#566166]">{movement.nombreCompleto}</td>
                          <td className="py-5 text-right">
                            <span className="px-3 py-1 rounded-full bg-[#e8eff3] text-[#4d5d73] text-[10px] font-bold uppercase">{movement.estado}</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-sm text-[#566166]">No hay movimientos recientes.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
            <div className="bg-[#f0f4f7] rounded-3xl p-8 flex flex-col gap-6 border border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#3a5f94]">group</span>
                  <h3 className="text-lg font-bold text-[#2a3439]">Trabajadores activos ahora</h3>
                </div>
                <span className="bg-[#d5e3ff] text-[#2c5287] px-3 py-1 rounded-full text-xs font-bold">{staffActivosAhora.length} En turno</span>
              </div>

              <div className="flex flex-col gap-5">
                

                {isLoadingDashboard || isLoadingLiveSchedules ? (
                  <p className="text-sm text-[#566166]">Cargando trabajadores de la hora actual...</p>
                ) : staffActivosAhora.length > 0 ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Registrados</p>
                      <div className="mt-3 space-y-3">
                        {staffRegistradosAhora.map((worker) => (
                          <div key={worker.id} className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                alt={`${worker.nombres} ${worker.apellidos}`}
                                className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover object-center shadow-sm"
                                src={`/api/staff-photo/${encodeURIComponent(worker.cedula)}`}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#2a3439]">{worker.nombres} {worker.apellidos}</p>
                                <p className="text-[11px] text-[#566166]">{worker.rol}</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-emerald-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">Registrado</span>
                          </div>
                        ))}
                        {staffRegistradosAhora.length === 0 ? <p className="text-sm text-[#566166]">Nadie registrado en este turno.</p> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">No registrados</p>
                      <div className="mt-3 space-y-3">
                        {staffNoRegistradosAhora.map((worker) => (
                          <div key={worker.id} className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                alt={`${worker.nombres} ${worker.apellidos}`}
                                className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover object-center shadow-sm"
                                src={`/api/staff-photo/${encodeURIComponent(worker.cedula)}`}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#2a3439]">{worker.nombres} {worker.apellidos}</p>
                                <p className="text-[11px] text-[#566166]">{worker.rol}</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">No registrado</span>
                          </div>
                        ))}
                        {staffNoRegistradosAhora.length === 0 ? <p className="text-sm text-[#566166]">Todos los del turno ya están registrados.</p> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#566166]">No hay trabajadores activos en este momento.</p>
                )}
              </div>

              
            </div>

            <div className="bg-[#f0f4f7] rounded-3xl p-8 border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-[#3a5f94]">info</span>
                <h3 className="text-lg font-bold text-[#2a3439]">Reglas de Operación</h3>
              </div>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#3a5f94] mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-[#2a3439] mb-1">Anticipación Permitida</p>
                    <p className="text-xs text-[#566166] leading-relaxed">Se permite el registro de entrada hasta 5 minutos antes del inicio del turno programado.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#3a5f94] mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-[#2a3439] mb-1">Balance de Horas</p>
                    <p className="text-xs text-[#566166] leading-relaxed">Los retrasos y salidas anticipadas afectan directamente el balance mensual de horas laborales.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#3a5f94] mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-[#2a3439] mb-1">Validación de Horario</p>
                    <p className="text-xs text-[#566166] leading-relaxed">El sistema utiliza el cronograma semanal asignado para la validación automática de registros.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
