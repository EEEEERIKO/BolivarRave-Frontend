import { fetchApiJson } from "@/lib/api-client";

const normalizeRoomIdentifier = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

export type SharedScheduleVisualAssignment = {
  eventId: string;
  targetDate: string;
  roomName: string;
};

export type SharedScheduleState = {
  disabledRooms: string[];
  visualAssignments: SharedScheduleVisualAssignment[];
};

export type RoomActionType = "inhabilitado" | "habilitado" | "danio_reportado" | "salon_limpio";

export type RoomActionHistoryItem = {
  id: string;
  roomId: string;
  roomName: string;
  actionType: RoomActionType;
  note: string | null;
  createdAt: string;
  createdByStaffId: string | null;
  createdByName: string | null;
  createdByRole: string | null;
};

export const getDisabledRoomKeys = (disabledRooms: string[]): Set<string> => {
  return new Set(disabledRooms.map((name) => normalizeRoomIdentifier(name)));
};

export const isRoomDisabled = (roomName: string, disabledRooms: Set<string> | string[]): boolean => {
  const keys = disabledRooms instanceof Set ? disabledRooms : getDisabledRoomKeys(disabledRooms);
  return keys.has(normalizeRoomIdentifier(roomName));
};

export const loadSharedScheduleState = async (): Promise<SharedScheduleState> => {
  return fetchApiJson<SharedScheduleState>("/api/schedules/state", { cache: "no-store" });
};

export const setSharedRoomDisabledState = async (roomName: string, disabled: boolean): Promise<SharedScheduleState> => {
  return fetchApiJson<SharedScheduleState>("/api/schedules/state/disabled-rooms", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomName, disabled }),
  });
};

export const setSharedVisualRoomAssignment = async (payload: {
  eventId: string;
  targetDate: string;
  roomName: string;
}): Promise<SharedScheduleState> => {
  return fetchApiJson<SharedScheduleState>("/api/schedules/state/visual-assignments", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const clearSharedVisualRoomAssignment = async (payload: {
  eventId: string;
  targetDate: string;
}): Promise<SharedScheduleState> => {
  return fetchApiJson<SharedScheduleState>("/api/schedules/state/visual-assignments", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const reportRoomDamage = async (payload: {
  roomId: string;
  note: string;
}): Promise<{ message: string }> => {
  return fetchApiJson<{ message: string }>(`/api/schedules/rooms/${payload.roomId}/actions/damage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note: payload.note }),
  });
};

export const markRoomClean = async (payload: {
  roomId: string;
}): Promise<{ message: string }> => {
  return fetchApiJson<{ message: string }>(`/api/schedules/rooms/${payload.roomId}/actions/clean`, {
    method: "POST",
  });
};

export const loadRoomActionHistory = async (roomId: string): Promise<RoomActionHistoryItem[]> => {
  const response = await fetchApiJson<{ history?: RoomActionHistoryItem[] }>(`/api/schedules/rooms/${roomId}/history`, {
    cache: "no-store",
  });

  return response.history ?? [];
};

export { normalizeRoomIdentifier };
