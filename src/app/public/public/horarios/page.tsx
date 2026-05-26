"use client";

import { useEffect, useState } from "react";
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

export default function PublicHorariosPage() {
  const [reservas, setReservas] = useState<AuditorioReservaApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const eventsByDate: Record<string, AuditorioReservaApi[]> = {};
  reservas.forEach((r) => {
    r.horarios.forEach((h) => {
      eventsByDate[h.fechaEspecifica] = eventsByDate[h.fechaEspecifica] ?? [];
      if (!eventsByDate[h.fechaEspecifica].some((er) => er.id === r.id)) eventsByDate[h.fechaEspecifica].push(r);
    });
  });

  const sortedDates = Object.keys(eventsByDate).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Horarios públicos - Auditorio</h1>
      {loading ? <p className="text-sm text-[#566166]">Cargando horarios...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {sortedDates.length === 0 && !loading ? (
        <p className="text-sm text-[#566166]">No hay reservas publicadas.</p>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date} className="rounded-2xl border border-slate-100 bg-white p-4">
              <h3 className="font-semibold mb-3">{date}</h3>
              <ul className="space-y-2">
                {eventsByDate[date].map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{ev.nombreEvento}</div>
                      <div className="text-sm text-[#566166]">{ev.organizador} — {ev.numeroAsistentes} asistentes</div>
                    </div>
                    <div className="text-sm text-[#3a5f94]">{ev.horarios.find(h => h.fechaEspecifica === date)?.horaInicio} — {ev.horarios.find(h => h.fechaEspecifica === date)?.horaFin}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
