type LostItemStatus = "Almacenado" | "Reclamado" | "Extraviado";

type LostItem = {
  id: string;
  icon: string;
  objeto: string;
  detalle: string;
  lugar: string;
  punto: string | null;
  reportadoPor: string;
  reportadoPorRol: string | null;
  fecha: string;
  hora: string;
  estado: LostItemStatus;
};

const lostItems: LostItem[] = [
  {
    id: "1",
    icon: "laptop_mac",
    objeto: "Portatil HP Pavilion",
    detalle: "Plata, stickers de codigo",
    lugar: "Biblioteca",
    punto: "Piso 3, Mesa 12",
    reportadoPor: "Dairo Luis",
    reportadoPorRol: "ESTUDIANTE",
    fecha: "24 Oct 2023",
    hora: "09:15 AM",
    estado: "Almacenado",
  },
  {
    id: "2",
    icon: "badge",
    objeto: "Carnet estudiantil",
    detalle: "Cod: 202110052",
    lugar: "Auditorio",
    punto: null,
    reportadoPor: "Personal de limpieza",
    reportadoPorRol: "STAFF",
    fecha: "23 Oct 2023",
    hora: "04:30 PM",
    estado: "Reclamado",
  },
  {
    id: "3",
    icon: "visibility",
    objeto: "Gafas de sol",
    detalle: "Marca Ray-Ban, estuche negro",
    lugar: "Salon 404",
    punto: null,
    reportadoPor: "Estudiante",
    reportadoPorRol: null,
    fecha: "22 Oct 2023",
    hora: "11:10 AM",
    estado: "Almacenado",
  },
  {
    id: "4",
    icon: "account_balance_wallet",
    objeto: "Billetera de cuero",
    detalle: "Cafe, contiene documentos",
    lugar: "Cafeteria Central",
    punto: null,
    reportadoPor: "Dairo Luis",
    reportadoPorRol: "ESTUDIANTE",
    fecha: "21 Oct 2023",
    hora: "02:45 PM",
    estado: "Extraviado",
  },
];

const statusStyle: Record<LostItemStatus, string> = {
  Almacenado: "bg-blue-50 text-blue-700 border border-blue-200",
  Reclamado: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Extraviado: "bg-rose-50 text-rose-700 border border-rose-200",
};

export default function ObjetosPerdidosPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#1A365D] sm:text-3xl">Gestion de Objetos Perdidos</h1>
            <p className="mt-1 text-sm text-slate-600">Registro y seguimiento de pertenencias encontradas en las instalaciones universitarias.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl bg-[#295786] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#1f456c]">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Agregar objeto perdido
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Almacenados</p>
          <p className="mt-2 text-3xl font-black text-[#295786]">124</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reclamados (Mes)</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">48</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevos Hoy</p>
          <p className="mt-2 text-3xl font-black text-slate-700">12</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tiempo Promedio</p>
          <p className="mt-2 text-3xl font-black text-slate-900">3.2 dias</p>
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
            />
          </div>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option>Estado: Todos</option>
              <option>Almacenado</option>
              <option>Reclamado</option>
              <option>Extraviado</option>
            </select>
            <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Filtros
            </button>
          </div>
        </div>
      </section>

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
              {lostItems.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#295786]">
                        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.objeto}</p>
                        <p className="text-xs text-slate-500">{item.detalle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-semibold text-slate-800">{item.lugar}</p>
                    {item.punto ? <p className="text-xs text-slate-500">{item.punto}</p> : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-800">{item.reportadoPor}</span>
                      {item.reportadoPorRol ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{item.reportadoPorRol}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-slate-800">{item.fecha}</p>
                    <p className="text-xs text-slate-500">{item.hora}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyle[item.estado]}`}>{item.estado}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                      <span className="material-symbols-outlined text-[20px]">more_vert</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-slate-600">Mostrando 1-10 de 124 objetos</p>
          <div className="flex items-center gap-1">
            <button className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button className="rounded bg-[#295786] px-3 py-1.5 text-xs font-bold text-white">1</button>
            <button className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">2</button>
            <button className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">3</button>
            <button className="rounded border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </section>

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
