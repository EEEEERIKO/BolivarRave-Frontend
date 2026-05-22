"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApiJson } from "@/lib/api-client";
import { readAuthSession, type AuthSession } from "@/lib/auth-session";

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

type PreviewResponse = {
  preview?: AttendancePreview;
};

type AttendanceActionResponse = {
  preview?: AttendancePreview;
  mensaje?: string;
  alerta?: string | null;
};

const formatLongDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return parsed.toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatClock = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  });
};

const formatMinutes = (minutes: number) => `${minutes} min`;

export default function RegistroPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [cedula, setCedula] = useState("");
  const [preview, setPreview] = useState<AttendancePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<"entrada" | "salida" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowLabel, setNowLabel] = useState("");

  useEffect(() => {
    const currentSession = readAuthSession();
    setSession(currentSession);
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!session) {
      router.replace("/login/admin");
      return;
    }

    if (session.role !== "admin") {
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
      return;
    }

    setIsLoadingPreview(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetchApiJson<PreviewResponse>(`/api/registro/preview?cedula=${encodeURIComponent(cleanCedula)}`, {
        cache: "no-store",
      });
      setPreview(response.preview ?? null);
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "No se pudo consultar el registro.";
      setPreview(null);
      setError(text);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadPreview(cedula);
  };

  const handleAction = async (action: "entrada" | "salida") => {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cedula: cedula.trim() }),
      });

      if (response.preview) {
        setPreview(response.preview);
      } else {
        await loadPreview(cedula);
      }

      const combinedMessage = [response.mensaje, response.alerta].filter(Boolean).join(" · ");
      setMessage(combinedMessage || "Operación completada correctamente.");
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : "No se pudo registrar el movimiento.";
      setError(text);
    } finally {
      setIsSubmitting(null);
    }
  };

  const canRender = sessionReady && session?.role === "admin";
  const activeStaff = preview?.staff;
  const activeJornada = preview?.jornadaActiva;

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(58,95,148,0.12),_transparent_38%),linear-gradient(180deg,#f7fafc_0%,#edf3f7_100%)] px-5 py-8 text-[#223038] sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-[0_24px_80px_rgba(31,41,55,0.10)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="inline-flex rounded-full bg-[#e3edf7] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-[#295786]">
                Registro de turno
              </p>
              <h1 className="text-3xl font-black tracking-tight text-[#1f3447] sm:text-4xl">Control de entrada y salida del personal</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#566166]">
                Registra la cédula del monitor o colaborador, valida su jornada laboral y deja persistido el minuto exacto de entrada o salida.
              </p>
            </div>
            <div className="rounded-2xl border border-[#d8e5ef] bg-[#f4f9fc] px-5 py-4 text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b8194]">Hora actual</p>
              <p className="mt-2 text-lg font-extrabold text-[#1f3447]">{nowLabel || "Cargando hora..."}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.75rem] border border-[#dce7ef] bg-white p-6 shadow-[0_20px_60px_rgba(31,41,55,0.08)] sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-[#e8f0f8] text-[#295786]">
                <span className="material-symbols-outlined">badge</span>
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#1f3447]">Buscar por cédula</h2>
                <p className="text-sm text-[#566166]">Consulta la jornada y registra la asistencia desde un solo punto.</p>
              </div>
            </div>

            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSearch}>
              <input
                value={cedula}
                onChange={(event) => setCedula(event.target.value)}
                className="w-full rounded-2xl border border-[#d4e0e8] bg-[#f8fbfd] px-4 py-3 text-sm text-[#223038] outline-none transition focus:border-[#3a5f94]"
                placeholder="Ingresa la cédula"
              />
              <button
                type="submit"
                disabled={isLoadingPreview}
                className="rounded-2xl bg-[#295786] px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoadingPreview ? "Consultando..." : "Consultar"}
              </button>
            </form>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleAction("entrada")}
                disabled={!preview?.puedeRegistrarEntrada || isSubmitting !== null}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#b6cfe3] bg-[#f4f9fc] px-4 py-4 text-sm font-bold text-[#295786] transition hover:bg-[#eaf2f8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">login</span>
                {isSubmitting === "entrada" ? "Registrando..." : "Registrar entrada"}
              </button>
              <button
                type="button"
                onClick={() => void handleAction("salida")}
                disabled={!preview?.puedeRegistrarSalida || isSubmitting !== null}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#1f3447] px-4 py-4 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                {isSubmitting === "salida" ? "Registrando..." : "Registrar salida"}
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[#d7e4ed] bg-[#fbfdff] p-4 text-sm text-[#52616c]">
              {preview ? preview.mensaje : "Ingresa una cédula para revisar la jornada disponible."}
            </div>

            {error ? <p className="mt-4 rounded-2xl border border-[#f0c2c2] bg-[#fff6f6] px-4 py-3 text-sm font-semibold text-[#9c2f2f]">{error}</p> : null}
            {message ? <p className="mt-4 rounded-2xl border border-[#cce0d4] bg-[#f5fbf6] px-4 py-3 text-sm font-semibold text-[#21533a]">{message}</p> : null}

            {activeStaff ? (
              <div className="mt-6 rounded-[1.5rem] border border-[#dce7ef] bg-gradient-to-br from-white to-[#f7fbfe] p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b8194]">Persona encontrada</p>
                    <h3 className="mt-2 text-xl font-extrabold text-[#1f3447]">
                      {activeStaff.nombres} {activeStaff.apellidos}
                    </h3>
                    <p className="mt-1 text-sm text-[#566166]">
                      {activeStaff.rol} · Cédula {activeStaff.cedula} · {activeStaff.estado}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#eaf2f8] px-4 py-3 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b8194]">Balance actual</p>
                    <p className="mt-1 text-lg font-extrabold text-[#1f3447]">{activeStaff.balanceHoras.toFixed(2)} h</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b8194]">Jornada activa</p>
                    <p className="mt-2 text-sm font-semibold text-[#1f3447]">
                      {activeJornada ? `${activeJornada.horaEntrada} - ${activeJornada.horaSalida}` : "Sin jornada activa"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b8194]">Tardanza hoy</p>
                    <p className="mt-2 text-sm font-semibold text-[#1f3447]">{formatMinutes(preview.minutosTardeHoy)}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b8194]">Salida anticipada</p>
                    <p className="mt-2 text-sm font-semibold text-[#1f3447]">{formatMinutes(preview.minutosSalidaAnticipadaHoy)}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[1.75rem] border border-[#dce7ef] bg-white p-6 shadow-[0_20px_60px_rgba(31,41,55,0.08)]">
              <h2 className="text-lg font-bold text-[#1f3447]">Reglas activas</h2>
              <div className="mt-4 space-y-3 text-sm text-[#566166]">
                <div className="rounded-2xl bg-[#f7fbfe] p-4">La entrada solo se permite desde 5 minutos antes de la hora programada.</div>
                <div className="rounded-2xl bg-[#f7fbfe] p-4">Cada minuto de tardanza o salida anticipada se acumula en el balance de horas.</div>
                <div className="rounded-2xl bg-[#f7fbfe] p-4">El sistema usa la jornada semanal del personal para validar el turno correcto.</div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[#dce7ef] bg-white p-6 shadow-[0_20px_60px_rgba(31,41,55,0.08)]">
              <h2 className="text-lg font-bold text-[#1f3447]">Movimientos de hoy</h2>
              {preview?.registrosHoy?.length ? (
                <div className="mt-4 space-y-3">
                  {preview.registrosHoy.map((registro) => (
                    <div key={registro.id} className="rounded-2xl bg-[#f7fbfe] p-4 text-sm text-[#566166]">
                      <p className="font-bold text-[#1f3447]">Jornada {registro.jornadaId.slice(0, 8)}</p>
                      <p className="mt-1">Entrada: {registro.horaEntrada ? formatClock(registro.horaEntrada) : "Pendiente"}</p>
                      <p>Salida: {registro.horaSalida ? formatClock(registro.horaSalida) : "Pendiente"}</p>
                      <p className="mt-1 text-xs text-[#6b8194]">
                        Tarde: {registro.minutosTarde} min · Anticipada: {registro.minutosSalidaAnticipada} min · Balance: {registro.minutosBalance} min
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-[#f7fbfe] p-4 text-sm text-[#566166]">Aún no hay movimientos registrados para la cédula consultada.</p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}