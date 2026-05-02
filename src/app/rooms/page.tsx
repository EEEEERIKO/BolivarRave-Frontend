"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchApiJson } from "@/lib/api-client";
import { readAuthSession } from "@/lib/auth-session";
import { getDisabledRoomKeys, isRoomDisabled, loadSharedScheduleState, setSharedRoomDisabledState } from "@/lib/disabled-rooms";

type RoomStatus = "Available" | "Occupied" | "Starting Soon";

type RoomData = {
  id: string;
  nombre: string;
  piso: number | null;
  capacidad: number | null;
  status: RoomStatus;
  cardDetail: string;
  session: string;
  section: string;
  professor: string;
  faculty: string;
  schedule: string;
  remaining: string;
};

type ApiSalon = {
  id: string;
  nombre: string;
  piso: number | null;
  capacidad: number | null;
  facultad?: string | null;
  horarios: Array<{
    diaSemana: string;
    horaInicio: string;
    horaFin: string;
    evento: {
      nombrePrincipal: string | null;
      responsable: string | null;
      codigoMateria: string | null;
      facultad: string | null;
      actividad: string | null;
    };
  }>;
};

type ApiResponse = {
  success: boolean;
  totalRooms: number;
  floors: number;
  roomsByFloor: ApiSalon[][];
};

type InventoryEquipmentItem = {
  id: string;
  groupId: string;
  groupName: string;
  groupIcon: string;
  name: string;
  code: string;
  room: string;
  status: "Disponible" | "Fijo";
  defective: boolean;
  motivo: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type RoomsCachePayload = {
  timestamp: number;
  rooms: RoomData[];
};

const ROOMS_CACHE_KEY = "rooms-page-cache-v5";
const ROOMS_CACHE_TTL_MS = 2 * 60 * 1000;
let roomsMemoryCache: RoomsCachePayload | null = null;

const FLOOR_ONE_ALLOWED = new Set([
  "aula foro union 101",
  "aula foro unac 102",
  "sala informatica 1 bolivar",
  "sala informatica 2 bolivar",
]);

const EXCLUDED_EXACT_ROOM_NAMES = new Set<string>();

const EXCLUDED_NORMALIZED_ROOM_NAMES = new Set([
  "salon 200",
  "salon academia de música 200",
  "salon 205 - sillas",
  "salon 206 - sillas",
  "salon 305",
  "laboratorio de simulación financiera 403",
  "501",
  "502",
  "503",
  "503 - p",
]);

function normalizeRoomName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function extractRoomNumber(roomName: string): number {
  // Extrae número de 3 dígitos del nombre (ej: "Salón 301" → 301)
  const match = roomName.match(/(\d{3})/);
  return match ? parseInt(match[1]) : 9999; // 9999 al final si no tiene número
}

function formatTimeLabel(value: string): string {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/T(\d{2}:\d{2})/);
  if (isoMatch?.[1]) return isoMatch[1];

  const plainMatch = trimmed.match(/^(\d{1,2}:\d{2})/);
  if (plainMatch?.[1]) return plainMatch[1];

  return trimmed;
}

