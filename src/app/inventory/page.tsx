"use client";

import { useMemo, useRef, useState } from "react";

type ProductGroup = {
  id: string;
  name: string;
  icon: string;
  badge: "Operativo" | "Revisar";
  badgeClass: string;
};

type InventoryItem = {
  id: string;
  groupId: string;
  itemName: string;
  model: string;
  location: string;
  status: "Disponible" | "Defectuoso";
};

const PRODUCT_GROUPS: ProductGroup[] = [
  { id: "televisores", name: "Televisores", icon: "tv", badge: "Operativo", badgeClass: "bg-[#d5e3ff] text-[#2c5287]" },
  { id: "hdmi", name: "Cables HDMI", icon: "cable", badge: "Operativo", badgeClass: "bg-[#d5e3ff] text-[#2c5287]" },
  { id: "svg", name: "Cables SVG", icon: "settings_ethernet", badge: "Revisar", badgeClass: "bg-[#fe8983]/20 text-[#752121]" },
  { id: "poder", name: "Cables de Poder", icon: "power", badge: "Operativo", badgeClass: "bg-[#d5e3ff] text-[#2c5287]" },
  { id: "altavoces", name: "Altavoces", icon: "speaker", badge: "Revisar", badgeClass: "bg-[#fe8983]/20 text-[#752121]" },
  { id: "microfonos", name: "Microfonos", icon: "mic", badge: "Operativo", badgeClass: "bg-[#d5e3ff] text-[#2c5287]" },
  { id: "mesas", name: "Mesas de Sonido", icon: "graphic_eq", badge: "Operativo", badgeClass: "bg-[#d5e3ff] text-[#2c5287]" },
  { id: "adaptadores", name: "Adaptadores", icon: "settings_input_component", badge: "Revisar", badgeClass: "bg-[#fe8983]/20 text-[#752121]" },
  { id: "rtc", name: "RTC", icon: "router", badge: "Operativo", badgeClass: "bg-[#d5e3ff] text-[#2c5287]" },
];

const INVENTORY_ITEMS: InventoryItem[] = [
  { id: "tv-1", groupId: "televisores", itemName: "Samsung 65 4K", model: "Series 8", location: "Piso 3 - Salon 302", status: "Disponible" },
  { id: "tv-2", groupId: "televisores", itemName: "Sony Bravia 55", model: "BX-500", location: "Piso 2 - Salon 201", status: "Defectuoso" },
  { id: "hdmi-1", groupId: "hdmi", itemName: "HDMI 2.1 15ft", model: "Shielded", location: "Bodega A", status: "Disponible" },
  { id: "hdmi-2", groupId: "hdmi", itemName: "HDMI 2.0 10ft", model: "Campus Pro", location: "Bodega A", status: "Disponible" },
  { id: "svg-1", groupId: "svg", itemName: "Cable SVG 3m", model: "Legacy Line", location: "Soporte TI", status: "Defectuoso" },
  { id: "pwr-1", groupId: "poder", itemName: "Cable Poder 1.5m", model: "3 Prong", location: "Piso 1 - Cuarto Electrico", status: "Disponible" },
  { id: "spk-1", groupId: "altavoces", itemName: "JBL Ceiling A1", model: "Control Series", location: "Auditorio", status: "Defectuoso" },
  { id: "mic-1", groupId: "microfonos", itemName: "Shure SM58", model: "Wireless", location: "Cabina Audio", status: "Disponible" },
  { id: "mix-1", groupId: "mesas", itemName: "Yamaha MG16", model: "Mix Console", location: "Cabina Audio", status: "Disponible" },
  { id: "adp-1", groupId: "adaptadores", itemName: "HDMI a VGA", model: "Multiport", location: "Soporte TI", status: "Defectuoso" },
  { id: "rtc-1", groupId: "rtc", itemName: "RTC Router Core", model: "Campus R1", location: "NOC", status: "Disponible" },
];

