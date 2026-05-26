"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";

type AuditorioReservaApi = {
  id: string;
  nombreEvento: string;
  organizador: string;
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
  numeroAsistentes: number;
  requierePantalla: boolean;
  requiereSonido: boolean;
  requiereMonitor: boolean;
  requiereProyector: boolean;
  requiereFiltroAgua: boolean;
  observaciones: string | null;
  estado: string;
  fechaCreacion: string;
  horarios: Array<{
    id: string;
    fechaEspecifica: string;
    horaInicio: string;
    horaFin: string;
  }>;
};

function formatDateKey(iso: string) {
  return iso;
}

export default function PublicAuditorioPage() {
  const [reservas, setReservas] = useState<AuditorioReservaApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendees, setAttendees] = useState(1);
  const [needsScreen, setNeedsScreen] = useState(false);
  const [needsSound, setNeedsSound] = useState(false);
  const [needsMonitor, setNeedsMonitor] = useState(false);
  const [needsProjector, setNeedsProjector] = useState(false);
  const [needsWaterFilter, setNeedsWaterFilter] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const resp = await fetchApiJson<{ reservas?: AuditorioReservaApi[] }>("/api/auditorio/reservas", { cache: "no-store" });
        if (!mounted) return;
        setReservas(resp.reservas ?? []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !organizer.trim() || !date) {
      alert("Completa título, organizador y fecha.");
      return;
    }

    const payload = {
      nombreEvento: title.trim(),
      organizador: organizer.trim(),
      fechaInicioPeriodo: date,
      fechaFinPeriodo: date,
      numeroAsistentes: Number(attendees) || 1,
      requierePantalla: needsScreen,
      requiereSonido: needsSound,
      requiereMonitor: needsMonitor,
      requiereProyector: needsProjector,
      requiereFiltroAgua: needsWaterFilter,
      observaciones: notes.trim() || null,
      horarios: [
        {
          fechaEspecifica: date,
          horaInicio: startTime,
          horaFin: endTime,
        },
      ],
    };

    try {
      setSubmitting(true);
      await fetchApiJson<{ message?: string; reservaId?: string }>("/api/auditorio/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      alert("Solicitud enviada. Gracias — el auditorio revisará y confirmará.");
      // reset form
      setTitle("");
      setOrganizer("");
      setDate("");
      setStartTime("08:00");
      setEndTime("10:00");
      setAttendees(1);
      setNeedsScreen(false);
      setNeedsSound(false);
      setNeedsMonitor(false);
      setNeedsProjector(false);
      setNeedsWaterFilter(false);
      setNotes("");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const sorted = useMemo(() => (reservas ?? []).slice().sort((a, b) => a.fechaInicioPeriodo.localeCompare(b.fechaInicioPeriodo)), [reservas]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">Auditorio (público)</h1>
        <p className="text-sm text-[#566166]">Consulta los horarios públicos y solicita un evento.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="font-semibold mb-4">Próximas reservas</h2>
          {loading ? <p className="text-sm text-[#566166]">Cargando...</p> : null}
          {sorted.length === 0 && !loading ? <p className="text-sm text-[#566166]">No hay reservas publicadas.</p> : null}
          <ul className="space-y-4">
            {sorted.map((r) => (
              <li key={r.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{r.nombreEvento}</div>
                    <div className="text-sm text-[#566166]">{r.organizador}</div>
                  </div>
                  <div className="text-sm text-[#3a5f94]">{formatDateKey(r.fechaInicioPeriodo)}</div>
                </div>
                <div className="mt-2 text-sm text-[#566166]">{r.horarios.map(h => `${h.fechaEspecifica} ${h.horaInicio}-${h.horaFin}`).join(" · ")}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="font-semibold mb-4">Solicitar evento</h2>
          <form onSubmit={submitRequest} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 p-2 border rounded" />
            </div>

            <div>
              <label className="text-sm font-medium">Organizador</label>
              <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} className="w-full mt-1 p-2 border rounded" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-sm font-medium">Fecha</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-2 border rounded" />
              </div>
              <div>
                <label className="text-sm font-medium">Inicio</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full mt-1 p-2 border rounded" />
              </div>
              <div>
                <label className="text-sm font-medium">Fin</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full mt-1 p-2 border rounded" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Asistentes estimados</label>
              <input type="number" min={1} value={attendees} onChange={(e) => setAttendees(Number(e.target.value))} className="w-36 mt-1 p-2 border rounded" />
            </div>

            <div className="flex gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={needsScreen} onChange={(e) => setNeedsScreen(e.target.checked)} /> Pantalla</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={needsSound} onChange={(e) => setNeedsSound(e.target.checked)} /> Sonido</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={needsMonitor} onChange={(e) => setNeedsMonitor(e.target.checked)} /> Monitor</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={needsProjector} onChange={(e) => setNeedsProjector(e.target.checked)} /> Proyector</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={needsWaterFilter} onChange={(e) => setNeedsWaterFilter(e.target.checked)} /> Filtro de agua</label>
            </div>

            <div>
              <label className="text-sm font-medium">Observaciones</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full mt-1 p-2 border rounded" rows={3} />
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={submitting} className="bg-[#3a5f94] text-white px-4 py-2 rounded">{submitting ? "Enviando..." : "Solicitar evento"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
