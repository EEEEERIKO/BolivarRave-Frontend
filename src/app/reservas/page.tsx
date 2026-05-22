"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { readAuthSession } from "@/lib/auth-session";
import { fetchApiJson } from "@/lib/api-client";
import toast from "react-hot-toast";
import { confirmToast, promptToast } from "@/lib/toast-dialog";

type ResourceType = "rooms" | "equipment" | "televisor";

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
type ReservationFeedItem = {
    id: string;
    resourceType: ResourceType;
    resourceId: string;
    resourceLabel: string;
    resourceContext: string | null;
    resourceOriginalRoomLabel: string | null;
    bookingDate: string;
    startTime: string;
    endTime: string;
    requesterName: string;
    requesterDocument: string;
    requesterEmail: string | null;
    requesterPhone: string | null;
    status: string;
    destinationRoomLabel: string | null;
    returnedAt: string | null;
    reportReason?: string | null;
    createdAt: string;
};

type RequesterProfile = {
    requesterDocument: string;
    requesterName: string;
    requesterEmail: string | null;
    requesterPhone: string | null;
};

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

function getBogotaCurrentTimeKey() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    return formatter.format(new Date());
}

function getDefaultBookingTimeRange() {
    const startTime = getBogotaCurrentTimeKey();
    const [hoursText = "00", minutesText = "00"] = startTime.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    const safeHours = Number.isFinite(hours) ? hours : 0;
    const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
    const endTotalMinutes = safeHours * 60 + safeMinutes + 120;
    const endHours = Math.floor((endTotalMinutes / 60) % 24);
    const endMinutes = endTotalMinutes % 60;

    return {
        startTime,
        endTime: `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`,
    };
}

function timeToMinutes(timeStr: string): number {
    const [hours = "0", minutes = "0"] = timeStr.split(":");
    return Number(hours) * 60 + Number(minutes);
}

function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    const aStartMin = timeToMinutes(aStart);
    const aEndMin = timeToMinutes(aEnd);
    const bStartMin = timeToMinutes(bStart);
    const bEndMin = timeToMinutes(bEnd);
    return aStartMin < bEndMin && bStartMin < aEndMin;
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
    if (type === "rooms") return "Clases de Sábado";
    if (type === "televisor") return "Televisor";
    return "Equipos";
}

function normalizeDocumentNumber(value: string) {
    return value.trim().replace(/[\s.-]/g, "").toLowerCase();
}

function summarizeDefectReasons(reservations: ReservationFeedItem[], documentNumber: string, inventoryItems: InventoryItem[]) {
    const normalizedDocument = normalizeDocumentNumber(documentNumber);
    const matches = reservations.filter((reservation) => {
        try {
            return normalizeDocumentNumber(reservation.requesterDocument) === normalizedDocument && reservation.status.toLowerCase() === "reportado";
        } catch {
            return false;
        }
    });

    const reasonsFromReservations = matches
        .map((reservation) => reservation.reportReason?.trim())
        .filter((reason): reason is string => Boolean(reason));

    // Also try to extract motivo from inventory items referenced by those reservations
    const reasonsFromInventory = matches
        .map((reservation) => {
            try {
                const item = inventoryItems.find((i) => String(i.id) === String(reservation.resourceId));
                return item?.motivo?.trim() ?? null;
            } catch {
                return null;
            }
        })
        .filter((r): r is string => Boolean(r));

    const combined = Array.from(new Set([...reasonsFromReservations, ...reasonsFromInventory]));

    return {
        count: matches.length,
        reasons: combined,
    };
}

function getReservationDateTimeValue(reservation: ReservationFeedItem) {
    const combined = `${reservation.bookingDate}T${reservation.startTime}:00`;
    const parsed = Date.parse(combined);
    return Number.isFinite(parsed) ? parsed : Date.parse(reservation.createdAt);
}

function hasFreshPendingReservation(reservations: ReservationFeedItem[], maxAgeSeconds = 90) {
    const now = Date.now();

    return reservations.some((reservation) => {
        const statusLower = reservation.status.toLowerCase();
        if (statusLower !== "no_aceptado") {
            return false;
        }

        const createdAtMs = Date.parse(reservation.createdAt);
        if (!Number.isFinite(createdAtMs)) {
            return true;
        }

        return now - createdAtMs <= maxAgeSeconds * 1000;
    });
}

function normalizeSearchText(value: string) {
    return value.trim().toLowerCase();
}

