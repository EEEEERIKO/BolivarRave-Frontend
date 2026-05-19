"use client";

import { useEffect, useMemo, useState } from "react";
import { readAuthSession } from "@/lib/auth-session";
import { fetchApiJson } from "@/lib/api-client";
import toast from "react-hot-toast";

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
type ReservationFeedItem = {
    id: string;
    resourceType: ResourceType;
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
    return type === "rooms" ? "Clases de Sábado" : "Equipos";
}

function normalizeDocumentNumber(value: string) {
    return value.trim().replace(/[\s.-]/g, "").toLowerCase();
}

export default function ReservasPage() {
    const todayKey = useMemo(() => getBogotaTodayKey(), []);
    const defaultBookingTimeRange = useMemo(() => getDefaultBookingTimeRange(), []);
    const [resourceType, setResourceType] = useState<ResourceType>("rooms");
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
    const [requesterLookupMessage, setRequesterLookupMessage] = useState<string | null>(null);
    const [prefilledRequesterDocument, setPrefilledRequesterDocument] = useState<string>("");
    const [requesterStage, setRequesterStage] = useState<'id-only' | 'full'>('id-only');

    const availableInventoryItems = inventoryItems.filter((it) => (it.status ?? "").toLowerCase() === "disponible");

    const authSession = useMemo(() => readAuthSession(), []);
    const canViewReservations = authSession?.role === "admin" || authSession?.role === "monitor";

    const visibleResources = resourceType === "rooms" ? roomsCatalog : availableInventoryItems.map((it) => ({
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
        if (!selectedDestinationRoomId && roomsCatalog.length > 0) {
            setSelectedDestinationRoomId(roomsCatalog[0].id);
        }
    }, [resourceType, roomsCatalog, selectedDestinationRoomId, visibleResources]);

    const selectedResource = useMemo(
        () => visibleResources.find((resource) => resource.id === selectedResourceId) ?? visibleResources[0] ?? null,
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
            resource: selectedResource ? resourceLabel(selectedResource) : "Sin recurso seleccionado",
            timeframe: formatDuration(startTime, endTime),
            date: bookingDate,
            requester: fullName.trim() || "Sin nombre",
            document: documentNumber.trim() || "Sin documento",
            contact: email.trim() || phone.trim() ? [email.trim(), phone.trim()].filter(Boolean).join(" · ") : "Sin contacto",
            purpose: purpose.trim() || "Sin propósito definido",
            destination: resourceType === "equipment" ? selectedDestinationRoom?.label ?? "Sin salón de destino" : null,
        };
    }, [bookingDate, documentNumber, endTime, email, fullName, phone, purpose, resourceType, selectedDestinationRoom, selectedResource, startTime]);

    const activeReservations = useMemo(() => {
        return reservationsFeed.filter((reservation) => {
            const statusLower = reservation.status.toLowerCase();
            return !['devuelto', 'reportado', 'rechazada', 'cancelada'].includes(statusLower);
        });
    }, [reservationsFeed]);

    const closedReservations = useMemo(() => {
        return reservationsFeed.filter((reservation) => {
            const statusLower = reservation.status.toLowerCase();
            return ['devuelto', 'reportado', 'rechazada', 'cancelada'].includes(statusLower);
        });
    }, [reservationsFeed]);

    const loadReservationsFeed = async () => {
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
    };

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
                const response = await fetchApiJson<{ message: string; reservationId: string }>(`/api/reservas/${modalReservationId}/close`, {
                    method: 'PATCH',
                });
                setStatusMessage(response.message);
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
                const response = await fetchApiJson<{ message: string; reservationId: string }>(`/api/reservas/${modalReservationId}/defective-return`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ defectReason: trimmed.length > 0 ? trimmed : null }),
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
    }, [canViewReservations]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (endTime <= startTime) {
            setStatusMessage("La hora de fin debe ser posterior a la hora de inicio.");
            return;
        }

        

        if (!selectedResourceId) {
            setStatusMessage("Debes seleccionar un recurso para continuar.");
            return;
        }

        if (resourceType === "equipment" && !selectedDestinationRoomId) {
            setStatusMessage("Debes seleccionar el salón de destino para el equipo.");
            return;
        }

        setIsSubmitting(true);
        setStatusMessage(null);

        try {
            const payload = {
                resourceType,
                resourceId: selectedResourceId,
                bookingDate,
                startTime,
                endTime,
                purpose: purpose.trim(),
                requesterName: fullName.trim(),
                requesterDocument: documentNumber.trim(),
                requesterEmail: email.trim() || null,
                requesterPhone: phone.trim() || null,
                
                destinationRoomId: resourceType === "equipment" ? selectedDestinationRoomId : null,
            };

            const response = await fetchApiJson<{ message: string; reservationId: string }>("/api/reservas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            setStatusMessage(`${response.message} ID: ${response.reservationId}`);
            setRequesterLookupMessage(null);
            setPrefilledRequesterDocument("");
            setRequesterStage('id-only');
            void loadReservationsFeed();
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
                            ) : (
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
                                                    {inventoryGroups.map((g) => (
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

                                    {resourceType === "equipment" ? (
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
                            </section>

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

                                            return (
                                                <article key={reservation.id} className={`rounded-xl border ${isLate ? 'border-rose-300 bg-[#fff6f6]' : 'border-slate-200 bg-[#f7f9fb]'} p-4`}>
                                                    {isLate ? (
                                                        <div className="mb-3 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                                                            Tardío — la reserva terminó el {reservation.bookingDate} a las {reservation.endTime}
                                                        </div>
                                                    ) : null}

                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold uppercase text-slate-500">
                                                                {reservation.resourceType === "rooms" ? "Salón" : "Equipo"}
                                                            </p>
                                                            <p className="truncate text-sm font-black text-slate-900">{reservation.resourceLabel}</p>
                                                        </div>
                                                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyles}`}>
                                                            {statusDisplay}
                                                        </span>
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
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[16px] text-[#3a5f94]">person</span>
                                                            <span className="truncate">{reservation.requesterName}</span>
                                                        </div>
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

                                                    {reservation.resourceType === "equipment" && (statusLower === 'confirmada' || statusLower === 'aprobada') ? (
                                                        <div className="mt-3 space-y-2">
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
                                                        </div>
                                                    ) : null}
                                                    {statusLower === 'no_aceptado' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleCancelReservation(reservation.id)}
                                                            disabled={actionReservationId === reservation.id}
                                                            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {actionReservationId === reservation.id ? 'Procesando...' : 'Cancelar solicitud'}
                                                        </button>
                                                    ) : null}
                                                    {statusLower === 'confirmada' ? (
                                                        <div className="mt-3 grid grid-cols-2 gap-2">
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
                                                                {actionReservationId === reservation.id ? 'Procesando...' : 'Reportar préstamo'}
                                                            </button>
                                                        </div>
                                                    ) : null}
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

                    {showReservationHistory && closedReservations.length > 0 && (
                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-4">
                                <p className="text-[9px] font-bold tracking-[0.24em] text-slate-500 uppercase">Historial</p>
                                <h3 className="mt-1 text-lg font-black text-slate-900">Reservas cerradas</h3>
                            </div>

                            <div className="space-y-3">
                                {closedReservations.map((reservation) => {
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
                                        <article key={reservation.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-bold uppercase text-slate-500">
                                                        {reservation.resourceType === "rooms" ? "Salón" : "Equipo"}
                                                    </p>
                                                    <p className="truncate text-sm font-black text-slate-900">{reservation.resourceLabel}</p>
                                                </div>
                                                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyles}`}>
                                                    {statusDisplay}
                                                </span>
                                            </div>

                                            <div className="mt-2 grid gap-1 text-xs text-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">event</span>
                                                    <span>{reservation.bookingDate}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
                                                    <span>{formatDuration(reservation.startTime, reservation.endTime)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                                                    <span className="truncate">{reservation.requesterName}</span>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    )}

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

                            {requestSummary.destination ? (
                                <div className="flex gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e8eff3]">
                                        <span className="material-symbols-outlined text-[#3a5f94]">place</span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase text-slate-500">Destino del equipo</p>
                                        <p className="text-sm font-bold text-slate-900">{requestSummary.destination}</p>
                                    </div>
                                </div>
                            ) : null}
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