export default function InventoryPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(PRODUCT_GROUPS[0].id);
  const groupsScrollRef = useRef<HTMLDivElement | null>(null);

  const selectedGroup = useMemo(
    () => PRODUCT_GROUPS.find((group) => group.id === selectedGroupId) ?? PRODUCT_GROUPS[0],
    [selectedGroupId],
  );

  const selectedItems = useMemo(
    () => INVENTORY_ITEMS.filter((item) => item.groupId === selectedGroupId),
    [selectedGroupId],
  );

  const defectiveCount = useMemo(
    () => selectedItems.filter((item) => item.status === "Defectuoso").length,
    [selectedItems],
  );

  const countByGroup = useMemo(() => {
    const map = new Map<string, number>();
    INVENTORY_ITEMS.forEach((item) => {
      map.set(item.groupId, (map.get(item.groupId) ?? 0) + 1);
    });
    return map;
  }, []);

  const scrollGroups = (direction: "left" | "right") => {
    const container = groupsScrollRef.current;
    if (!container) return;

    const amount = Math.max(220, Math.floor(container.clientWidth * 0.6));
    container.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <div className="w-full max-w-full min-w-0 flex-1 space-y-8 overflow-x-hidden p-4 md:p-8">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-lg bg-[#d5e3ff]/40 p-2 text-[#3a5f94]">analytics</span>
            <span className="text-[10px] font-bold tracking-widest text-[#3a5f94] uppercase">Live Status</span>
          </div>
          <h4 className="mb-1 text-sm font-medium text-[#566166]">Grupos Activos</h4>
          <div className="text-3xl font-extrabold tracking-tight text-[#2a3439]">{PRODUCT_GROUPS.length}</div>
          <div className="mt-2 flex items-center text-[11px] text-[#566166]">Categorias de inventario registradas</div>
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-lg bg-[#d9d7f8]/40 p-2 text-[#5d5d78]">warning</span>
            <span className="text-[10px] font-bold tracking-widest text-[#5d5d78] uppercase">Action Required</span>
          </div>
          <h4 className="mb-1 text-sm font-medium text-[#566166]">Elementos Defectuosos</h4>
          <div className="text-3xl font-extrabold tracking-tight text-[#2a3439]">
            {INVENTORY_ITEMS.filter((item) => item.status === "Defectuoso").length}
          </div>
          <div className="mt-2 flex items-center text-[11px] text-[#566166]">Pendientes por mantenimiento</div>
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-lg bg-[#d3e4fe]/40 p-2 text-[#506076]">inventory_2</span>
            <span className="text-[10px] font-bold tracking-widest text-[#506076] uppercase">Inventory</span>
          </div>
          <h4 className="mb-1 text-sm font-medium text-[#566166]">Total de Elementos</h4>
          <div className="text-3xl font-extrabold tracking-tight text-[#2a3439]">{INVENTORY_ITEMS.length}</div>
          <div className="mt-2 flex items-center text-[11px] text-[#566166]">Datos demo (quemados)</div>
        </div>
      </section>

      <section className="w-full max-w-full min-w-0 overflow-hidden">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#1A365D]">Grupos de Inventario</h2>
            <p className="text-sm text-[#566166]">Desliza horizontalmente y haz click para cargar Asset Details abajo</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="Desplazar grupos a la izquierda"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[#3a5f94] transition hover:bg-slate-50"
              onClick={() => scrollGroups("left")}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              aria-label="Desplazar grupos a la derecha"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-[#3a5f94] transition hover:bg-slate-50"
              onClick={() => scrollGroups("right")}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="w-full max-w-full min-w-0 overflow-hidden">
          <div
            className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent"
            ref={groupsScrollRef}
          >
            <div className="flex w-max flex-nowrap gap-4 pr-1">
              {PRODUCT_GROUPS.map((group) => {
                const groupCount = countByGroup.get(group.id) ?? 0;
                return (
                  <div
                    className={`group w-32 shrink-0 cursor-pointer rounded-xl border bg-white p-4 transition-all hover:shadow-lg sm:w-36 ${
                      selectedGroupId === group.id ? "border-[#3a5f94]/40 ring-2 ring-[#3a5f94]/15" : "border-slate-200/60"
                    }`}
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedGroupId(group.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="relative mb-3 flex h-24 items-center justify-center overflow-hidden rounded-lg bg-[#f0f4f7]">
                      <span className="material-symbols-outlined rounded-lg p-2 text-4xl text-[#3a5f94]/40 transition-transform duration-300 group-hover:scale-110">
                        {group.icon}
                      </span>
                      <div className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-tight uppercase ${group.badgeClass}`}>
                        {group.badge}
                      </div>
                    </div>
                    <h5 className="mb-0.5 text-sm font-bold text-[#2a3439]">{group.name}</h5>
                    <p className="text-[11px] font-medium text-[#566166]">{groupCount} elementos</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-extrabold tracking-tight text-[#1A365D]">Asset Details</h3>
          <button className="material-symbols-outlined text-lg text-[#566166]">more_vert</button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <h2 className="text-xl font-bold text-[#2a3439]">{selectedGroup.name}</h2>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg bg-[#f0f4f7] p-3">
                <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Cantidad de Elementos</p>
                <p className="mt-1 text-xl font-extrabold text-[#2a3439]">{selectedItems.length}</p>
              </div>
              <div className="rounded-lg bg-[#f0f4f7] p-3">
                <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Elementos Defectuosos</p>
                <p className="mt-1 text-xl font-extrabold text-[#9f403d]">{defectiveCount}</p>
              </div>
            </div>
            <button className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#566166] hover:bg-slate-50" type="button">
              Editar
            </button>
            <p className="mt-2 text-[10px] text-[#566166]">Estos datos estan quemados por ahora, luego iran conectados a la base de datos.</p>
          </div>

          <div className="xl:col-span-2">
            <h4 className="mb-3 text-sm font-bold text-[#2a3439]">Lista de Elementos</h4>
            {selectedItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {selectedItems.map((item) => (
                  <div className="rounded-lg bg-[#f0f4f7]/60 p-3" key={item.id}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e8eff3] text-[#3a5f94]">
                        <span className="material-symbols-outlined text-base">{selectedGroup.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#2a3439]">{item.itemName}</p>
                        <p className="truncate text-[10px] text-[#566166]">{item.model}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px] text-[#566166]">{item.location}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.status === "Defectuoso" ? "bg-[#fe8983]/20 text-[#752121]" : "bg-[#d5e3ff] text-[#2c5287]"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#566166]">No hay elementos para este grupo.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
