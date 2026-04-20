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

export { normalizeRoomIdentifier };
