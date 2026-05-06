"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";

type ResourceType = "rooms" | "equipment";

type BookingResource = {
    id: string;
    type: ResourceType;
    label: string;
    floor: string;
    capacity: number;
    accent: string;
    description: string;
    tags: string[];
};

// Rooms come from the backend; we initialize an empty array and populate at runtime.
const ROOM_RESOURCES: BookingResource[] = [];

// Inventory integration: load groups and items from backend and map to BookingResource
type InventoryGroup = { id: string; name: string; icon?: string; order?: number; itemCount?: number };
type InventoryItem = { id: string; groupId: string; groupName: string; groupIcon?: string; name: string; code: string; room: string; status: string; defective: boolean; motivo?: string | null };

// We'll populate items dynamically when user selects a group.

function getBogotaTodayKey() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    const parts = formatter.formatToParts(new Date());
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "01";
    const day = parts.find((part) => part.type === "day")?.value ?? "01";

    return `${year}-${month}-${day}`;
}

function formatTime(value: string) {
    if (!value) {
        return "--:--";
    }

    const [hoursText = "", minutesText = ""] = value.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return value;
    }

    const suffix = hours >= 12 ? "PM" : "AM";
    const normalizedHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDuration(start: string, end: string) {
    if (!start || !end) {
        return "Sin rango definido";
    }

    return `${formatTime(start)} - ${formatTime(end)}`;
}

function resourceLabel(resource: BookingResource) {
    return `${resource.label} · ${resource.floor}`;
}

function resourceTypeLabel(type: ResourceType) {
    return type === "rooms" ? "Salones" : "Equipos";
}

