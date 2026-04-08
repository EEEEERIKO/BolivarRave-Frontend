"use client";

import { useEffect, useMemo, useState } from "react";

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
  schedule: string;
  remaining: string;
};

type ApiSalon = {
  id: string;
  nombre: string;
  piso: number | null;
  capacidad: number | null;
  horarios: Array<{
    diaSemana: string;
    horaInicio: string;
    horaFin: string;
    evento: {
      nombrePrincipal: string;
      responsable: string;
      codigoMateria: string | null;
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

type RoomsCachePayload = {
  timestamp: number;
  rooms: RoomData[];
};

const ROOMS_CACHE_KEY = "rooms-page-cache-v1";
const ROOMS_CACHE_TTL_MS = 2 * 60 * 1000;
let roomsMemoryCache: RoomsCachePayload | null = null;

const FLOOR_ONE_ALLOWED = new Set([
  "aula foro union 101",
  "aula foro unac 102",
  "sala informática 1 bolivar",
  "sala informática 2 bolivar",
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

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

        const response = await fetch("/api/schedules/rooms-info", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch rooms");
        }

        const data = (await response.json()) as ApiResponse;
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
            let cardDetail = "No class scheduled today";

            const currentSchedule = todaySchedules.find((item) => {
              const start = parseTimeToMinutes(item.horaInicio);
              const end = parseTimeToMinutes(item.horaFin);
              if (!Number.isFinite(start) || !Number.isFinite(end)) {
                return false;
              }
              return currentMinutes >= start && currentMinutes < end;
            });

            if (currentSchedule) {
              status = "Occupied";
              displaySchedule = currentSchedule;
              const end = parseTimeToMinutes(currentSchedule.horaFin);
              remaining = `${Math.max(end - currentMinutes, 1)}m left`;
              cardDetail = currentSchedule.evento.nombrePrincipal;
            } else {
              const nextSchedule = todaySchedules.find((item) => parseTimeToMinutes(item.horaInicio) > currentMinutes);
              if (nextSchedule) {
                const minutesUntilStart = parseTimeToMinutes(nextSchedule.horaInicio) - currentMinutes;
                if (minutesUntilStart <= 60) {
                  status = "Starting Soon";
                  displaySchedule = nextSchedule;
                  remaining = `Starts in ${minutesUntilStart}m`;
                  cardDetail = `Starts in ${minutesUntilStart}m`;
                } else {
                  cardDetail = `Next class at ${formatTimeLabel(nextSchedule.horaInicio)}`;
                }
              } else if (todaySchedules.length > 0) {
                const lastTodaySchedule = todaySchedules[todaySchedules.length - 1];
                cardDetail = `Last class ended at ${formatTimeLabel(lastTodaySchedule.horaFin)}`;
              }
            }

            const session = displaySchedule ? displaySchedule.evento.nombrePrincipal : "No active class";
            const professor = displaySchedule ? displaySchedule.evento.responsable : "N/A";
            const schedule = displaySchedule
              ? `${formatTimeLabel(displaySchedule.horaInicio)} - ${formatTimeLabel(displaySchedule.horaFin)}`
              : "Available now";

            rooms.push({
              id: salon.id,
              nombre: salon.nombre,
              piso: getEffectiveFloor(salon),
              capacidad: salon.capacidad,
              status,
              cardDetail,
              session,
              section: displaySchedule ? `${displaySchedule.evento.codigoMateria || ""}` : "Free slot",
              professor,
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

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary"></div>
          <p className="text-slate-600">Cargando salones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">Error al cargar salones: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8">
          <h3 className="mb-1 text-2xl font-bold">Disponibilidad de Salones</h3>
          <p className="text-sm text-slate-500">Estado de ocupación en tiempo real en todos los pisos.</p>
          <div className="mt-6 flex gap-4">
            <Legend dot="bg-emerald-500" label="Disponible" />
            <Legend dot="bg-rose-500" label="En Clase" />
            <Legend dot="bg-amber-400" label="Inicia Pronto" />
          </div>
        </div>

        <div className="space-y-8 pb-12">
          {roomsByFloor.map((group) => (
            <div key={group.floor} className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="rounded bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{group.floor}</span>
                <div className="h-[1px] flex-1 bg-primary/10"></div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {group.rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room.nombre}
                    status={room.status}
                    detail={room.cardDetail}
                    selected={selectedRoom === room.id}
                    onSelect={() => setSelectedRoom(room.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="w-80 overflow-y-auto border-l border-primary/10 bg-white dark:bg-slate-900">
        <div className="p-6">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Información del Salón</h3>
            <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
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

          <div className="space-y-6">
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
                  <p className="text-[10px] text-slate-500">Departamento</p>
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

            <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
              <p className="mb-4 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Equipamiento del Salón</p>
              <div className="grid grid-cols-2 gap-4">
                <Equip icon="videocam" label="Proyector" />
                <Equip icon="wifi" label="Wi-Fi de Alta Velocidad" />
                <Equip icon="tv" label="Smart TV" />
                <Equip icon="volume_up" label="Sistema de Sonido" />
              </div>
            </div>

            <div className="pt-6">
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
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${dot}`}></span>
      <span className="text-xs font-medium uppercase text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

type RoomCardProps = {
  room: string;
  status: RoomStatus;
  detail: string;
  selected?: boolean;
  onSelect: () => void;
};

function RoomCard({ room, status, detail, selected, onSelect }: RoomCardProps) {
  const selectedStyles = selected ? "border-2 border-primary relative" : "border border-slate-200 dark:border-slate-700";
  const statusMeta = getStatusMeta(status);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full cursor-pointer rounded-xl bg-white p-4 text-left transition-all hover:shadow-lg dark:bg-slate-800 ${selectedStyles}`}
    >
      <div className="mb-3">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold tracking-wide uppercase ${statusMeta.pillClass}`}>
          <span className="material-symbols-outlined text-xs">{statusMeta.icon}</span>
          {statusMeta.label}
        </span>
      </div>
      <div className="mb-4 flex items-start justify-between gap-2">
        <span className="text-lg font-bold whitespace-normal flex-1">{room}</span>
      </div>
      <p className={`text-[10px] font-bold tracking-widest uppercase ${selected ? "font-black text-primary" : "text-slate-400"}`}>
        {detail}
      </p>
      {selected && (
        <div className="absolute -top-2 -right-2 rounded-full bg-primary p-1 text-[10px] text-white">
          <span className="material-symbols-outlined text-xs">check</span>
        </div>
      )}
    </button>
  );
}

function Equip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
      <span className="material-symbols-outlined mb-2 text-primary">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}
