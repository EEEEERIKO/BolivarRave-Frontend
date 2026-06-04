"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";

type LostItemStatus = "dueno_no_encontrado" | "dado_de_baja" | "objeto_devuelto";

type LostItem = {
  id: string;
  objeto: string;
  lugar: string;
  quienLoTrajo: string;
  fechaHallazgo: string;
  estado: LostItemStatus;
  icono: string;
};

type LostItemStats = {
  total: number;
  duenio_no_encontrado: number;
  dado_de_baja: number;
  objeto_devuelto: number;
  nuevos_hoy: number;
};

type LostItemsResponse = {
  items: LostItem[];
  stats: LostItemStats;
};

const statusLabel: Record<LostItemStatus, string> = {
  dueno_no_encontrado: "Dueño no encontrado",
  dado_de_baja: "Dado de baja",
  objeto_devuelto: "Objeto devuelto",
};

const statusStyle: Record<LostItemStatus, string> = {
  dueno_no_encontrado: "bg-amber-50 text-amber-700 border border-amber-200",
  dado_de_baja: "bg-rose-50 text-rose-700 border border-rose-200",
  objeto_devuelto: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const emptyStats: LostItemStats = {
  total: 0,
  duenio_no_encontrado: 0,
  dado_de_baja: 0,
  objeto_devuelto: 0,
  nuevos_hoy: 0,
};

const formatDateTime = (isoValue: string) => {
  const date = new Date(isoValue);
  return {
    date: date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
  };
};

export default function ObjetosPerdidosPage() {
  const [items, setItems] = useState<LostItem[]>([]);
  const [stats, setStats] = useState<LostItemStats>(emptyStats);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LostItemStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [objeto, setObjeto] = useState("");
  const [lugar, setLugar] = useState("");
  const [quienLoTrajo, setQuienLoTrajo] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (search.trim().length > 0) query.set("search", search.trim());
      if (statusFilter !== "all") query.set("status", statusFilter);

      const response = await fetchApiJson<LostItemsResponse>(`/api/objetos-perdidos/items?${query.toString()}`);
      setItems(response.items ?? []);
      setStats(response.stats ?? emptyStats);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "No se pudieron cargar los objetos perdidos";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const canSubmit = useMemo(() => {
    return objeto.trim().length >= 2 && lugar.trim().length >= 2 && quienLoTrajo.trim().length >= 2;
  }, [objeto, lugar, quienLoTrajo]);

  const handleCreate = async () => {
    if (!canSubmit || saving) return;

    setSaving(true);
    setError(null);
    try {
      await fetchApiJson<{ message: string; item: LostItem }>("/api/objetos-perdidos/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objeto: objeto.trim(),
          lugar: lugar.trim(),
          quienLoTrajo: quienLoTrajo.trim(),
        }),
      });

      setOpenCreateModal(false);
      setObjeto("");
      setLugar("");
      setQuienLoTrajo("");
      await loadItems();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "No se pudo registrar el objeto";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: LostItemStatus) => {
    setActionLoadingId(id);
    setError(null);

    try {
      await fetchApiJson<{ message: string; item: LostItem }>(`/api/objetos-perdidos/items/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });

      await loadItems();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "No se pudo actualizar el estado";
      setError(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#1A365D] sm:text-3xl">Gestion de Objetos Perdidos</h1>
            <p className="mt-1 text-sm text-slate-600">Registro y seguimiento de pertenencias encontradas en las instalaciones universitarias.</p>
          </div>
          <button
            onClick={() => setOpenCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#295786] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1f456c]"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Agregar objeto perdido
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total registrados</p>
          <p className="mt-2 text-3xl font-black text-[#295786]">{stats.total}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dueño no encontrado</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{stats.duenio_no_encontrado}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objeto devuelto</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">{stats.objeto_devuelto}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevos hoy</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{stats.nuevos_hoy}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-10 text-sm outline-none transition focus:border-[#295786]/40 focus:bg-white focus:ring-2 focus:ring-[#295786]/10"
              placeholder="Buscar por objeto, lugar o persona..."
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | LostItemStatus)}
            >
              <option value="all">Estado: Todos</option>
              <option value="dueno_no_encontrado">Dueño no encontrado</option>
              <option value="objeto_devuelto">Objeto devuelto</option>
              <option value="dado_de_baja">Dado de baja</option>
            </select>
            <button
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => void loadItems()}
            >
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Aplicar
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Objeto</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Lugar</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Quien lo trajo</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Fecha de hallazgo</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>Cargando objetos perdidos...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-500" colSpan={6}>No hay objetos registrados con los filtros actuales.</td>
                </tr>
              ) : (
                items.map((item) => {
                  const dateTime = formatDateTime(item.fechaHallazgo);
                  const isPendingOwner = item.estado === "dueno_no_encontrado";

                  return (
                    <tr key={item.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#295786]">
                            <span className="material-symbols-outlined text-[20px]">{item.icono}</span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">{item.objeto}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-800">{item.lugar}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-800">{item.quienLoTrajo}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-slate-800">{dateTime.date}</p>
                        <p className="text-xs text-slate-500">{dateTime.time}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[item.estado]}`}>{statusLabel[item.estado]}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <details className="relative inline-block text-left">
                          <summary className="list-none rounded border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                            Acciones
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                            <button
                              className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!isPendingOwner || actionLoadingId === item.id}
                              onClick={() => void updateStatus(item.id, "dado_de_baja")}
                            >
                              Dar de baja
                            </button>
                            <button
                              className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!isPendingOwner || actionLoadingId === item.id}
                              onClick={() => void updateStatus(item.id, "objeto_devuelto")}
                            >
                              Objeto devuelto
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {openCreateModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-[#1A365D]">Agregar objeto perdido</h2>
                <p className="mt-1 text-xs text-slate-600">La fecha de hallazgo se registra automaticamente y el estado inicial sera Dueño no encontrado.</p>
              </div>
              <button
                onClick={() => setOpenCreateModal(false)}
                className="rounded p-1 text-slate-500 transition hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Objeto</label>
                <input
                  value={objeto}
                  onChange={(event) => setObjeto(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#295786]/40 focus:ring-2 focus:ring-[#295786]/10"
                  placeholder="Ej: Portatil Lenovo"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Lugar</label>
                <input
                  value={lugar}
                  onChange={(event) => setLugar(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#295786]/40 focus:ring-2 focus:ring-[#295786]/10"
                  placeholder="Ej: Salon 404"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Quien lo trajo</label>
                <input
                  value={quienLoTrajo}
                  onChange={(event) => setQuienLoTrajo(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#295786]/40 focus:ring-2 focus:ring-[#295786]/10"
                  placeholder="Ej: Carlos Perez"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpenCreateModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={!canSubmit || saving}
                className="rounded-lg bg-[#295786] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1f456c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-blue-700">info</span>
          <p className="text-sm text-blue-900">Cualquier objeto no reclamado despues de 90 dias sera procesado segun la normativa institucional.</p>
        </div>
        <button className="text-sm font-bold text-blue-700 transition hover:underline">Ver Normativa</button>
      </section>
    </div>
  );
}