export default function ReservasPage() {
    const todayKey = useMemo(() => getBogotaTodayKey(), []);
    const [resourceType, setResourceType] = useState<ResourceType>("rooms");
    const [selectedResourceId, setSelectedResourceId] = useState<string>("");
    const [bookingDate, setBookingDate] = useState(todayKey);
    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("10:00");
    const [purpose, setPurpose] = useState("");
    const [fullName, setFullName] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(selectedResourceId);
    const [roomsCatalog, setRoomsCatalog] = useState<BookingResource[]>([]);
    const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>("");
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

    const visibleResources = resourceType === "rooms" ? roomsCatalog : inventoryItems.map((it) => ({
        id: it.id,
        type: "equipment" as const,
        label: it.name,
        floor: it.groupName ?? "",
        capacity: 1,
        accent: "#4d5d73",
        description: it.room ?? it.code ?? "",
        tags: [it.code || "", it.status || ""].filter(Boolean),
    } as BookingResource));

    useEffect(() => {
        let cancelled = false;

        const loadRoomsInfo = async () => {
            try {
                // Prefer detailed rooms info; fall back to simple rooms list if needed
                const info = await fetchApiJson<any>("/api/schedules/rooms-info", { cache: "no-store" }).catch(() => null);
                if (cancelled) return;

                if (info && Array.isArray(info.roomsByFloor)) {
                    const flattened = info.roomsByFloor.flat().filter(Boolean).map((r: any) => ({
                        id: r.id ?? r.nombre ?? `${r.nombre ?? "room"}-${Math.random()}`,
                        type: "rooms" as const,
                        label: r.nombre ?? "",
                        floor: r.piso != null ? `PISO ${r.piso}` : (r.piso ?? ""),
                        capacity: r.capacidad ?? 0,
                        accent: "#3a5f94",
                        description: r.facultad ?? "",
                        tags: [],
                    }));

                    // dedupe by label
                    const seen = new Set<string>();
                    const unique = flattened.filter((x: any) => {
                        const key = (x.label || "").trim().toLowerCase();
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });

                    setRoomsCatalog(unique);
                    return;
                }

                // fallback: simple rooms endpoint returns array of strings
                const simple = await fetchApiJson<{ rooms?: string[] }>("/api/schedules/rooms", { cache: "no-store" }).catch(() => ({ rooms: [] }));
                if (cancelled) return;
                const simpleList = (simple.rooms ?? []).map((name) => ({
                    id: name,
                    type: "rooms" as const,
                    label: name,
                    floor: "",
                    capacity: 0,
                    accent: "#3a5f94",
                    description: "",
                    tags: [],
                }));

                setRoomsCatalog(Array.from(new Map(simpleList.map((r) => [r.label.trim().toLowerCase(), r])).values()));
            } catch {
                // ignore, keep empty catalog
            }
        };

        void loadRoomsInfo();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (resourceType !== "equipment") return;

        let cancelled = false;

        const loadGroups = async () => {
            try {
                const res = await fetchApiJson<{ groups?: InventoryGroup[] }>("/api/inventory/groups", { cache: "no-store" }).catch(() => ({ groups: [] }));
                if (cancelled) return;
                const groups = res.groups ?? [];
                setInventoryGroups(groups);
                if (groups.length > 0) {
                    setSelectedGroupId((current) => (current ? current : groups[0].id));
                }
            } catch {
                // ignore
            }
        };

        void loadGroups();

        return () => {
            cancelled = true;
        };
    }, [resourceType]);

    useEffect(() => {
        if (resourceType !== "equipment") return;
        if (!selectedGroupId) {
            setInventoryItems([]);
            return;
        }

        let cancelled = false;

        const loadItems = async () => {
            try {
                const res = await fetchApiJson<{ items?: InventoryItem[] }>(`/api/inventory/items?groupId=${selectedGroupId}`, { cache: "no-store" }).catch(() => ({ items: [] }));
                if (cancelled) return;
                setInventoryItems(res.items ?? []);
            } catch {
                // ignore
            }
        };

        void loadItems();

        return () => {
            cancelled = true;
        };
    }, [selectedGroupId, resourceType]);

    useEffect(() => {
        const nextDefault = visibleResources[0]?.id ?? "";
        setSelectedResourceId((current) => (visibleResources.some((resource) => resource.id === current) ? current : nextDefault));
        setSelectedCardId((current) => (visibleResources.some((resource) => resource.id === current) ? current : nextDefault));
    }, [resourceType, visibleResources]);

    const selectedResource = useMemo(
        () => visibleResources.find((resource) => resource.id === selectedResourceId) ?? visibleResources[0] ?? null,
        [selectedResourceId, visibleResources],
    );

    const requestSummary = useMemo(() => {
        return {
            resource: selectedResource ? resourceLabel(selectedResource) : "Sin recurso seleccionado",
            timeframe: formatDuration(startTime, endTime),
            date: bookingDate,
            requester: fullName.trim() || "Sin nombre",
            document: documentNumber.trim() || "Sin documento",
            contact: email.trim() || phone.trim() ? [email.trim(), phone.trim()].filter(Boolean).join(" · ") : "Sin contacto",
            purpose: purpose.trim() || "Sin propósito definido",
        };
    }, [bookingDate, documentNumber, endTime, email, fullName, phone, purpose, selectedResource, startTime]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!termsAccepted) {
            setStatusMessage("Debes aceptar la responsabilidad para continuar.");
            return;
        }

        setStatusMessage("Solicitud preparada. Si quieres, luego la conecto al backend de reservas.");
    };

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 xl:flex-row xl:gap-8 xl:px-8">
            <main className="min-w-0 flex-1 space-y-6 sm:space-y-8">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
                    <div className="bg-[#f7f9fb] px-6 py-6 sm:px-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-2xl">
                                <p className="text-[9px] font-bold tracking-[0.28em] text-slate-500 uppercase">Apartado de Reservas</p>
                                <h1 className="mt-1 text-3xl font-black tracking-tight text-[#2a3439] sm:text-4xl">Resource Booking</h1>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                                    Solicita salones o equipos con una vista clara, compacta y consistente con el sistema existente.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                    <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase">Tipo activo</p>
                                    <p className="mt-1 text-sm font-black text-slate-900">{resourceTypeLabel(resourceType)}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                    <p className="text-[9px] font-bold tracking-[0.22em] text-slate-500 uppercase">Fecha</p>
                                    <p className="mt-1 text-sm font-black text-slate-900">{bookingDate}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8 px-6 py-6 sm:px-8">
                        <div className="flex w-full rounded-xl border border-slate-200 bg-[#f0f4f7] p-1 shadow-sm sm:inline-flex sm:w-auto">
                            {(["rooms", "equipment"] as ResourceType[]).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setResourceType(type)}
                                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all sm:flex-none sm:px-6 ${resourceType === type
                                            ? "bg-white text-[#3a5f94] shadow-sm"
                                            : "text-slate-600 hover:bg-white/70"
                                        }`}
                                >
                                    {resourceTypeLabel(type)}
                                </button>
                            ))}
                        </div>

                        <section>
                            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">{resourceTypeLabel(resourceType)} disponibles</p>
                                    <h2 className="mt-1 text-lg font-black text-slate-900">
                                        Selecciona un {resourceType === "rooms" ? "salón" : "equipo"} para reservar
                                    </h2>
                                </div>
                                <span className="inline-flex w-fit rounded-full bg-[#d5e3ff] px-3 py-1 text-[11px] font-semibold text-[#295786]">
                                    {visibleResources.length} opciones
                                </span>
                            </div>

                            {/* Compact boxed selector for rooms; keep equipment as full cards */}
                            {resourceType === "rooms" ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3">
                                    <div className="grid max-h-64 gap-2 overflow-auto">
                                        {visibleResources.map((resource) => {
                                            const isSelected = selectedResourceId === resource.id;
                                            return (
                                                <button
                                                    key={resource.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedResourceId(resource.id);
                                                        setSelectedCardId(resource.id);
                                                    }}
                                                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${isSelected
                                                            ? "ring-2 ring-[#3a5f94]/20 bg-[#f7f9fb]"
                                                            : "hover:bg-slate-50"
                                                        }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[10px] font-bold uppercase text-[#3a5f94]">{resource.floor}</div>
                                                        <div className="truncate text-sm font-bold text-slate-900">{resource.label}</div>
                                                    </div>
                                                    <div className="ml-3 flex items-center gap-2">
                                                        <div className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Cap {resource.capacity}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="mb-3">
                                        <label className="mb-2 block text-xs font-bold text-slate-500 uppercase">Grupo de equipo</label>
                                        {inventoryGroups.length > 0 ? (
                                            <div className="relative">
                                                <select
                                                    value={selectedGroupId}
                                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white p-3 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                                >
                                                    {inventoryGroups.map((g) => (
                                                        <option key={g.id} value={g.id}>
                                                            {g.name} {g.itemCount ? `(${g.itemCount})` : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-600">
                                                    <span className="material-symbols-outlined">expand_more</span>
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">Cargando grupos de Inventory...</div>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <label className="mb-2 block text-xs font-bold text-slate-500 uppercase">Elemento del grupo</label>
                                        {inventoryItems.length > 0 ? (
                                            <div className="relative">
                                                <select
                                                    value={selectedResourceId}
                                                    onChange={(e) => {
                                                        const id = e.target.value;
                                                        setSelectedResourceId(id);
                                                        setSelectedCardId(id || null);
                                                    }}
                                                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white p-3 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                                >
                                                    <option value="">Selecciona un elemento...</option>
                                                    {inventoryItems.map((it) => (
                                                        <option key={it.id} value={it.id}>
                                                            {it.name} — {it.code} {it.room ? `· ${it.room}` : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-600">
                                                    <span className="material-symbols-outlined">expand_more</span>
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">No hay elementos en este grupo</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>

                        <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
                            <section className="grid gap-8 lg:grid-cols-2">
                                <div className="space-y-5 rounded-2xl border border-slate-200 bg-[#f7f9fb] p-6">
                                    <div>
                                        <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">HORARIO</p>
                                        <h3 className="mt-1 text-lg font-black text-slate-900">Define el horario</h3>
                                    </div>

                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Date</span>
                                        <input
                                            type="date"
                                            value={bookingDate}
                                            onChange={(event) => setBookingDate(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                        />
                                    </label>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Start time</span>
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={(event) => setStartTime(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">End time</span>
                                            <input
                                                type="time"
                                                value={endTime}
                                                onChange={(event) => setEndTime(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-5 rounded-2xl border border-slate-200 bg-[#f7f9fb] p-6">
                                    <div>
                                        <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Propósito</p>
                                        <h3 className="mt-1 text-lg font-black text-slate-900">¿Cuál es el propósito de la reserva?</h3>
                                    </div>

                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Propósito de uso</span>
                                        <textarea
                                            rows={6}
                                            value={purpose}
                                            onChange={(event) => setPurpose(event.target.value)}
                                            placeholder="e.g., final presentation, workshop, team meeting"
                                            className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3a5f94]"
                                        />
                                    </label>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-5">
                                    <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Información del solicitante</p>
                                    <h3 className="mt-1 text-lg font-black text-slate-900">¿Quién está realizando la solicitud?</h3>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Nombre Completo</span>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(event) => setFullName(event.target.value)}
                                            placeholder="Johnathan Doe"
                                            className="w-full rounded-xl border border-slate-200 bg-[#f7f9fb] p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">ID / documento</span>
                                        <input
                                            type="text"
                                            value={documentNumber}
                                            onChange={(event) => setDocumentNumber(event.target.value)}
                                            placeholder="U-2938475"
                                            className="w-full rounded-xl border border-slate-200 bg-[#f7f9fb] p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Correo Electrónico</span>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            placeholder="j.doe@institution.edu"
                                            className="w-full rounded-xl border border-slate-200 bg-[#f7f9fb] p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Número de teléfono</span>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(event) => setPhone(event.target.value)}
                                            placeholder="+57 300 000 0000"
                                            className="w-full rounded-xl border border-slate-200 bg-[#f7f9fb] p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                        />
                                    </label>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-[#f0f4f7] p-6">
                                <div className="flex items-start gap-4">
                                    <input
                                        id="terms"
                                        type="checkbox"
                                        checked={termsAccepted}
                                        onChange={(event) => setTermsAccepted(event.target.checked)}
                                        className="mt-1 h-5 w-5 rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]"
                                    />
                                    <div>
                                        <label htmlFor="terms" className="cursor-pointer text-sm font-bold text-slate-900">
                                            Términos & Acuerdo de Responsabilidad
                                        </label>
                                        <p className="mt-2 text-sm leading-6 text-slate-600">
                                            Me comprometo a responsabilizarme del uso adecuado y la devolución de los recursos solicitados. Cualquier daño o pérdida podrá dar lugar a medidas administrativas.                    </p>
                                    </div>
                                </div>
                            </section>

                            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                                <button
                                    type="submit"
                                    className="w-full rounded-xl bg-[#3a5f94] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#3a5f94]/15 transition hover:bg-[#2d5387] active:scale-[0.98] sm:w-auto"
                                >
                                    Submit Request
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setResourceType("rooms");
                                        setSelectedResourceId(roomsCatalog[0]?.id ?? "");
                                        setSelectedCardId(roomsCatalog[0]?.id ?? null);
                                        setBookingDate(todayKey);
                                        setStartTime("08:00");
                                        setEndTime("10:00");
                                        setPurpose("");
                                        setFullName("");
                                        setDocumentNumber("");
                                        setEmail("");
                                        setPhone("");
                                        setTermsAccepted(false);
                                        setStatusMessage(null);
                                    }}
                                    className="w-full rounded-xl px-6 py-3.5 text-sm font-bold text-slate-600 transition hover:text-[#9f403d] sm:w-auto"
                                >
                                    Cancel
                                </button>
                                {statusMessage ? <p className="text-sm font-medium text-slate-600">{statusMessage}</p> : null}
                            </div>
                        </form>
                    </div>
                </section>
            </main>

            <aside className="w-full xl:w-80">
                <div className="space-y-6 xl:sticky xl:top-28">
                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-6">
                            <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Request summary</p>
                            <h2 className="mt-1 text-lg font-black text-slate-900">Current draft</h2>
                        </div>

                        <div className="space-y-5">
                            <div className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3]">
                                    <span className="material-symbols-outlined text-[#3a5f94]">meeting_room</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-500">Resource</p>
                                    <p className="text-sm font-bold text-slate-900">{requestSummary.resource}</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3]">
                                    <span className="material-symbols-outlined text-[#3a5f94]">schedule</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-500">Timeframe</p>
                                    <p className="text-sm font-bold text-slate-900">{requestSummary.timeframe}</p>
                                    <p className="text-xs text-slate-500">{requestSummary.date}</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3]">
                                    <span className="material-symbols-outlined text-[#3a5f94]">person</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-500">Requester</p>
                                    <p className="text-sm font-bold text-slate-900">{requestSummary.requester}</p>
                                    <p className="text-xs text-slate-500">{requestSummary.document}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 rounded-2xl bg-[#d5e3ff]/40 p-4">
                            <p className="text-[10px] font-bold uppercase text-[#153f73]">Status</p>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#3a5f94]" />
                                <span className="text-sm font-bold text-[#3a5f94]">Drafting Request</span>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-[#e8eff3] p-6">
                        <h3 className="text-xs font-bold uppercase text-[#3a5f94]">Policy Note</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                            Bookings should be reviewed by the coordinator before confirmation. Keep the final approval flow inside the same visual language used across the platform.
                        </p>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Preview</h3>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-[#f7f9fb] p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-500">Selected card</p>
                                    <p className="text-sm font-black text-slate-900">{selectedResource ? selectedResource.label : "No selection"}</p>
                                </div>
                                <div className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                                    {selectedCardId ? "Ready" : "Select one"}
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                                <span className="material-symbols-outlined text-[#3a5f94]">event_available</span>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-500">Booking window</p>
                                    <p className="text-sm font-bold text-slate-900">{formatDuration(startTime, endTime)}</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </aside>
        </div>
    );
}