function parseTimeToMinutes(value: string): number {
  const label = formatTimeLabel(value);
  const [hours, minutes] = label.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

function formatTimeAmPm(value: string): string {
  const label = formatTimeLabel(value);
  const [hours, minutes] = label.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return label;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${normalizedHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function getEffectiveFloor(room: { nombre: string; piso: number | null }): number | null {
  const roomNumber = extractRoomNumber(room.nombre);
  if (roomNumber !== 9999) {
    const floorFromNumber = Math.floor(roomNumber / 100);
    if (floorFromNumber > 0) {
      return floorFromNumber;
    }
  }

  return room.piso;
}

function buildRoomMergeKey(salon: ApiSalon): string {
  const piso = getEffectiveFloor(salon) ?? 0;
  const roomNumber = extractRoomNumber(salon.nombre);

  if (piso > 0 && roomNumber !== 9999) {
    return `num-${piso}-${roomNumber}`;
  }

  return `name-${normalizeRoomName(salon.nombre)}`;
}

function getTodayName(): string {
  const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  return daysOfWeek[new Date().getDay()];
}

function isRoomVisible(room: { nombre: string; piso: number | null }): boolean {
  const effectiveFloor = getEffectiveFloor(room);
  if (effectiveFloor === null) return false;
  if (EXCLUDED_EXACT_ROOM_NAMES.has(room.nombre.trim())) return false;

  const normalized = normalizeRoomName(room.nombre);
  if (EXCLUDED_NORMALIZED_ROOM_NAMES.has(normalized)) return false;

  if (effectiveFloor === 1) {
    return FLOOR_ONE_ALLOWED.has(normalized);
  }

  const roomNumber = extractRoomNumber(room.nombre);
  if (roomNumber === 9999) return false;
  return Math.floor(roomNumber / 100) === effectiveFloor;
}

function getStatusMeta(status: RoomStatus) {
  if (status === "Occupied") {
    return {
      label: "En Clase",
      icon: "play_circle",
      pillClass: "bg-rose-100 text-rose-700 border border-rose-200",
    };
  }
  if (status === "Starting Soon") {
    return {
      label: "Inicia Pronto",
      icon: "schedule",
      pillClass: "bg-amber-100 text-amber-800 border border-amber-200",
    };
  }
  return {
    label: "Disponible",
    icon: "check_circle",
    pillClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  };
}

function hasSessionName(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.trim().length > 0;
}

function getFacultyFromSalon(salon: ApiSalon): string {
  const facultyName = salon.horarios.find((horario) => horario.evento.facultad?.trim())?.evento.facultad;
  return facultyName?.trim() || "Sin facultad";
}

function getFacultyForDisplaySchedule(
  salon: ApiSalon,
  displaySchedule: ApiSalon["horarios"][number] | null,
): string {
  if (!displaySchedule) {
    return getFacultyFromSalon(salon);
  }

  const directFaculty = displaySchedule.evento.facultad?.trim();
  if (directFaculty) {
    return directFaculty;
  }

  const sameScheduleFaculty = salon.horarios.find((horario) => {
    const sameSlot =
      horario.diaSemana === displaySchedule.diaSemana &&
      horario.horaInicio === displaySchedule.horaInicio &&
      horario.horaFin === displaySchedule.horaFin;
    const sameEvent =
      (horario.evento.nombrePrincipal ?? "") === (displaySchedule.evento.nombrePrincipal ?? "") &&
      (horario.evento.responsable ?? "") === (displaySchedule.evento.responsable ?? "") &&
      (horario.evento.codigoMateria ?? "") === (displaySchedule.evento.codigoMateria ?? "");

    return sameSlot && sameEvent && Boolean(horario.evento.facultad?.trim());
  })?.evento.facultad;

  return sameScheduleFaculty?.trim() || "Sin facultad";
}

function readRoomsCache(): RoomsCachePayload | null {
  if (roomsMemoryCache) {
    return roomsMemoryCache;
  }

  try {
    const raw = sessionStorage.getItem(ROOMS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoomsCachePayload;
    if (!parsed || !Array.isArray(parsed.rooms) || typeof parsed.timestamp !== "number") {
      return null;
    }
    const hasMissingFaculty = parsed.rooms.some((room) => !room.faculty || room.faculty === "Sin facultad");
    if (hasMissingFaculty) {
      return null;
    }
    roomsMemoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeRoomsCache(rooms: RoomData[]) {
  const payload: RoomsCachePayload = {
    timestamp: Date.now(),
    rooms,
  };
  roomsMemoryCache = payload;
  try {
    sessionStorage.setItem(ROOMS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/storage errors and keep in-memory cache only.
  }
}

export default function RoomsPage() {
  const [allRoomsData, setAllRoomsData] = useState<RoomData[]>([]);
  const [roomEquipment, setRoomEquipment] = useState<InventoryEquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [disabledRoomNames, setDisabledRoomNames] = useState<string[]>([]);
  const authSession = useMemo(() => readAuthSession(), []);
  const canManageRoomState = authSession?.role === "admin";

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      try {
        const state = await loadSharedScheduleState();
        if (cancelled) return;
        setDisabledRoomNames(state.disabledRooms);
      } catch {
        if (!cancelled) {
          setDisabledRoomNames([]);
        }
      }
    };

    void loadState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cached = readRoomsCache();
    const hasCachedRooms = Boolean(cached && cached.rooms.length > 0);
    const cacheIsFresh = Boolean(cached && Date.now() - cached.timestamp < ROOMS_CACHE_TTL_MS);

    if (hasCachedRooms && cached) {
      setAllRoomsData(cached.rooms);
      setSelectedRoom((prev) => prev ?? cached.rooms[0]?.id ?? null);
      setLoading(false);
    }

    const fetchRooms = async () => {
      try {
        if (!hasCachedRooms) {
          setLoading(true);
          setError(null);
        }

        const data = await fetchApiJson<ApiResponse>("/api/schedules/rooms-info", {
          cache: "no-store",
        });
        const todayName = getTodayName();
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const groupedSalones = new Map<string, ApiSalon[]>();
        data.roomsByFloor.flat().forEach((salon) => {
          const key = buildRoomMergeKey(salon);
          if (!groupedSalones.has(key)) {
            groupedSalones.set(key, []);
          }
          groupedSalones.get(key)?.push(salon);
        });

        const mergedSalones: ApiSalon[] = Array.from(groupedSalones.values())
          .map((group) => {
            const visibleCandidates = group.filter((salon) => isRoomVisible(salon));
            if (visibleCandidates.length === 0) {
              return null;
            }

            const displaySalon = visibleCandidates.sort((a, b) => b.horarios.length - a.horarios.length)[0];

            const uniqueHorarios = new Map<string, ApiSalon["horarios"][number]>();
            group.forEach((salon) => {
              salon.horarios.forEach((horario) => {
                const horarioKey = [
                  horario.diaSemana,
                  horario.horaInicio,
                  horario.horaFin,
                  horario.evento.nombrePrincipal,
                  horario.evento.responsable,
                ].join("|");
                if (!uniqueHorarios.has(horarioKey)) {
                  uniqueHorarios.set(horarioKey, horario);
                }
              });
            });

            return {
              ...displaySalon,
              horarios: Array.from(uniqueHorarios.values()),
            };
          })
          .filter((salon): salon is ApiSalon => salon !== null);

        // Convertir datos del API al formato esperado
        const rooms: RoomData[] = [];
        const seenRoomNames = new Set<string>();
        mergedSalones.forEach((salon) => {
            const normalizedName = normalizeRoomName(salon.nombre);
            if (seenRoomNames.has(normalizedName)) {
              return;
            }
            seenRoomNames.add(normalizedName);

            const todaySchedules = salon.horarios
              .filter((h) => h.diaSemana === todayName)
              .sort((a, b) => parseTimeToMinutes(a.horaInicio) - parseTimeToMinutes(b.horaInicio));

            let status: RoomStatus = "Available";
            let displaySchedule: (typeof todaySchedules)[number] | null = null;
            let remaining = "-";
            let cardDetail = "No hay clases programadas hoy";

            const currentSchedule = todaySchedules.find((item) => {
              const start = parseTimeToMinutes(item.horaInicio);
              const end = parseTimeToMinutes(item.horaFin);
              if (!Number.isFinite(start) || !Number.isFinite(end)) {
                return false;
              }
              if (!hasSessionName(item.evento.nombrePrincipal)) {
                return false;
              }
              return currentMinutes >= start && currentMinutes < end;
            });

            if (currentSchedule) {
              status = "Occupied";
              displaySchedule = currentSchedule;
              const end = parseTimeToMinutes(currentSchedule.horaFin);
              remaining = `${Math.max(end - currentMinutes, 1)} min restantes`;
              cardDetail = currentSchedule.evento.nombrePrincipal?.trim() || "Clase en curso";
            } else {
              const nextSchedule = todaySchedules.find((item) => {
                if (!hasSessionName(item.evento.nombrePrincipal)) {
                  return false;
                }
                return parseTimeToMinutes(item.horaInicio) > currentMinutes;
              });
              if (nextSchedule) {
                const minutesUntilStart = parseTimeToMinutes(nextSchedule.horaInicio) - currentMinutes;
                if (minutesUntilStart <= 60) {
                  status = "Starting Soon";
                  displaySchedule = nextSchedule;
                  remaining = `Inicia en ${minutesUntilStart} min`;
                  cardDetail = `Inicia en ${minutesUntilStart} min`;
                } else {
                  cardDetail = `Próxima clase a las ${formatTimeAmPm(nextSchedule.horaInicio)}`;
                }
              } else if (todaySchedules.length > 0) {
                const lastTodaySchedule = todaySchedules[todaySchedules.length - 1];
                cardDetail = `Última clase terminó a las ${formatTimeLabel(lastTodaySchedule.horaFin)}`;
              }
            }

            const session = displaySchedule && hasSessionName(displaySchedule.evento.nombrePrincipal)
              ? displaySchedule.evento.nombrePrincipal.trim()
              : "Sin clase activa";
            const professor = displaySchedule && displaySchedule.evento.responsable
              ? displaySchedule.evento.responsable.trim() || "N/A"
              : "N/A";
            const faculty = getFacultyForDisplaySchedule(salon, displaySchedule);
            const schedule = displaySchedule
              ? `${formatTimeLabel(displaySchedule.horaInicio)} - ${formatTimeLabel(displaySchedule.horaFin)}`
              : "Disponible ahora";

            rooms.push({
              id: salon.id,
              nombre: salon.nombre,
              piso: getEffectiveFloor(salon),
              capacidad: salon.capacidad,
              status,
              cardDetail,
              session,
              section: displaySchedule ? `${displaySchedule.evento.codigoMateria || ""}` : "Espacio libre",
              professor,
              faculty,
              schedule,
              remaining,
            });
        });

        setAllRoomsData(rooms);
        writeRoomsCache(rooms);
        setSelectedRoom((prev) => prev ?? rooms[0]?.id ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error loading rooms";
        if (!hasCachedRooms) {
          setError(message);
        }
        console.error("Failed to load rooms:", err);
      } finally {
        if (!hasCachedRooms) {
          setLoading(false);
        }
      }
    };

    // Si cache está fresca, evitamos request al reingresar para que se sienta instantáneo.
    if (!cacheIsFresh) {
      void fetchRooms();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRoomEquipment = async () => {
      try {
        const data = await fetchApiJson<{ items?: InventoryEquipmentItem[] }>("/api/inventory/rooms-equipment", {
          cache: "no-store",
        });

        if (!cancelled) {
          setRoomEquipment(data.items ?? []);
        }
      } catch {
        if (!cancelled) {
          setRoomEquipment([]);
        }
      }
    };

    void loadRoomEquipment();

    return () => {
      cancelled = true;
    };
  }, []);

  // Agrupar salas por piso y ordenarlas por número
  const roomsByFloor = useMemo(() => {
    const floors = new Map<number, RoomData[]>();
    allRoomsData.forEach((room) => {
      const floor = room.piso ?? 0;
      if (floor > 0 && !floors.has(floor)) {
        floors.set(floor, []);
      }
      if (floor > 0) {
        floors.get(floor)?.push(room);
      }
    });

    return Array.from(floors.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([floor, rooms]) => ({
        floor: `Piso ${floor}`,
        rooms: rooms.sort((a, b) => extractRoomNumber(a.nombre) - extractRoomNumber(b.nombre)),
      }));
  }, [allRoomsData]);

  const selectedInfo = useMemo(
    () => allRoomsData.find((item) => item.id === selectedRoom) ?? allRoomsData[0],
    [allRoomsData, selectedRoom]
  );
  const selectedStatusMeta = selectedInfo ? getStatusMeta(selectedInfo.status) : getStatusMeta("Available");
  const disabledRoomKeys = useMemo(() => getDisabledRoomKeys(disabledRoomNames), [disabledRoomNames]);
  const isSelectedRoomDisabled = selectedInfo ? isRoomDisabled(selectedInfo.nombre, disabledRoomKeys) : false;
  const selectedRoomEquipment = useMemo(() => {
    if (!selectedInfo) return [];

    return roomEquipment
      .filter((item) => roomMatches(selectedInfo.nombre, item.room))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [roomEquipment, selectedInfo]);

  const toggleItemDefective = async (item: InventoryEquipmentItem) => {
    if (authSession?.role !== "admin") return;

    const nextDefective = !item.defective;
    const motivo = nextDefective
      ? window.prompt(`Motivo para marcar "${item.name}" como defectuoso`, item.motivo ?? "")?.trim() ?? null
      : item.motivo ?? null;

    if (nextDefective && !motivo) {
      return;
    }

    try {
      await fetchApiJson<{ id: string }>(`/api/inventory/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: item.groupId,
          name: item.name,
          code: item.code,
          room: item.room,
          status: item.status,
          defective: nextDefective,
          motivo,
        }),
      });

      const updatedEquipment = roomEquipment.map((eq) =>
        eq.id === item.id ? { ...eq, defective: nextDefective, motivo } : eq
      );
      setRoomEquipment(updatedEquipment);
    } catch (error) {
      console.error("Error toggling defect status:", error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (authSession?.role !== "admin") return;

    try {
      await fetchApiJson(`/api/inventory/items/${itemId}`, {
        method: "DELETE",
      });

      const updatedEquipment = roomEquipment.filter((eq) => eq.id !== itemId);
      setRoomEquipment(updatedEquipment);
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const handleMoveRoom = (itemId: string) => {
    // This would require opening an edit dialog or modal
    // For now, we'll show an alert
    alert("Editar sala: Esta función aún no está implementada. Dirígete a Inventario para editar el salón del elemento.");
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
          <p className="text-slate-600">Cargando salones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">Error al cargar salones: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col overflow-x-hidden lg:h-[calc(100vh-4rem)] lg:flex-row lg:overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h3 className="mb-1 text-xl font-bold sm:text-2xl">Disponibilidad de Salones</h3>
          <p className="text-sm text-slate-500">Estado de ocupación en tiempo real en todos los pisos.</p>
        </div>

        <div className="space-y-6 pb-8 sm:space-y-8 sm:pb-12">
          {roomsByFloor.map((group) => (
            <div key={group.floor} className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="rounded bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{group.floor}</span>
                <div className="h-[1px] flex-1 bg-primary/10"></div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {group.rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room.nombre}
                    status={room.status}
                    detail={room.cardDetail}
                    disabled={isRoomDisabled(room.nombre, disabledRoomKeys)}
                    selected={selectedRoom === room.id}
                    onSelect={() => {
                      setSelectedRoom(room.id);
                      setIsRoomModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="hidden w-full border-t border-primary/10 bg-white dark:bg-slate-900 lg:block lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-l">
        <div className="p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between sm:mb-8">
            <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Información del Salón</h3>
            <button type="button" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
            <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100">{selectedInfo.nombre}</h4>
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold tracking-wide uppercase ${selectedStatusMeta.pillClass}`}>
                <span className="material-symbols-outlined text-xs">{selectedStatusMeta.icon}</span>
                {selectedStatusMeta.label}
              </span>
            </div>
            {selectedInfo.capacidad && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Capacidad: {selectedInfo.capacidad} personas
              </p>
            )}
          </div>

          <div className="space-y-5 sm:space-y-6">
            <div>
              <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sesión Actual</p>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-900 dark:text-slate-100">{selectedInfo.session}</h5>
                <p className="text-xs text-slate-500">{selectedInfo.section}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Docente</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                  <span className="material-symbols-outlined text-slate-400">person</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{selectedInfo.professor}</p>
                  <p className="text-[10px] text-slate-500">{selectedInfo.faculty}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Horario</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base text-slate-400">schedule</span>
                <span>
                  {selectedInfo.schedule}
                  {selectedInfo.remaining !== "-" ? ` (${selectedInfo.remaining})` : ""}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 dark:border-slate-800 sm:pt-6">
              <p className="mb-4 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Equipamiento del Salón</p>
              {selectedRoomEquipment.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {selectedRoomEquipment.map((item) => (
                    <Equip
                      key={item.id}
                      item={item}
                      icon={item.groupIcon}
                      label={item.name}
                      caption={item.groupName}
                      defective={item.defective}
                      code={item.code}
                      onToggleDefect={toggleItemDefective}
                      onMoveRoom={handleMoveRoom}
                      onDelete={handleDeleteItem}
                      canManageInventory={authSession?.role === "admin"}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                  No hay equipamiento registrado para este salón.
                </div>
              )}
            </div>

            <div className="pt-4 sm:pt-6">
              {canManageRoomState ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedInfo) return;
                    const next = await setSharedRoomDisabledState(selectedInfo.nombre, !isSelectedRoomDisabled);
                    setDisabledRoomNames(next.disabledRooms);
                  }}
                  className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-all ${
                    isSelectedRoomDisabled
                      ? "bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
                      : "bg-red-600 shadow-red-500/20 hover:bg-red-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">block</span>
                  {isSelectedRoomDisabled ? "Habilitar Salón" : "Inhabilitar Salón"}
                </button>
              ) : null}
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
                <span className="material-symbols-outlined text-sm">edit</span>
                Administrar Horario
              </button>
              <button className="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                Ver Historial Completo
              </button>
            </div>
          </div>
        </div>
      </aside>

      {isRoomModalOpen && selectedInfo ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 p-0 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cerrar información del salón"
            className="absolute inset-0"
            onClick={() => setIsRoomModalOpen(false)}
          />
          <div className="relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Información del Salón</h3>
              <button
                type="button"
                onClick={() => setIsRoomModalOpen(false)}
                className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-slate-400">close</span>
              </button>
            </div>

            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
              <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100">{selectedInfo.nombre}</h4>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold tracking-wide uppercase ${selectedStatusMeta.pillClass}`}>
                  <span className="material-symbols-outlined text-xs">{selectedStatusMeta.icon}</span>
                  {selectedStatusMeta.label}
                </span>
              </div>
              {selectedInfo.capacidad && (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Capacidad: {selectedInfo.capacidad} personas
                </p>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Sesión Actual</p>
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100">{selectedInfo.session}</h5>
                  <p className="text-xs text-slate-500">{selectedInfo.section}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Docente</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                    <span className="material-symbols-outlined text-slate-400">person</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedInfo.professor}</p>
                    <p className="text-[10px] text-slate-500">{selectedInfo.faculty}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Horario</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-base text-slate-400">schedule</span>
                  <span>
                    {selectedInfo.schedule}
                    {selectedInfo.remaining !== "-" ? ` (${selectedInfo.remaining})` : ""}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
                <p className="mb-4 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Equipamiento del Salón</p>
                {selectedRoomEquipment.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedRoomEquipment.map((item) => (
                      <Equip
                        key={item.id}
                        item={item}
                        icon={item.groupIcon}
                        label={item.name}
                        caption={item.groupName}
                        defective={item.defective}
                        code={item.code}
                        onToggleDefect={toggleItemDefective}
                        onMoveRoom={handleMoveRoom}
                        onDelete={handleDeleteItem}
                        canManageInventory={authSession?.role === "admin"}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                    No hay equipamiento registrado para este salón.
                  </div>
                )}
              </div>

              <div className="pt-3 pb-2">
                {canManageRoomState ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedInfo) return;
                      const next = await setSharedRoomDisabledState(selectedInfo.nombre, !isSelectedRoomDisabled);
                      setDisabledRoomNames(next.disabledRooms);
                    }}
                    className={`mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-all ${
                      isSelectedRoomDisabled
                        ? "bg-emerald-600 shadow-emerald-500/20 hover:bg-emerald-700"
                        : "bg-red-600 shadow-red-500/20 hover:bg-red-700"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">block</span>
                    {isSelectedRoomDisabled ? "Habilitar Salón" : "Inhabilitar Salón"}
                  </button>
                ) : null}
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Administrar Horario
                </button>
                <button className="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                  Ver Historial Completo
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RoomCardProps = {
  room: string;
  status: RoomStatus;
  detail: string;
  disabled?: boolean;
  selected?: boolean;
  onSelect: () => void;
};

function RoomCard({ room, status, detail, disabled = false, selected, onSelect }: RoomCardProps) {
  const selectedStyles = selected
    ? "border-2 border-primary relative"
    : "border border-slate-200 dark:border-slate-700";
  const disabledStyles = disabled ? "border-2 border-red-500 bg-red-50 dark:bg-red-950/30" : selectedStyles;
  const statusMeta = getStatusMeta(status);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full cursor-pointer rounded-xl p-3 text-left transition-all hover:shadow-lg sm:p-4 ${disabled ? "dark:bg-red-950/20" : "bg-white dark:bg-slate-800"} ${disabledStyles}`}
    >
      <div className="mb-3">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold tracking-wide uppercase ${statusMeta.pillClass}`}>
          <span className="material-symbols-outlined text-xs">{statusMeta.icon}</span>
          {statusMeta.label}
        </span>
        {disabled ? (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold tracking-wide text-red-700 uppercase dark:bg-red-900/60 dark:text-red-100">
            <span className="material-symbols-outlined text-xs">warning</span>
            Inhabilitado
          </span>
        ) : null}
      </div>
      <div className="mb-4 flex items-start justify-between gap-2">
        <span className="flex-1 whitespace-normal text-base font-bold sm:text-lg">{room}</span>
      </div>
      {disabled ? (
        <p className="rounded-md border border-red-200 bg-red-100 px-2 py-1 text-[10px] font-black tracking-widest text-red-700 uppercase dark:border-red-800 dark:bg-red-900/40 dark:text-red-100">
          Inhabilitado
        </p>
      ) : (
        <p className={`text-[10px] font-bold tracking-widest uppercase ${selected ? "font-black text-primary" : "text-slate-400"}`}>
          {detail}
        </p>
      )}
      {selected && (
        <div className="absolute -top-2 -right-2 rounded-full bg-primary p-1 text-[10px] text-white">
          <span className="material-symbols-outlined text-xs">check</span>
        </div>
      )}
    </button>
  );
}

function Equip({
  item,
  icon,
  label,
  caption,
  defective = false,
  code,
  onToggleDefect,
  onMoveRoom,
  onDelete,
  canManageInventory = false,
}: {
  item: InventoryEquipmentItem;
  icon: string;
  label: string;
  caption?: string;
  defective?: boolean;
  code?: string;
  onToggleDefect?: (item: InventoryEquipmentItem) => Promise<void>;
  onMoveRoom?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
  canManageInventory?: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleToggleDefect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleDefect) return;

    await onToggleDefect(item);
    setIsMenuOpen(false);
  };

  const handleMoveRoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onMoveRoom) return;
    onMoveRoom(item.id);
    setIsMenuOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (confirm("¿Estás seguro de que deseas eliminar este elemento?")) {
      onDelete(item.id);
    }
    setIsMenuOpen(false);
  };

  return (
    <div
      className={`relative flex flex-col items-center rounded-lg border p-3 ${
        defective
          ? "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20"
          : "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50"
      }`}
    >
      {canManageInventory ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className="absolute top-1 right-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <span className="material-symbols-outlined text-lg">more_vert</span>
        </button>
      ) : null}

      {isMenuOpen && canManageInventory ? (
        <div className="absolute top-8 right-0 z-10 w-40 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={handleToggleDefect}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-base">
              {defective ? "check_circle" : "error"}
            </span>
            {defective ? "Marcar como Reparado" : "Marcar como Defectuoso"}
          </button>
          <button
            type="button"
            onClick={handleMoveRoom}
            className="flex w-full items-center gap-2 border-t border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-base">meeting_room</span>
            Mover de Salón
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex w-full items-center gap-2 border-t border-slate-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-900/20"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            Eliminar
          </button>
        </div>
      ) : null}

      <span className={`material-symbols-outlined mb-2 ${defective ? "text-rose-600" : "text-primary"}`}>{icon}</span>
      <div className="flex items-center justify-center gap-2">
        <span className="text-center text-[10px] font-semibold">{label}</span>
        {code ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[7px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{code}</span> : null}
      </div>
      {caption ? <span className="mt-1 text-center text-[9px] text-slate-400">{caption}</span> : null}
      {item.motivo ? <span className="mt-1 text-center text-[9px] font-medium text-rose-700">Motivo: {item.motivo}</span> : null}
    </div>
  );
}

function roomMatches(roomName: string, inventoryRoom: string) {
  const selected = normalizeRoomName(roomName);
  const stored = normalizeRoomName(inventoryRoom);

  if (selected === stored) return true;

  const selectedNumber = extractRoomNumber(roomName);
  const storedNumber = extractRoomNumber(inventoryRoom);
  if (selectedNumber !== 9999 && selectedNumber === storedNumber) return true;

  return selected.includes(stored) || stored.includes(selected);
}