export default function ReservasPage() {
    const todayKey = useMemo(() => getBogotaTodayKey(), []);
    const defaultBookingTimeRange = useMemo(() => getDefaultBookingTimeRange(), []);
    const [resourceType, setResourceType] = useState<ResourceType>("televisor");
    const [selectedResourceId, setSelectedResourceId] = useState<string>("");
    const [bookingDate, setBookingDate] = useState(todayKey);
    const [startTime, setStartTime] = useState(defaultBookingTimeRange.startTime);
    const [endTime, setEndTime] = useState(defaultBookingTimeRange.endTime);
    const [purpose, setPurpose] = useState("");
    const [fullName, setFullName] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(selectedResourceId);
    const [roomsCatalog, setRoomsCatalog] = useState<BookingResource[]>([]);
    const [selectedDestinationRoomId, setSelectedDestinationRoomId] = useState<string>("");
    const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>("");
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [allReservations, setAllReservations] = useState<ReservationFeedItem[]>([]);
    const [reservationsFeed, setReservationsFeed] = useState<ReservationFeedItem[]>([]);
    const [reservationsLoading, setReservationsLoading] = useState(false);
    const [returningReservationId, setReturningReservationId] = useState<string | null>(null);
    const [actionReservationId, setActionReservationId] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'close' | 'report' | 'cancel' | 'defective-return' | null>(null);
    const [modalReservationId, setModalReservationId] = useState<string | null>(null);
    const [reportReason, setReportReason] = useState('');
    const [showReservationHistory, setShowReservationHistory] = useState(false);
    const [historySearch, setHistorySearch] = useState("");
    const [historyTypeFilter, setHistoryTypeFilter] = useState<"all" | ResourceType>("all");
    const [historyReportFilter, setHistoryReportFilter] = useState<"all" | "reportado" | "no-reportado">("all");
    const [requesterLookupMessage, setRequesterLookupMessage] = useState<string | null>(null);
    const [prefilledRequesterDocument, setPrefilledRequesterDocument] = useState<string>("");
    const [requesterStage, setRequesterStage] = useState<'id-only' | 'full'>('id-only');

    const availableInventoryItems = useMemo(() => {
        const desiredDate = bookingDate;
        const desiredStart = startTime;
        const desiredEnd = endTime;

        return inventoryItems.filter((it) => {
            if (((it.status ?? "").toLowerCase() !== "disponible")) return false;

            // If there exists an active reservation for this item on the same date that overlaps the desired range, exclude it
            const conflicting = allReservations.some((res) => {
                try {
                    if (!res.resourceId) return false;
                    if (String(res.resourceId) !== String(it.id)) return false;
                    const statusLower = (res.status ?? "").toLowerCase();
                    if (["devuelto", "reportado", "rechazada", "cancelada"].includes(statusLower)) return false;
                    if (res.bookingDate !== desiredDate) return false;
                    return timeRangesOverlap(res.startTime, res.endTime, desiredStart, desiredEnd);
                } catch {
                    return false;
                }
            });

            return !conflicting;
        });
    }, [inventoryItems, allReservations, bookingDate, startTime, endTime]);

    const authSession = useMemo(() => readAuthSession(), []);
    const canViewReservations = authSession?.role === "admin" || authSession?.role === "monitor";

    const tvReservationItems = useMemo(() => availableInventoryItems.filter((item) => {
        const groupName = item.groupName.trim().toLowerCase();
        return groupName === "televisores";
    }), [availableInventoryItems]);

    const equipmentGroupOptions = useMemo(
        () => inventoryGroups.filter((group) => group.name.trim().toLowerCase() !== "televisores"),
        [inventoryGroups],
    );

    const visibleResources: BookingResource[] = resourceType === "rooms"
        ? roomsCatalog
        : resourceType === "equipment"
            ? availableInventoryItems.map((it) => ({
                id: it.id,
                type: "equipment" as const,
                label: it.name,
                floor: it.groupName ?? "",
                capacity: 1,
                accent: "#4d5d73",
                description: it.room ?? it.code ?? "",
                tags: [it.code || "", it.status || ""].filter(Boolean),
            }))
            : [];

    useEffect(() => {
        let cancelled = false;

        const loadRoomsInfo = async () => {
            try {
                // Prefer detailed rooms info; fall back to simple rooms list if needed
                const info = await fetchApiJson<any>("/api/schedules/rooms-info", { cache: "no-store" }).catch(() => null);
                if (cancelled) return;

                if (info && Array.isArray(info.roomsByFloor)) {
                    const flattened = info.roomsByFloor.flat().filter(Boolean).map((r: any) => ({
                        id: r.id ?? r.nombre ?? "",
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
                        if (!x.id) return false;
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
        if (resourceType === "rooms") return;

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
        if (resourceType !== "televisor") return;

        const tvGroup = inventoryGroups.find((group) => group.name.trim().toLowerCase() === "televisores");
        if (tvGroup && selectedGroupId !== tvGroup.id) {
            setSelectedGroupId(tvGroup.id);
        }
    }, [inventoryGroups, resourceType, selectedGroupId]);

    useEffect(() => {
        if (resourceType === "rooms") return;
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
        setSelectedResourceId((current) => (visibleResources.some((resource) => resource.id === current) ? current : ""));
        setSelectedCardId((current) => (visibleResources.some((resource) => resource.id === current) ? current : null));
        if (!selectedDestinationRoomId && roomsCatalog.length > 0) {
            setSelectedDestinationRoomId(roomsCatalog[0].id);
        }
    }, [resourceType, roomsCatalog, selectedDestinationRoomId, visibleResources]);

    const selectedResource = useMemo(
        () => visibleResources.find((resource) => resource.id === selectedResourceId) ?? null,
        [selectedResourceId, visibleResources],
    );

    const selectedRoomResource = useMemo(
        () => roomsCatalog.find((room) => room.id === selectedResourceId) ?? null,
        [roomsCatalog, selectedResourceId],
    );

    const selectedEquipmentResource = useMemo(
        () => inventoryItems.find((item) => item.id === selectedResourceId) ?? null,
        [inventoryItems, selectedResourceId],
    );

    const selectedDestinationRoom = useMemo(
        () => roomsCatalog.find((room) => room.id === selectedDestinationRoomId) ?? null,
        [roomsCatalog, selectedDestinationRoomId],
    );

    const requesterProfilesByDocument = useMemo(() => {
        const profiles = new Map<string, RequesterProfile>();

        for (const reservation of allReservations) {
            const normalizedDocument = normalizeDocumentNumber(reservation.requesterDocument);
            if (!normalizedDocument || profiles.has(normalizedDocument)) {
                continue;
            }

            profiles.set(normalizedDocument, {
                requesterDocument: reservation.requesterDocument,
                requesterName: reservation.requesterName,
                requesterEmail: reservation.requesterEmail,
                requesterPhone: reservation.requesterPhone,
            });
        }

        return profiles;
    }, [allReservations]);

    const requestSummary = useMemo(() => {
        return {
            resource: resourceType === "televisor"
                ? "Televisor (asignación automática)"
                : selectedResource ? resourceLabel(selectedResource) : "Sin recurso seleccionado",
            timeframe: formatDuration(startTime, endTime),
            date: bookingDate,
            requester: resourceType === "televisor" ? (authSession?.name ?? "Solicitud automática") : (fullName.trim() || "Sin nombre"),
            document: resourceType === "televisor" ? (authSession?.cedula ?? "Asignado automáticamente") : (documentNumber.trim() || "Sin documento"),
            contact: email.trim() || phone.trim() ? [email.trim(), phone.trim()].filter(Boolean).join(" · ") : "Sin contacto",
            purpose: resourceType === "televisor" ? "Solicitud automática de televisor" : (purpose.trim() || "Sin propósito definido"),
            destination: resourceType !== "rooms" ? selectedDestinationRoom?.label ?? "Sin salón de destino" : null,
        };
    }, [authSession, bookingDate, documentNumber, endTime, email, fullName, phone, purpose, resourceType, selectedDestinationRoom, selectedResource, startTime]);

    const activeReservations = useMemo(() => {
        return reservationsFeed.filter((reservation) => {
            const statusLower = reservation.status.toLowerCase();
            return !['devuelto', 'reportado', 'rechazada', 'cancelada'].includes(statusLower);
        });
    }, [reservationsFeed]);

    const hasActiveTelevisorReservations = useMemo(
        () => activeReservations.some((reservation) => reservation.resourceType === "televisor"),
        [activeReservations],
    );

    const shouldAutoRefreshReservations = useMemo(
        () => !hasActiveTelevisorReservations && hasFreshPendingReservation(activeReservations),
        [activeReservations, hasActiveTelevisorReservations]
    );

    const closedReservations = useMemo(() => {
        return allReservations.filter((reservation) => {
            const statusLower = reservation.status.toLowerCase();
            return ['devuelto', 'reportado', 'rechazada', 'cancelada'].includes(statusLower);
        });
    }, [allReservations]);

    const filteredHistoryReservations = useMemo(() => {
        const query = normalizeSearchText(historySearch);

        return [...closedReservations]
            .sort((left, right) => getReservationDateTimeValue(right) - getReservationDateTimeValue(left))
            .filter((reservation) => {
                if (historyTypeFilter !== "all" && reservation.resourceType !== historyTypeFilter) {
                    return false;
                }

                const statusLower = reservation.status.toLowerCase();
                const isReported = statusLower === "reportado";

                if (historyReportFilter === "reportado" && !isReported) {
                    return false;
                }

                if (historyReportFilter === "no-reportado" && isReported) {
                    return false;
                }

                if (!query) {
                    return true;
                }

                const searchBlob = normalizeSearchText(
                    [
                        reservation.requesterName,
                        reservation.requesterEmail ?? "",
                        reservation.requesterDocument,
                        reservation.resourceLabel,
                        reservation.resourceContext ?? "",
                        reservation.resourceOriginalRoomLabel ?? "",
                        reservation.destinationRoomLabel ?? "",
                        reservation.status,
                    ].join(" ")
                );

                return searchBlob.includes(query);
            });
    }, [closedReservations, historyReportFilter, historySearch, historyTypeFilter]);

        const historyModal = showReservationHistory && typeof document !== "undefined"
            ? createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setShowReservationHistory(false)}
                >
                    <section
                        className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Historial</p>
                                <h3 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">Reservas cerradas y filtradas</h3>
                                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                                    Busca por nombre, correo, cédula, tipo de recurso o estado de reporte.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowReservationHistory(false)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                                Cerrar
                            </button>
                        </div>

                        <div className="grid gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:grid-cols-3">
                            <label className="block">
                                <span className="mb-2 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Buscar</span>
                                <input
                                    value={historySearch}
                                    onChange={(event) => setHistorySearch(event.target.value)}
                                    placeholder="Nombre, correo, cédula, recurso..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3a5f94]"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Tipo</span>
                                <select
                                    value={historyTypeFilter}
                                    onChange={(event) => setHistoryTypeFilter(event.target.value as "all" | ResourceType)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3a5f94]"
                                >
                                    <option value="all">Todos</option>
                                    <option value="rooms">Salones</option>
                                    <option value="equipment">Equipos</option>
                                </select>
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-[11px] font-bold tracking-wide text-slate-500 uppercase">Reporte</span>
                                <select
                                    value={historyReportFilter}
                                    onChange={(event) => setHistoryReportFilter(event.target.value as "all" | "reportado" | "no-reportado")}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#3a5f94]"
                                >
                                    <option value="all">Todos</option>
                                    <option value="reportado">Reportadas</option>
                                    <option value="no-reportado">No reportadas</option>
                                </select>
                            </label>
                        </div>

                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:px-6">
                            <p>
                                Mostrando <span className="font-bold text-slate-900">{filteredHistoryReservations.length}</span> de <span className="font-bold text-slate-900">{closedReservations.length}</span> registros.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setHistorySearch("");
                                    setHistoryTypeFilter("all");
                                    setHistoryReportFilter("all");
                                }}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                            >
                                Limpiar filtros
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 sm:px-6">
                            {filteredHistoryReservations.length > 0 ? (
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {filteredHistoryReservations.map((reservation) => {
                                        const statusLower = reservation.status.toLowerCase();
                                        const statusDisplay =
                                            statusLower === "rechazada"
                                                ? "Rechazada"
                                                : statusLower === "cancelada"
                                                    ? "Cancelada"
                                                    : statusLower === "devuelto"
                                                        ? "Devuelto"
                                                        : statusLower === "reportado"
                                                            ? "Reportado"
                                                            : reservation.status;

                                        const statusStyles =
                                            statusLower === "rechazada"
                                                ? "bg-rose-50 text-rose-700 border-rose-100"
                                                : statusLower === "cancelada"
                                                    ? "bg-slate-100 text-slate-600 border-slate-200"
                                                    : statusLower === "devuelto"
                                                        ? "bg-cyan-50 text-cyan-700 border-cyan-100"
                                                        : statusLower === "reportado"
                                                            ? "bg-amber-50 text-amber-700 border-amber-100"
                                                            : "bg-slate-50 text-slate-600 border-slate-200";

                                        return (
                                            <article key={reservation.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                                            {reservation.resourceType === "rooms" ? "Salón" : reservation.resourceType === "televisor" ? "Televisor" : "Equipo"}
                                                        </p>
                                                        <p className="truncate text-sm font-black text-slate-900">{reservation.resourceLabel}</p>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusStyles}`}>
                                                        {statusDisplay}
                                                    </span>
                                                </div>

                                                <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[14px] text-[#3a5f94]">event</span>
                                                        <span>{reservation.bookingDate}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[14px] text-[#3a5f94]">schedule</span>
                                                        <span>{formatDuration(reservation.startTime, reservation.endTime)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[14px] text-[#3a5f94]">person</span>
                                                        <span className="truncate">{reservation.requesterName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[14px] text-[#3a5f94]">badge</span>
                                                        <span className="truncate">{reservation.requesterDocument}</span>
                                                    </div>
                                                    {reservation.requesterEmail ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[14px] text-[#3a5f94]">mail</span>
                                                            <span className="truncate">{reservation.requesterEmail}</span>
                                                        </div>
                                                    ) : null}
                                                    {reservation.destinationRoomLabel ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[14px] text-[#3a5f94]">place</span>
                                                            <span className="truncate">Destino: {reservation.destinationRoomLabel}</span>
                                                        </div>
                                                    ) : null}
                                                    {reservation.resourceOriginalRoomLabel ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[14px] text-[#3a5f94]">history</span>
                                                            <span className="truncate">Origen: {reservation.resourceOriginalRoomLabel}</span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                                    No hay reservas que coincidan con los filtros actuales.
                                </div>
                            )}
                        </div>
                    </section>
                </div>,
                document.body
            )
            : null;

    const loadReservationsFeed = useCallback(async () => {
        if (!canViewReservations) {
            return;
        }

        setReservationsLoading(true);

        try {
                const response = await fetchApiJson<{ reservas?: ReservationFeedItem[] }>("/api/reservas", { cache: "no-store" });
                const reservas = response.reservas ?? [];
                setAllReservations(reservas);
                setReservationsFeed(reservas.slice(0, 6));
        } catch {
                const err = (arguments[0] ?? null) as unknown as Error;
                const msg = err instanceof Error ? err.message : "No se pudo cargar las reservas.";
                setAllReservations([]);
                setReservationsFeed([]);
                toast.error(msg);
        } finally {
            setReservationsLoading(false);
        }
    }, [canViewReservations]);

    const handleRequesterDocumentLookup = () => {
        const normalizedDocument = normalizeDocumentNumber(documentNumber);

        if (!normalizedDocument) {
            setRequesterLookupMessage(null);
            setPrefilledRequesterDocument("");
            setRequesterStage('id-only');
            return;
        }

        const previousDocument = prefilledRequesterDocument;
        const profile = requesterProfilesByDocument.get(normalizedDocument);

        if (!profile) {
            if (previousDocument && previousDocument !== normalizedDocument) {
                setFullName("");
                setEmail("");
                setPhone("");
            }

            setPrefilledRequesterDocument("");
            setRequesterLookupMessage("No hay reservas previas para esta cédula. Completa los datos manualmente.");
            setRequesterStage('full');
            return;
        }

        setFullName(profile.requesterName);
        setEmail(profile.requesterEmail ?? "");
        setPhone(profile.requesterPhone ?? "");
        setPrefilledRequesterDocument(normalizedDocument);
        setRequesterLookupMessage(`Se completaron los datos desde una reserva previa de ${profile.requesterName}.`);
        setRequesterStage('full');
    };

    const handleReturnReservation = async (reservationId: string) => {
        setReturningReservationId(reservationId);
        setStatusMessage(null);

        try {
            const response = await fetchApiJson<{ message: string; reservationId: string }>(`/api/reservas/${reservationId}/return`, {
                method: "PATCH",
            });

            setStatusMessage(response.message);
            await loadReservationsFeed();
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : "No se pudo devolver el elemento.");
        } finally {
            setReturningReservationId(null);
        }
    };

    const handleTelevisorDisplaced = async (reservationId: string) => {
        setActionReservationId(reservationId);
        setStatusMessage(null);

        try {
            const response = await fetchApiJson<{ message: string; reservationId: string }>(`/api/reservas/${reservationId}/televisor-displaced`, {
                method: "PATCH",
            });

            setStatusMessage(response.message);
            await loadReservationsFeed();
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : "No se pudo marcar el televisor como desplazado.");
        } finally {
            setActionReservationId(null);
        }
    };

    const handleCloseReservation = async (reservationId: string) => {
        setModalType('close');
        setModalReservationId(reservationId);
        setReportReason('');
        setModalOpen(true);
    };

    const handleReportReservation = async (reservationId: string) => {
        setModalType('report');
        setModalReservationId(reservationId);
        setReportReason('');
        setModalOpen(true);
    };

    const handleCancelReservation = async (reservationId: string) => {
        setModalType('cancel');
        setModalReservationId(reservationId);
        setReportReason('');
        setModalOpen(true);
    };

    const handleDefectiveReturn = async (reservationId: string) => {
        setModalType('defective-return');
        setModalReservationId(reservationId);
        setReportReason('');
        setModalOpen(true);
    };

    const handleModalClose = () => {
        setModalOpen(false);
        setModalType(null);
        setModalReservationId(null);
        setReportReason('');
    };

    const handleModalConfirm = async () => {
        if (!modalReservationId) return;

        // Validate reason if needed
        if (modalType === 'report' || modalType === 'defective-return') {
            const trimmed = reportReason.trim();
            if (trimmed.length > 0 && trimmed.length < 5) {
                setStatusMessage('El motivo debe tener al menos 5 caracteres.');
                return;
            }
        }

        setActionReservationId(modalReservationId);
        setStatusMessage(null);
        handleModalClose();

        try {
            if (modalType === 'close') {
                // capture reservation snapshot before closing so we know which inventory item to update
                const snapshot = allReservations.find((r) => String(r.id) === String(modalReservationId));

                const response = await fetchApiJson<{ message: string; reservationId: string }>(`/api/reservas/${modalReservationId}/close`, {
                    method: 'PATCH',
                });
                setStatusMessage(response.message);

                // If it was equipment, ask where the item remains and update inventory accordingly
                try {
                    if (snapshot && snapshot.resourceType === 'equipment' && snapshot.resourceId) {
                        const location = await promptToast(
                            '¿Dónde quedará el equipo tras cerrar la reserva? Escribe el nombre del salón o "Monitoría".',
                            { title: 'Ubicación final del equipo', placeholder: 'Monitoría' }
                        );

                        if (location !== null) {
                            const item = inventoryItems.find((i) => String(i.id) === String(snapshot.resourceId));
                            if (item) {
                                const updatePayload: any = {
                                    groupId: item.groupId,
                                    name: item.name,
                                    code: item.code,
                                    room: location,
                                    status: item.status,
                                    defective: !!item.defective,
                                    motivo: item.motivo || null,
                                    price: (item as any).price ?? null,
                                };

                                await fetchApiJson(`/api/inventory/items/${item.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(updatePayload),
                                });

                                setInventoryItems((prev) => prev.map((p) => (String(p.id) === String(item.id) ? { ...p, room: location } : p)));
                            }
                        }
                    }
                } catch (err) {
                    console.error('No se pudo actualizar ubicación del inventario al cerrar reserva', err);
                }
            } else if (modalType === 'report') {
                const trimmed = reportReason.trim();
                const response = await fetchApiJson<{ message: string; reservationId: string }>(`/api/reservas/${modalReservationId}/report`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportReason: trimmed.length > 0 ? trimmed : null }),
                });
                setStatusMessage(response.message);
            } else if (modalType === 'cancel') {
                const response = await fetchApiJson<{ message: string; reservationId: string }>(`/api/reservas/${modalReservationId}/cancel`, {
                    method: 'PATCH',
                });
                setStatusMessage(response.message);
            } else if (modalType === 'defective-return') {
                const trimmed = reportReason.trim();
                const response = await fetchApiJson<{ message: string; reservationId: string }>(`/api/reservas/${modalReservationId}/report`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportReason: trimmed.length > 0 ? trimmed : null }),
                });
                setStatusMessage(response.message);
            }
            await loadReservationsFeed();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'No se pudo procesar la acción.';
            if (msg.toLowerCase().includes('parametros invalidos') || msg.toLowerCase().includes('too small')) {
                setStatusMessage('El motivo proporcionado es demasiado corto (mínimo 5 caracteres).');
            } else {
                setStatusMessage(msg);
            }
        } finally {
            setActionReservationId(null);
        }
    };

    useEffect(() => {
        void loadReservationsFeed();
    }, [loadReservationsFeed]);

    useEffect(() => {
        if (!canViewReservations) {
            return;
        }

        if (!shouldAutoRefreshReservations) {
            return;
        }

        const refreshIfVisible = () => {
            if (typeof document !== "undefined" && document.visibilityState === "visible") {
                void loadReservationsFeed();
            }
        };

        const intervalId = window.setInterval(refreshIfVisible, 5000);

        window.addEventListener("focus", refreshIfVisible);
        document.addEventListener("visibilitychange", refreshIfVisible);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("focus", refreshIfVisible);
            document.removeEventListener("visibilitychange", refreshIfVisible);
        };
    }, [canViewReservations, loadReservationsFeed, shouldAutoRefreshReservations]);

    useEffect(() => {
        if (!showReservationHistory) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [showReservationHistory]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (endTime <= startTime) {
            setStatusMessage("La hora de fin debe ser posterior a la hora de inicio.");
            return;
        }

        

        if (resourceType !== "televisor" && !selectedResourceId) {
            let message = "Debes seleccionar un recurso para continuar.";

            if (resourceType === "rooms") {
                message = "Debes seleccionar un salón (aula) para continuar.";
            } else if (resourceType === "equipment") {
                if (inventoryItems.length === 0) {
                    message = "No hay equipos cargados para el grupo seleccionado. Cambia de grupo o carga elementos en el inventario.";
                } else if (availableInventoryItems.length === 0) {
                    message = "No hay equipos disponibles en el intervalo horario seleccionado. Ajusta la hora o elige otro equipo.";
                } else {
                    message = "Selecciona un equipo disponible de la lista para continuar.";
                }
            } else if (resourceType === "televisor") {
                if (tvReservationItems.length === 0) {
                    message = "No hay televisores disponibles en el intervalo horario seleccionado. Ajusta la hora o intenta con otro horario.";
                } else {
                    message = "El sistema asignará automáticamente un televisor disponible según el horario.";
                }
            }

            setStatusMessage(message);
            return;
        }

        if (resourceType !== "rooms" && !selectedDestinationRoomId) {
            setStatusMessage(resourceType === "televisor" ? "Debes seleccionar el salón donde usarás el televisor." : "Debes seleccionar el salón de destino para el equipo.");
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            const requesterNameValue = resourceType === "televisor" ? (authSession?.name ?? fullName.trim()) : fullName.trim();
            const requesterDocumentValue = resourceType === "televisor" ? (authSession?.cedula ?? documentNumber.trim()) : documentNumber.trim();
            const requesterEmailValue = resourceType === "televisor" ? null : (email.trim() || null);
            const requesterPhoneValue = resourceType === "televisor" ? null : (phone.trim() || null);
            const purposeValue = resourceType === "televisor"
                ? `Préstamo automático de televisor para ${selectedDestinationRoom?.label ?? "salón seleccionado"}`
                : purpose.trim();

            // If requester has prior defect reports, warn and require confirmation
            if (resourceType !== "televisor" && requesterDocumentValue) {
                const defectSummary = summarizeDefectReasons(allReservations, documentNumber, inventoryItems);
                const hadDefects = defectSummary.count > 0;

                if (hadDefects) {
                    const reasonText = defectSummary.reasons.length > 0
                        ? `\n\nMotivos registrados:\n${defectSummary.reasons.map((reason) => `- ${reason}`).join("\n")}`
                        : "\n\nMotivos registrados: no disponibles en el historial cargado.";

                    const proceed = await confirmToast(
                        `Este solicitante registra devoluciones reportadas como defectuosas anteriormente.${reasonText}\n\n¿Deseas continuar con la reserva?`,
                        { title: "Advertencia: devoluciones previas", confirmLabel: "Continuar", cancelLabel: "Cancelar" }
                    );
                    if (!proceed) {
                        setIsSubmitting(false);
                        return;
                    }
                }
            }

            const payload = {
                resourceType,
                resourceId: resourceType === "televisor" ? "AUTO" : selectedResourceId,
                bookingDate,
                startTime,
                endTime,
                purpose: purposeValue,
                requesterName: requesterNameValue,
                requesterDocument: requesterDocumentValue,
                requesterEmail: requesterEmailValue,
                requesterPhone: requesterPhoneValue,
                
                destinationRoomId: resourceType !== "rooms" ? (selectedDestinationRoom?.id || selectedDestinationRoom?.label || selectedDestinationRoomId) : null,
            };

            const response = await fetchApiJson<{ message: string; reservationId: string; assignmentLabel?: string | null; returnNote?: string | null }>("/api/reservas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const assignmentParts = [response.assignmentLabel ? `TV asignado: ${response.assignmentLabel}` : null, response.returnNote ?? null].filter(Boolean);
            setStatusMessage([`${response.message} ID: ${response.reservationId}`, ...assignmentParts].join(" · "));
            setRequesterLookupMessage(null);
            setPrefilledRequesterDocument("");
            setRequesterStage('id-only');
            void loadReservationsFeed();

            // If equipment was reserved, update item room to the destination room
            try {
                        if (resourceType === 'equipment' && selectedResourceId) {
                    const item = inventoryItems.find((i) => String(i.id) === String(selectedResourceId));
                    if (item) {
                        // Use the human-readable room name (label) when updating inventory.
                        const roomLabel = selectedDestinationRoom ? selectedDestinationRoom.label : item.room;
                        const updatePayload: any = {
                            groupId: item.groupId,
                            name: item.name,
                            code: item.code,
                            room: roomLabel,
                            status: item.status,
                            defective: !!item.defective,
                            motivo: item.motivo || null,
                            price: (item as any).price ?? null,
                        };

                        await fetchApiJson(`/api/inventory/items/${item.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updatePayload),
                        });

                        // Optimistic update of local inventory list
                        setInventoryItems((prev) => prev.map((p) => (String(p.id) === String(item.id) ? { ...p, room: updatePayload.room } : p)));
                        }
                }
            } catch (err) {
                // non-fatal: log and continue
                console.error('No se pudo actualizar ubicación del inventario tras crear reserva', err);
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : "No se pudo registrar la reserva.";
            setStatusMessage(msg);
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!canViewReservations) {
        return (
            <div className="mx-auto max-w-2xl p-6">
                <h1 className="text-2xl font-bold text-[#2a3439]">Acceso denegado</h1>
                <p className="mt-2 text-sm text-[#566166]">No tienes permiso para ver esta página. Solo usuarios con rol Monitor o Administrador pueden acceder.</p>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 xl:flex-row xl:gap-8 xl:px-8">
            <main className="min-w-0 flex-1 space-y-6 sm:space-y-8">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(42,52,57,0.06)]">
                    <div className="bg-[#f7f9fb] px-6 py-6 sm:px-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-2xl">
                                <p className="text-[9px] font-bold tracking-[0.28em] text-slate-500 uppercase">Apartado de Reservas</p>
                                <h1 className="mt-1 text-3xl font-black tracking-tight text-[#2a3439] sm:text-4xl">Registro de Reservas</h1>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                                    Esta página es para registrar las reservas de salones (durante el sábado) y equipos del edificio académico Bolivar Rave.
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
                            {(["televisor", "equipment", "rooms"] as ResourceType[]).map((type) => (
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
                                        Selecciona un {resourceType === "rooms" ? "salón" : resourceType === "equipment" ? "equipo" : "televisor"} para reservar
                                    </h2>
                                </div>
                                <span className="inline-flex w-fit rounded-full bg-[#d5e3ff] px-3 py-1 text-[11px] font-semibold text-[#295786]">
                                    {resourceType === "televisor" ? tvReservationItems.length : visibleResources.length} opciones
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
                                                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition ${
                                                        isSelected ? "ring-2 ring-[#3a5f94]/20 bg-[#f7f9fb]" : "hover:bg-slate-50"
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
                            ) : resourceType === "equipment" ? (
                                <div className="space-y-3">
                                    <div className="mb-3">
                                        <label className="mb-2 block text-xs font-bold text-slate-500 uppercase">Grupo de equipos</label>
                                        {inventoryGroups.length > 0 ? (
                                            <div className="relative">
                                                <select
                                                    value={selectedGroupId}
                                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white p-3 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                                >
                                                    {equipmentGroupOptions.map((g) => (
                                                        <option key={g.id} value={g.id}>
                                                            {g.name}
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
                                        {availableInventoryItems.length > 0 ? (
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
                                                    {availableInventoryItems.map((it) => (
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
                                            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">No hay elementos disponibles en este grupo</div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div>
                                        <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Asignación automática</p>
                                        <h3 className="mt-1 text-lg font-black text-slate-900">El sistema elegirá el televisor por ti</h3>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Se prioriza un TV de un salón con dos televisores. Si no existe, se elige uno disponible sin choque de horario.
                                            Si el TV proviene de un salón con un solo televisor, el sistema mostrará un recordatorio de devolución.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border border-slate-200 bg-[#f7f9fb] p-4">
                                            <p className="text-[10px] font-bold uppercase text-slate-500">Televisores disponibles</p>
                                            <p className="mt-1 text-2xl font-black text-slate-900">{tvReservationItems.length}</p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 bg-[#f7f9fb] p-4">
                                            <p className="text-[10px] font-bold uppercase text-slate-500">Destino requerido</p>
                                            <p className="mt-1 text-sm font-bold text-slate-900">Selecciona el salón donde se usará el televisor</p>
                                        </div>
                                    </div>

                                    
                                </div>
                            )}
                        </section>

                        <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
                            <section className={`grid gap-8 ${resourceType === "televisor" ? "lg:grid-cols-1" : "lg:grid-cols-2"}`}>
                                <div className="space-y-5 rounded-2xl border border-slate-200 bg-[#f7f9fb] p-6">
                                    <div>
                                        <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">HORARIO</p>
                                        <h3 className="mt-1 text-lg font-black text-slate-900">Define el horario</h3>
                                    </div>

                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Fecha</span>
                                        <input
                                            type="date"
                                            min={todayKey}
                                            value={bookingDate}
                                            onChange={(event) => setBookingDate(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                        />
                                    </label>

                                    <div className="space-y-4">
                                        {/* Time Range Picker */}
                                        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {/* Start Time */}
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Inicio</label>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-1 py-1 flex-1 min-w-0">
                                                            <div className="flex items-center gap-0.5 justify-center">
                                                                <input
                                                                    type="number"
                                                                    min="6"
                                                                    max="22"
                                                                    value={startTime.split(":")[0]}
                                                                    onChange={(e) => {
                                                                        const h = Math.max(6, Math.min(22, parseInt(e.target.value) || 6));
                                                                        const m = startTime.split(":")[1] || "00";
                                                                        setStartTime(`${String(h).padStart(2, "0")}:${m}`);
                                                                    }}
                                                                    className="w-12 bg-transparent text-center text-xs font-bold text-slate-900 outline-none"
                                                                />
                                                                <span className="text-xs font-bold text-slate-400">:</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="59"
                                                                    value={startTime.split(":")[1] || "00"}
                                                                    onChange={(e) => {
                                                                        const h = startTime.split(":")[0] || "06";
                                                                        const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                                                        setStartTime(`${h}:${String(m).padStart(2, "0")}`);
                                                                    }}
                                                                    className="w-12 bg-transparent text-center text-xs font-bold text-slate-900 outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        
                                                        
                                                    </div>
                                                </div>

                                                {/* End Time */}
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-slate-500 uppercase">Fin</label>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-1 py-1 flex-1 min-w-0">
                                                            <div className="flex items-center gap-0.5 justify-center">
                                                                <input
                                                                    type="number"
                                                                    min="6"
                                                                    max="22"
                                                                    value={endTime.split(":")[0]}
                                                                    onChange={(e) => {
                                                                        const h = Math.max(6, Math.min(22, parseInt(e.target.value) || 6));
                                                                        const m = endTime.split(":")[1] || "00";
                                                                        setEndTime(`${String(h).padStart(2, "0")}:${m}`);
                                                                    }}
                                                                    className="w-12 bg-transparent text-center text-xs font-bold text-slate-900 outline-none"
                                                                />
                                                                <span className="text-xs font-bold text-slate-400">:</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="59"
                                                                    value={endTime.split(":")[1] || "00"}
                                                                    onChange={(e) => {
                                                                        const h = endTime.split(":")[0] || "06";
                                                                        const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                                                        setEndTime(`${h}:${String(m).padStart(2, "0")}`);
                                                                    }}
                                                                    className="w-12 bg-transparent text-center text-xs font-bold text-slate-900 outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        
                                                        
                                                    </div>
                                                    
                                                </div>
                                            </div>

                                            
                                        </div>
                                    </div>
                                </div>

                                {resourceType !== "televisor" ? (
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

                                        {resourceType !== "rooms" ? (
                                        <label className="block">
                                            <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Donde necesita el elemento</span>
                                            {roomsCatalog.length > 0 ? (
                                                <div className="relative">
                                                    <select
                                                        value={selectedDestinationRoomId}
                                                        onChange={(event) => setSelectedDestinationRoomId(event.target.value)}
                                                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white p-3 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                                    >
                                                        <option value="">Selecciona un salon...</option>
                                                        {roomsCatalog.map((room) => (
                                                            <option key={room.id} value={room.id}>
                                                                {room.floor ? `${room.floor} - ` : ""}{room.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-600">
                                                        <span className="material-symbols-outlined">expand_more</span>
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">Cargando salones...</div>
                                            )}
                                        </label>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="space-y-5 rounded-2xl border border-slate-200 bg-[#f7f9fb] p-6">
                                        <div>
                                            <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Televisor</p>
                                            <h3 className="mt-1 text-lg font-black text-slate-900">Dónde necesita el televisor</h3>
                                        </div>

                                        

                                        <label className="block">
                                            {roomsCatalog.length > 0 ? (
                                                <div className="relative">
                                                    <select
                                                        value={selectedDestinationRoomId}
                                                        onChange={(event) => setSelectedDestinationRoomId(event.target.value)}
                                                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white p-3 pr-10 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                                    >
                                                        <option value="">Selecciona un salon...</option>
                                                        {roomsCatalog.map((room) => (
                                                            <option key={room.id} value={room.id}>
                                                                {room.floor ? `${room.floor} - ` : ""}{room.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-600">
                                                        <span className="material-symbols-outlined">expand_more</span>
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">Cargando salones...</div>
                                            )}
                                        </label>
                                    </div>
                                )}
                            </section>

                            {resourceType !== "televisor" ? (
                                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="mb-5">
                                        <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Información del solicitante</p>
                                        <h3 className="mt-1 text-lg font-black text-slate-900">¿Quién está realizando la solicitud?</h3>
                                    </div>

                                    <div className="grid gap-4">
                                        {requesterStage === 'id-only' ? (
                                            <label className="block">
                                                <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">ID / documento</span>
                                                <input
                                                    type="text"
                                                    value={documentNumber}
                                                    onChange={(event) => setDocumentNumber(event.target.value)}
                                                    onBlur={handleRequesterDocumentLookup}
                                                    placeholder="12938475"
                                                    className="w-full rounded-xl border border-slate-200 bg-[#f7f9fb] p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                                />
                                                {requesterLookupMessage ? (
                                                    <p className="mt-2 text-[11px] font-medium text-slate-500">{requesterLookupMessage}</p>
                                                ) : null}
                                            </label>
                                        ) : (
                                            <>
                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <label className="block">
                                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Nombre Completo</span>
                                                        <input
                                                            type="text"
                                                            value={fullName}
                                                            onChange={(event) => setFullName(event.target.value)}
                                                            placeholder="Erik Valencia Cardona"
                                                            className="w-full rounded-xl border border-slate-200 bg-[#f7f9fb] p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                                        />
                                                    </label>
                                                    <label className="block">
                                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">ID / documento</span>
                                                        <input
                                                            type="text"
                                                            value={documentNumber}
                                                            onChange={(event) => setDocumentNumber(event.target.value)}
                                                            onBlur={handleRequesterDocumentLookup}
                                                            placeholder="12938475"
                                                            className="w-full rounded-xl border border-slate-200 bg-[#f7f9fb] p-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3a5f94]"
                                                        />
                                                        {requesterLookupMessage ? (
                                                            <p className="mt-2 text-[11px] font-medium text-slate-500">{requesterLookupMessage}</p>
                                                        ) : null}
                                                    </label>
                                                </div>

                                                <div className="grid gap-4 md:grid-cols-2">
                                                    <label className="block">
                                                        <span className="mb-2 block text-xs font-bold text-slate-500 uppercase">Correo Electrónico</span>
                                                        <input
                                                            type="email"
                                                            value={email}
                                                            onChange={(event) => setEmail(event.target.value)}
                                                            placeholder="erik@unac.edu.co"
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
                                            </>
                                        )}
                                    </div>
                                </section>
                            ) : null}

                            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || endTime <= startTime}
                                    className="w-full rounded-xl bg-[#3a5f94] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#3a5f94]/15 transition hover:bg-[#2d5387] active:scale-[0.98] sm:w-auto"
                                >
                                    {isSubmitting ? "Guardando..." : "Enviar Reserva"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setResourceType("rooms");
                                        setSelectedResourceId(roomsCatalog[0]?.id ?? "");
                                        setSelectedCardId(roomsCatalog[0]?.id ?? null);
                                        setBookingDate(todayKey);
                                        const resetTimeRange = getDefaultBookingTimeRange();
                                        setStartTime(resetTimeRange.startTime);
                                        setEndTime(resetTimeRange.endTime);
                                        setPurpose("");
                                        setSelectedDestinationRoomId(roomsCatalog[0]?.id ?? "");
                                        setFullName("");
                                        setDocumentNumber("");
                                        setEmail("");
                                        setPhone("");
                                        setRequesterLookupMessage(null);
                                        setPrefilledRequesterDocument("");
                                        setRequesterStage('id-only');
                                        setStatusMessage(null);
                                    }}
                                    className="w-full rounded-xl px-6 py-3.5 text-sm font-bold text-slate-600 transition hover:text-[#9f403d] sm:w-auto"
                                >
                                    Eliminar información y empezar de nuevo
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
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Reservas registradas</p>
                                <h3 className="mt-1 text-lg font-black text-slate-900">Solicitudes recientes</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[#e8eff3] px-3 py-1 text-[11px] font-semibold text-[#3a5f94]">
                                    {activeReservations.length}
                                </span>
                                {closedReservations.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowReservationHistory(!showReservationHistory)}
                                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
                                    >
                                        {showReservationHistory ? "Ocultar" : "Ver"} historial ({closedReservations.length})
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 space-y-3">
                            {reservationsLoading ? (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                    Cargando reservas...
                                </div>
                            ) : activeReservations.length > 0 ? (
                                activeReservations.map((reservation) => {
                                    const isTelevisor = reservation.resourceType === "televisor";
                                    const statusLower = reservation.status.toLowerCase();
                                    const statusDisplay =
                                        statusLower === "no_aceptado"
                                            ? "Aún no Aceptado"
                                            : statusLower === "confirmada"
                                                ? "Confirmada"
                                                : statusLower === "aprobada"
                                                    ? "Aprobada"
                                                    : statusLower === "rechazada"
                                                        ? "Rechazada"
                                                        : statusLower === "cancelada"
                                                            ? "Cancelada"
                                                            : statusLower === "devuelto"
                                                                ? "Devuelto"
                                                                : reservation.status;

                                    const statusStyles =
                                        statusLower === "confirmada"
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                            : statusLower === "aprobada"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                : statusLower === "no_aceptado"
                                                    ? "bg-amber-50 text-amber-700 border-amber-100"
                                                    : statusLower === "rechazada"
                                                        ? "bg-rose-50 text-rose-700 border-rose-100"
                                                        : statusLower === "cancelada"
                                                            ? "bg-slate-100 text-slate-600 border-slate-200"
                                                            : statusLower === "devuelto"
                                                                ? "bg-cyan-50 text-cyan-700 border-cyan-100"
                                                                : "bg-amber-50 text-amber-700 border-amber-100";

                                    return (
                                        (() => {
                                            const now = new Date();
                                            const endDateTime = (() => {
                                                try {
                                                    return new Date(`${reservation.bookingDate}T${reservation.endTime}:00`);
                                                } catch (e) {
                                                    return null;
                                                }
                                            })();

                                            const isLate = endDateTime
                                                ? endDateTime.getTime() < now.getTime() && (statusLower === 'confirmada' || statusLower === 'aprobada')
                                                : false;
                                            const overdueDateLabel = endDateTime
                                                ? new Intl.DateTimeFormat('es-CO', {
                                                    weekday: 'long',
                                                    day: 'numeric',
                                                    month: 'long',
                                                }).format(endDateTime)
                                                : reservation.bookingDate;
                                            const overdueDateLabelFormatted = overdueDateLabel.charAt(0).toUpperCase() + overdueDateLabel.slice(1);

                                            return (
                                                <article key={reservation.id} className={`rounded-xl border ${isLate ? 'border-rose-300 bg-[#fff6f6]' : 'border-slate-200 bg-[#f7f9fb]'} p-4`}>
                                                    {isLate ? (
                                                        <div className="mb-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                                                            RESERVA TARDÍA - esta reserva debería haberse cerrado a las {reservation.endTime} del {overdueDateLabelFormatted}
                                                        </div>
                                                    ) : null}

                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold uppercase text-slate-500">
                                                                {reservation.resourceType === "rooms" ? "Salón" : reservation.resourceType === "televisor" ? "Televisor" : "Equipo"}
                                                            </p>
                                                            <p className="truncate text-sm font-black text-slate-900">{reservation.resourceLabel}</p>
                                                        </div>
                                                        {!isTelevisor && (
                                                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyles}`}>
                                                                {statusDisplay}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 grid gap-2 text-xs text-slate-600">
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[16px] text-[#3a5f94]">event</span>
                                                            <span>{reservation.bookingDate}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[16px] text-[#3a5f94]">schedule</span>
                                                            <span>{formatDuration(reservation.startTime, reservation.endTime)}</span>
                                                        </div>
                                                        {!isTelevisor && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[16px] text-[#3a5f94]">person</span>
                                                                <span className="truncate">{reservation.requesterName}</span>
                                                            </div>
                                                        )}
                                                        {reservation.destinationRoomLabel ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[16px] text-[#3a5f94]">place</span>
                                                                <span className="truncate">{reservation.destinationRoomLabel}</span>
                                                            </div>
                                                        ) : null}
                                                        {reservation.resourceOriginalRoomLabel ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-[16px] text-[#3a5f94]">history</span>
                                                                <span className="truncate">Origen: {reservation.resourceOriginalRoomLabel}</span>
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="mt-3 space-y-2">
                                                        {isTelevisor ? (
                                                            <>
                                                                <p className="text-[11px] font-semibold text-slate-500">{
                                                                    statusLower === "no_aceptado"
                                                                        ? `Llevar antes de las ${reservation.startTime}`
                                                                        : statusLower === "confirmada"
                                                                            ? "Televisor ya desplazado"
                                                                            : "Televisor devuelto"
                                                                }</p>
                                                                {statusLower === 'no_aceptado' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleTelevisorDisplaced(reservation.id)}
                                                                        disabled={actionReservationId === reservation.id}
                                                                        className="inline-flex w-full items-center justify-center rounded-xl bg-[#3a5f94] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2d5387] disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        {actionReservationId === reservation.id ? 'Marcando...' : 'Televisor ya desplazado'}
                                                                    </button>
                                                                ) : statusLower === 'confirmada' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleReturnReservation(reservation.id)}
                                                                        disabled={returningReservationId === reservation.id}
                                                                        className="inline-flex w-full items-center justify-center rounded-xl bg-[#3a5f94] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2d5387] disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        {returningReservationId === reservation.id ? 'Devolviendo...' : 'Televisor ya devuelto'}
                                                                    </button>
                                                                ) : null}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {statusLower === 'no_aceptado' ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => void handleCancelReservation(reservation.id)}
                                                                        disabled={actionReservationId === reservation.id}
                                                                        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        {actionReservationId === reservation.id ? 'Cancelando...' : 'Cancelar reserva'}
                                                                    </button>
                                                                ) : null}
                                                                { (statusLower === 'confirmada' || statusLower === 'aprobada') ? (
                                                                                        reservation.resourceType !== "rooms" ? (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => void handleReturnReservation(reservation.id)}
                                                                                disabled={returningReservationId === reservation.id}
                                                                                className="inline-flex w-full items-center justify-center rounded-xl bg-[#3a5f94] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2d5387] disabled:cursor-not-allowed disabled:opacity-60"
                                                                            >
                                                                                {returningReservationId === reservation.id ? "Devolviendo..." : "Devolución exitosa"}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => void handleDefectiveReturn(reservation.id)}
                                                                                disabled={actionReservationId === reservation.id}
                                                                                className="inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                            >
                                                                                {actionReservationId === reservation.id ? 'Procesando...' : 'Devolución defectuosa'}
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => void handleCloseReservation(reservation.id)}
                                                                                disabled={actionReservationId === reservation.id}
                                                                                className="inline-flex w-full items-center justify-center rounded-xl bg-[#3a5f94] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2d5387] disabled:cursor-not-allowed disabled:opacity-60"
                                                                            >
                                                                                {actionReservationId === reservation.id ? 'Procesando...' : 'Cerrar reserva'}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => void handleReportReservation(reservation.id)}
                                                                                disabled={actionReservationId === reservation.id}
                                                                                className="inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                            >
                                                                                {actionReservationId === reservation.id ? 'Procesando...' : 'Reportar problema'}
                                                                            </button>
                                                                        </>
                                                                    )
                                                                ) : null}
                                                            </>
                                                        )}
                                                    </div>
                                                </article>
                                            );
                                        })()
                                    );
                                })
                            ) : (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                    Todavía no hay solicitudes registradas.
                                </div>
                            )}
                        </div>
                    </section>

                    {historyModal}

                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-6">
                            <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Reserva</p>
                            <h2 className="mt-1 text-lg font-black text-slate-900">Datos Actuales</h2>
                        </div>

                        <div className="space-y-5">
                            <div className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3]">
                                    <span className="material-symbols-outlined text-[#3a5f94]">meeting_room</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-500">Reserva</p>
                                    <p className="text-sm font-bold text-slate-900">{requestSummary.resource}</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3]">
                                    <span className="material-symbols-outlined text-[#3a5f94]">schedule</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-500">Tiempo de resrva</p>
                                    <p className="text-sm font-bold text-slate-900">{requestSummary.timeframe}</p>
                                    <p className="text-xs text-slate-500">{requestSummary.date}</p>
                                </div>
                            </div>

                            {resourceType !== "televisor" ? (
                                <div className="flex gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3]">
                                        <span className="material-symbols-outlined text-[#3a5f94]">person</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-slate-500">Responsable de Reserva</p>
                                        <p className="text-sm font-bold text-slate-900">{requestSummary.requester}</p>
                                        <p className="text-xs text-slate-500">{requestSummary.document}</p>
                                    </div>
                                </div>
                            ) : (
                                <>  </>
                            )}

                            {requestSummary.destination ? (
                                <div className="flex gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3]">
                                        <span className="material-symbols-outlined text-[#3a5f94]">place</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-slate-500">Destino</p>
                                        <p className="text-sm font-bold text-slate-900">{requestSummary.destination}</p>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                    
                    </section>

                    

                    {/* Modal for close/report confirmation */}
                    {modalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-lg">
                                <div className="border-b border-slate-200 px-6 py-4">
                                    <h2 className="text-lg font-bold text-slate-900">
                                        {modalType === 'close' ? 'Cerrar Reserva' : modalType === 'cancel' ? 'Cancelar Solicitud' : modalType === 'defective-return' ? 'Devolución Defectuosa' : 'Reportar Préstamo'}
                                    </h2>
                                </div>

                                <div className="px-6 py-4">
                                    {modalType === 'close' && (
                                        <p className="text-sm text-slate-600">
                                            ¿Estás seguro que deseas marcar esta reserva como cerrada?
                                        </p>
                                    )}

                                    {modalType === 'cancel' && (
                                        <p className="text-sm text-slate-600">
                                            ¿Estás seguro que deseas cancelar esta solicitud de reserva?
                                        </p>
                                    )}

                                    {modalType === 'defective-return' && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-slate-600">
                                                Proporciona un motivo para la devolución defectuosa (mínimo 5 caracteres):
                                            </p>
                                            <textarea
                                                value={reportReason}
                                                onChange={(e) => setReportReason(e.target.value)}
                                                placeholder="Describe el defecto o problema con el equipo..."
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-[#3a5f94] focus:outline-none focus:ring-1 focus:ring-[#3a5f94]"
                                                rows={4}
                                            />
                                            {reportReason.length > 0 && reportReason.length < 5 && (
                                                <p className="text-xs text-rose-600">Mínimo 5 caracteres (escribiste {reportReason.length})</p>
                                            )}
                                        </div>
                                    )}

                                    {modalType === 'report' && (
                                        <div className="space-y-3">
                                            <p className="text-sm text-slate-600">
                                                Proporciona un motivo para reportar este préstamo (mínimo 5 caracteres):
                                            </p>
                                            <textarea
                                                value={reportReason}
                                                onChange={(e) => setReportReason(e.target.value)}
                                                placeholder="Describe el problema con el préstamo..."
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder-slate-400 focus:border-[#3a5f94] focus:outline-none focus:ring-1 focus:ring-[#3a5f94]"
                                                rows={4}
                                            />
                                            {reportReason.length > 0 && reportReason.length < 5 && (
                                                <p className="text-xs text-rose-600">Mínimo 5 caracteres (escribiste {reportReason.length})</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
                                    <button
                                        type="button"
                                        onClick={handleModalClose}
                                        disabled={actionReservationId !== null}
                                        className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleModalConfirm}
                                        disabled={actionReservationId !== null || ((modalType === 'report' || modalType === 'defective-return') && reportReason.trim().length < 5 && reportReason.trim().length > 0)}
                                        className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition ${
                                            modalType === 'report' || modalType === 'defective-return'
                                                ? 'bg-rose-600 hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60'
                                                : 'bg-[#3a5f94] hover:bg-[#2d5387] disabled:cursor-not-allowed disabled:opacity-60'
                                        }`}
                                    >
                                        {actionReservationId ? 'Procesando...' : modalType === 'close' ? 'Cerrar Reserva' : modalType === 'cancel' ? 'Cancelar Solicitud' : modalType === 'defective-return' ? 'Confirmar Devolución Defectuosa' : 'Reportar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    

                    
                </div>
            </aside>
        </div>
    );
}
