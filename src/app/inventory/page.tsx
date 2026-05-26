"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { fetchApiJson, fetchApiJsonWithOptions } from "@/lib/api-client";
import { readAuthSession } from "@/lib/auth-session";

type InventoryGroup = {
  id: string;
  name: string;
  icon: string;
  order: number;
  itemCount: number;
  defectiveCount: number;
  availableCount: number;
  fixedCount: number;
};

type InventoryItem = {
  id: string;
  groupId: string;
  groupName: string;
  groupIcon: string;
  name: string;
  code: string;
  room: string;
  status: "Disponible" | "Fijo" | "Asignado";
  defective: boolean;
  motivo: string | null;
  price?: number | null;
  order: number;
  hdmiAssigned?: boolean;
  hdmiItemId?: string | null;
};

type InventoryGroupFormState = {
  name: string;
  icon: string;
};

type InventoryItemFormState = {
  groupId: string;
  name: string;
  code: string;
  room: string;
  status: "Disponible" | "Fijo" | "Asignado";
  defective: boolean;
  motivo: string;
  price?: number | null;
  hdmiAssigned?: boolean;
  hdmiItemId?: string | null;
};

type InventoryModalState =
  | { kind: "group"; mode: "create" | "edit"; groupId?: string }
  | { kind: "item"; mode: "create" | "edit"; itemId?: string }
  | { kind: "defective-item"; itemId: string }
  | { kind: "delete-group"; groupId: string }
  | { kind: "delete-item"; itemId: string }
  | null;

const INVENTORY_ICON_OPTIONS = [
  { value: "inventory_2", label: "Inventario" },
  { value: "tv", label: "Televisor" },
  { value: "cable", label: "Cable" },
  { value: "settings_ethernet", label: "Ethernet" },
  { value: "power", label: "Energía" },
  { value: "speaker", label: "Audio" },
  { value: "mic", label: "Micrófono" },
  { value: "graphic_eq", label: "Mezcla" },
  { value: "settings_input_component", label: "Adaptador" },
  { value: "router", label: "Red" },
  { value: "computer", label: "Computador" },
  { value: "school", label: "Académico" },
];

const getGroupBadge = (group: InventoryGroup) => {
  if (group.defectiveCount > 0) {
    return {
      label: "Revisar",
      className: "bg-[#fe8983]/20 text-[#752121]",
    };
  }

  return {
    label: "Operativo",
    className: "bg-[#d5e3ff] text-[#2c5287]",
  };
};

const normalizeStatus = (value: string | null | undefined): "Disponible" | "Fijo" | "Asignado" => {
  if (value === "Fijo" || value === "Asignado") {
    return value;
  }

  return "Disponible";
};

function formatCurrencyCOP(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(Number(value));
  } catch {
    return `COP ${Number(value).toFixed(2)}`;
  }
}

function isHdmiGroupName(groupName: string): boolean {
  return groupName.trim().toLowerCase().includes("hdmi");
}

function isTelevisionGroupName(groupName: string): boolean {
  const normalized = groupName.trim().toLowerCase();
  return normalized.includes("tv") || normalized.includes("televisor") || normalized.includes("television") || normalized.includes("tele");
}

function getLocationSortKey(room: string): { floor: number; label: string } {
  const normalized = room.trim().toLowerCase();
  const floorMatch = normalized.match(/piso\s*(\d+)/i);

  return {
    floor: floorMatch ? Number.parseInt(floorMatch[1], 10) : 99,
    label: normalized,
  };
}

export default function InventoryPage() {
  const LOCAL_DEFECTIVE_REASON_KEY = "inventory_defective_reason_overrides_v1";

  const [inventoryGroups, setInventoryGroups] = useState<InventoryGroup[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [defectiveReasonOverrides, setDefectiveReasonOverrides] = useState<Record<string, string>>({});
  const defectiveReasonOverridesRef = useRef<Record<string, string>>({});
  const [roomCatalog, setRoomCatalog] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<InventoryModalState>(null);
  const [activeItemMenuId, setActiveItemMenuId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<InventoryGroupFormState>({
    name: "",
    icon: "inventory_2",
  });
  const [itemForm, setItemForm] = useState<InventoryItemFormState>({
    groupId: "",
    name: "",
    code: "",
    room: "",
    status: "Disponible",
    defective: false,
    motivo: "",
  });
  const [defectiveReason, setDefectiveReason] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const [hdmiSearchQuery, setHdmiSearchQuery] = useState<string>("");
  const [hdmiAssignedLabel, setHdmiAssignedLabel] = useState<string>("");
  const [showHdmiSelector, setShowHdmiSelector] = useState(false);
  const [showCreateHdmiModal, setShowCreateHdmiModal] = useState(false);
  const [newHdmiForm, setNewHdmiForm] = useState({ name: "", price: "", code: "" });
  const groupsScrollRef = useRef<HTMLDivElement | null>(null);

  const authSession = useMemo(() => readAuthSession(), []);
  const canManageInventory = authSession?.role === "admin" || authSession?.role === "monitor";
  const canDeleteGroup = authSession?.role === "admin";

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(LOCAL_DEFECTIVE_REASON_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        defectiveReasonOverridesRef.current = parsed;
        setDefectiveReasonOverrides(parsed);
      }
    } catch {
      // Ignore invalid local cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    defectiveReasonOverridesRef.current = defectiveReasonOverrides;

    try {
      window.localStorage.setItem(LOCAL_DEFECTIVE_REASON_KEY, JSON.stringify(defectiveReasonOverrides));
    } catch {
      // Ignore storage failures
    }
  }, [defectiveReasonOverrides]);

  const loadInventory = async () => {
    setIsLoadingInventory(true);
    setInventoryError(null);

    try {
      const [groupsResponse, itemsResponse, roomsResponse] = await Promise.allSettled([
        fetchApiJson<{ groups?: InventoryGroup[] }>("/api/inventory/groups", { cache: "no-store" }),
        fetchApiJson<{ items?: InventoryItem[] }>("/api/inventory/items", { cache: "no-store" }),
        fetchApiJson<{ rooms?: string[] }>("/api/schedules/rooms", { cache: "no-store" }),
      ]);

      const nextGroups = groupsResponse.status === "fulfilled" ? groupsResponse.value.groups ?? [] : [];
      const nextItems = itemsResponse.status === "fulfilled" ? itemsResponse.value.items ?? [] : [];
      const nextRooms =
        roomsResponse.status === "fulfilled"
          ? Array.from(new Set((roomsResponse.value.rooms ?? []).filter((room) => typeof room === "string" && room.trim().length > 0)))
          : [];

      setInventoryGroups(nextGroups);
      const currentOverrides = defectiveReasonOverridesRef.current;
      const hydratedItems = nextItems.map((item) => {
        if (item.defective && (!item.motivo || item.motivo.trim().length === 0)) {
          const fallbackReason = currentOverrides[item.id];
          if (fallbackReason) {
            return { ...item, motivo: fallbackReason };
          }
        }
        return item;
      });

      setInventoryItems(hydratedItems);
      setRoomCatalog(nextRooms.length > 0 ? nextRooms : Array.from(new Set(nextItems.map((item) => item.room).filter((room) => room.trim().length > 0))));

      setSelectedGroupId((current) => {
        if (current && nextGroups.some((group) => group.id === current)) {
          return current;
        }

        return nextGroups[0]?.id ?? "";
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cargar el inventario";
      setInventoryError(message);
      setInventoryGroups([]);
      setInventoryItems([]);
      setRoomCatalog([]);
      setSelectedGroupId("");
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    void loadInventory();
  }, []);

  const selectedGroup = useMemo(
    () => inventoryGroups.find((group) => group.id === selectedGroupId) ?? inventoryGroups[0] ?? null,
    [inventoryGroups, selectedGroupId],
  );

  const selectedItems = useMemo(
    () =>
      inventoryItems
        .filter((item) => item.groupId === selectedGroup?.id)
        .sort((a, b) => {
          const locationA = getLocationSortKey(a.room);
          const locationB = getLocationSortKey(b.room);

          if (locationA.floor !== locationB.floor) {
            return locationA.floor - locationB.floor;
          }

          if (locationA.label !== locationB.label) {
            return locationA.label.localeCompare(locationB.label);
          }

          return a.name.localeCompare(b.name);
        }),
    [inventoryItems, selectedGroup],
  );

  const selectedGroupItemCount = useMemo(
    () => selectedGroup?.itemCount ?? selectedItems.length,
    [selectedGroup, selectedItems.length],
  );

  const defectiveCount = useMemo(
    () => selectedItems.filter((item) => item.defective).length,
    [selectedItems],
  );

  const inventoryItemsById = useMemo(() => {
    return new Map(inventoryItems.map((item) => [item.id, item] as const));
  }, [inventoryItems]);

  const hdmiItems = useMemo(() => inventoryItems.filter((item) => item.groupName === "Cables HDMI"), [inventoryItems]);

  const televisionByHdmiId = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventoryItems.forEach((item) => {
      const groupName = item.groupName.trim().toLowerCase();
      if (isTelevisionGroupName(groupName) && item.hdmiItemId) {
        map.set(item.hdmiItemId, item);
      }
    });
    return map;
  }, [inventoryItems]);

  const roomOptions = useMemo(() => {
    const options = [...roomCatalog];
    if (itemForm.room && !options.includes(itemForm.room)) {
      options.unshift(itemForm.room);
    }
    return options;
  }, [itemForm.room, roomCatalog]);

  const countByGroup = useMemo(() => {
    const map = new Map<string, number>();
    inventoryItems.forEach((item) => {
      map.set(item.groupId, (map.get(item.groupId) ?? 0) + 1);
    });
    return map;
  }, [inventoryItems]);

  const modalGroup =
    activeModal?.kind === "group"
      ? inventoryGroups.find((group) => group.id === activeModal.groupId) ?? selectedGroup ?? null
      : null;

  const modalItem =
    activeModal?.kind === "item"
      ? inventoryItems.find((item) => item.id === activeModal.itemId) ?? null
      : null;

  const modalDeleteGroup =
    activeModal?.kind === "delete-group"
      ? inventoryGroups.find((group) => group.id === activeModal.groupId) ?? null
      : null;

  const modalDeleteItem =
    activeModal?.kind === "delete-item"
      ? inventoryItems.find((item) => item.id === activeModal.itemId) ?? null
      : null;

  const refreshInventory = async () => {
    await loadInventory();
  };

  const upsertDefectiveReasonOverride = (itemId: string, reason: string) => {
    const next = {
      ...defectiveReasonOverridesRef.current,
      [itemId]: reason,
    };
    defectiveReasonOverridesRef.current = next;
    setDefectiveReasonOverrides(next);
  };

  const removeDefectiveReasonOverride = (itemId: string) => {
    if (!(itemId in defectiveReasonOverridesRef.current)) return;
    const next = { ...defectiveReasonOverridesRef.current };
    delete next[itemId];
    defectiveReasonOverridesRef.current = next;
    setDefectiveReasonOverrides(next);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalError(null);
    setIsModalSubmitting(false);
    setDefectiveReason("");
    setHdmiSearchQuery("");
    setHdmiAssignedLabel("");
    setShowHdmiSelector(false);
    setShowCreateHdmiModal(false);
    setNewHdmiForm({ name: "", price: "", code: "" });
  };

  const openGroupModal = (mode: "create" | "edit") => {
    if (!canManageInventory) return;

    const currentGroup = selectedGroup;
    setModalError(null);
    setIsModalSubmitting(false);
    setGroupForm({
      name: mode === "edit" && currentGroup ? currentGroup.name : "",
      icon: mode === "edit" && currentGroup ? currentGroup.icon : "inventory_2",
    });
    setActiveModal({ kind: "group", mode, groupId: currentGroup?.id });
  };

  const openItemModal = (mode: "create" | "edit", item?: InventoryItem) => {
    if (!canManageInventory) return;

    const defaultGroupId = selectedGroup?.id ?? inventoryGroups[0]?.id ?? "";
    setModalError(null);
    setIsModalSubmitting(false);
    setItemForm({
      groupId: mode === "edit" && item ? item.groupId : defaultGroupId,
      name: mode === "edit" && item ? item.name : "",
      code: mode === "edit" && item ? item.code : "",
      room: mode === "edit" && item ? item.room : "",
      status: mode === "edit" && item ? normalizeStatus(item.status) : "Disponible",
      defective: false,
      motivo: "",
      price: mode === "edit" && item ? item.price ?? null : null,
      hdmiAssigned: mode === "edit" && item ? !!item.hdmiAssigned : false,
      hdmiItemId: mode === "edit" && item ? item.hdmiItemId ?? null : null,
    });
    if (mode === "edit" && item) {
      setHdmiAssignedLabel(item.hdmiItemId ? "HDMI asignado" : "");
    } else {
      setHdmiAssignedLabel("");
    }
    setActiveModal({ kind: "item", mode, itemId: item?.id });
  };

  const openDefectiveModal = (item: InventoryItem) => {
    if (!canManageInventory) return;

    setModalError(null);
    setIsModalSubmitting(false);
    setDefectiveReason(item.motivo ?? "");
    setActiveModal({ kind: "defective-item", itemId: item.id });
  };

  const openDeleteGroupModal = () => {
    if (!canDeleteGroup || !selectedGroup) return;
    setModalError(null);
    setIsModalSubmitting(false);
    setActiveModal({ kind: "delete-group", groupId: selectedGroup.id });
  };

  const openDeleteItemModal = (item: InventoryItem) => {
    if (!canManageInventory) return;
    setModalError(null);
    setIsModalSubmitting(false);
    setActiveModal({ kind: "delete-item", itemId: item.id });
  };

  const createGroup = () => openGroupModal("create");

  const editGroup = () => openGroupModal("edit");

  const deleteGroup = () => openDeleteGroupModal();

  const createItem = () => openItemModal("create");

  const editItem = (item: InventoryItem) => openItemModal("edit", item);

  const deleteItem = (item: InventoryItem) => openDeleteItemModal(item);

  const markAsFixed = async (item: InventoryItem) => {
    if (!canManageInventory) return;

    try {
      setIsModalSubmitting(true);
      setModalError(null);

      await fetchApiJson<{ id: string }>(`/api/inventory/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: item.groupId,
          name: item.name,
          code: item.code,
          room: item.room,
          status: item.status,
          defective: false,
          motivo: null,
          price: item.price ?? null,
          hdmiAssigned: item.hdmiAssigned ?? false,
          hdmiItemId: item.hdmiItemId ?? null,
        }),
      });

      removeDefectiveReasonOverride(item.id);

      setActiveItemMenuId(null);
      await refreshInventory();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error al marcar como arreglado";
      setModalError(errorMessage);
    } finally {
      setIsModalSubmitting(false);
    }
  };

  const submitInventoryModal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeModal) return;

    setModalError(null);
    setIsModalSubmitting(true);

    try {
      if (activeModal.kind === "group") {
        if (!groupForm.name.trim()) {
          throw new Error("Debes ingresar el nombre del grupo.");
        }

        const payload = {
          name: groupForm.name.trim(),
          icon: groupForm.icon.trim() || "inventory_2",
        };

        if (activeModal.mode === "create") {
          const response = await fetchApiJson<{ id: string }>("/api/inventory/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          await refreshInventory();
          setSelectedGroupId(response.id);
        } else {
          const targetGroupId = activeModal.groupId ?? selectedGroup?.id;
          if (!targetGroupId) {
            throw new Error("No se encontró el grupo a editar.");
          }

          await fetchApiJson<{ id: string }>(`/api/inventory/groups/${targetGroupId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          await refreshInventory();
        }

        closeModal();
        return;
      }

      if (activeModal.kind === "item") {
        if (!itemForm.groupId) {
          throw new Error("Debes seleccionar un grupo para el elemento.");
        }

        if (!itemForm.name.trim() || !itemForm.code.trim() || !itemForm.room.trim()) {
          throw new Error("Completa nombre, código y salón del elemento.");
        }

        const payload = {
          groupId: itemForm.groupId,
          name: itemForm.name.trim(),
          code: itemForm.code.trim(),
          room: itemForm.room.trim(),
          status: itemForm.status,
          defective: itemForm.defective,
          motivo: itemForm.defective ? itemForm.motivo.trim() || null : null,
          price: typeof itemForm.price === "number" ? Number(itemForm.price) : null,
          hdmiAssigned: !!itemForm.hdmiAssigned,
          hdmiItemId: itemForm.hdmiItemId ?? null,
        };

        if (activeModal.mode === "create") {
          await fetchApiJson<{ id: string }>("/api/inventory/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          const targetItemId = activeModal.itemId;
          if (!targetItemId) {
            throw new Error("No se encontró el elemento a editar.");
          }

          await fetchApiJson<{ id: string }>(`/api/inventory/items/${targetItemId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        await refreshInventory();
        closeModal();
        return;
      }

      if (activeModal.kind === "delete-group") {
        await fetchApiJson<{ id: string }>(`/api/inventory/groups/${activeModal.groupId}`, {
          method: "DELETE",
        });

        await refreshInventory();
        closeModal();
        return;
      }

      if (activeModal.kind === "delete-item") {
        await fetchApiJson<{ id: string }>(`/api/inventory/items/${activeModal.itemId}`, {
          method: "DELETE",
        });

        await refreshInventory();
        closeModal();
        return;
      }

      if (activeModal.kind === "defective-item") {
        const targetItem = inventoryItems.find((item) => item.id === activeModal.itemId);
        if (!targetItem) {
          throw new Error("No se encontró el elemento a actualizar.");
        }

        const reason = defectiveReason.trim();
        if (!reason) {
          throw new Error("Debes ingresar un motivo para marcar el elemento como defectuoso.");
        }

        const defectivePayload = {
          groupId: targetItem.groupId,
          name: targetItem.name,
          code: targetItem.code,
          room: targetItem.room,
          status: targetItem.status,
          defective: true,
          motivo: reason,
          price: targetItem.price ?? null,
          hdmiAssigned: targetItem.hdmiAssigned ?? false,
          hdmiItemId: targetItem.hdmiItemId ?? null,
        };

        try {
          const response = await fetchApiJsonWithOptions<{ item?: InventoryItem }>(
            `/api/inventory/items/${targetItem.id}/defective`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ motivo: reason }),
            },
            { suppressExpectedStatuses: [404] },
          );

          if (response.item) {
            setInventoryItems((current) => current.map((item) => (item.id === response.item?.id ? (response.item as InventoryItem) : item)));

            if (response.item.motivo && response.item.motivo.trim().length > 0) {
              upsertDefectiveReasonOverride(targetItem.id, response.item.motivo);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          const shouldFallbackToLegacyUpdate =
            message.includes("HTTP 404") ||
            message.includes("No encontramos el recurso solicitado") ||
            message.includes("ya haya sido eliminado o movido");

          if (!shouldFallbackToLegacyUpdate) {
            throw error;
          }

          await fetchApiJson<{ id: string }>(`/api/inventory/items/${targetItem.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(defectivePayload),
          });
        }

        upsertDefectiveReasonOverride(targetItem.id, reason);
        setInventoryItems((current) =>
          current.map((item) =>
            item.id === targetItem.id
              ? {
                  ...item,
                  defective: true,
                  motivo: reason,
                }
              : item,
          ),
        );

        await refreshInventory();
        closeModal();
      }
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "No se pudo completar la acción");
    } finally {
      setIsModalSubmitting(false);
    }
  };

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
      {inventoryError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{inventoryError}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-lg bg-[#d5e3ff]/40 p-2 text-[#3a5f94]">analytics</span>
            <span className="text-[10px] font-bold tracking-widest text-[#3a5f94] uppercase">Live Status</span>
          </div>
          <h4 className="mb-1 text-sm font-medium text-[#566166]">Grupos Activos</h4>
          <div className="text-3xl font-extrabold tracking-tight text-[#2a3439]">{inventoryGroups.length}</div>
          <div className="mt-2 flex items-center text-[11px] text-[#566166]">Categorias de inventario registradas</div>
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-lg bg-[#d9d7f8]/40 p-2 text-[#5d5d78]">warning</span>
            <span className="text-[10px] font-bold tracking-widest text-[#5d5d78] uppercase">Action Required</span>
          </div>
          <h4 className="mb-1 text-sm font-medium text-[#566166]">Elementos Defectuosos</h4>
          <div className="text-3xl font-extrabold tracking-tight text-[#2a3439]">
            {inventoryItems.filter((item) => item.defective).length}
          </div>
          <div className="mt-2 flex items-center text-[11px] text-[#566166]">Pendientes por mantenimiento</div>
        </div>

        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-[0_10px_40px_rgba(42,52,57,0.06)]">
          <div className="mb-4 flex items-start justify-between">
            <span className="material-symbols-outlined rounded-lg bg-[#d3e4fe]/40 p-2 text-[#506076]">inventory_2</span>
            <span className="text-[10px] font-bold tracking-widest text-[#506076] uppercase">Inventory</span>
          </div>
          <h4 className="mb-1 text-sm font-medium text-[#566166]">Total de Elementos</h4>
          <div className="text-3xl font-extrabold tracking-tight text-[#2a3439]">{inventoryItems.length}</div>
          <div className="mt-2 flex items-center text-[11px] text-[#566166]">Datos persistidos en base de datos</div>
        </div>
      </section>

      <section className="w-full max-w-full min-w-0 overflow-hidden">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[#1A365D]">Grupos de Inventario</h2>
            <p className="text-sm text-[#566166]">Desliza horizontalmente y haz click para cargar Asset Details abajo</p>
          </div>
          <div className="flex items-center gap-2">
            {canManageInventory ? (
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#3a5f94] transition hover:bg-slate-50"
                onClick={createGroup}
                type="button"
              >
                Nuevo grupo
              </button>
            ) : null}
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
              {inventoryGroups.map((group) => {
                const groupCount = countByGroup.get(group.id) ?? 0;
                const badge = getGroupBadge(group);
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
                      <div className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-tight uppercase ${badge.className}`}>
                        {badge.label}
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
          <h3 className="text-xl font-extrabold tracking-tight text-[#1A365D]">Detalles del Grupo</h3>
          {canManageInventory ? (
            <button
              className="material-symbols-outlined text-lg text-[#566166]"
              onClick={createItem}
              type="button"
              title="Nuevo elemento"
            >
              add_circle
            </button>
          ) : (
            <button className="material-symbols-outlined text-lg text-[#566166]">more_vert</button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <h2 className="text-xl font-bold text-[#2a3439]">{selectedGroup?.name ?? "Sin grupo seleccionado"}</h2>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg bg-[#f0f4f7] p-3">
                <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Cantidad de Elementos</p>
                <p className="mt-1 text-xl font-extrabold text-[#2a3439]">{selectedGroupItemCount}</p>
              </div>
              <div className="rounded-lg bg-[#f0f4f7] p-3">
                <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Elementos Defectuosos</p>
                <p className="mt-1 text-xl font-extrabold text-[#9f403d]">{defectiveCount}</p>
              </div>
            </div>
            {canDeleteGroup && selectedGroup ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#566166] hover:bg-slate-50" type="button" onClick={editGroup}>
                  Editar grupo
                </button>
                <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#566166] hover:bg-slate-50" type="button" onClick={deleteGroup}>
                  Eliminar grupo
                </button>
              </div>
            ) : null}
            <p className="mt-2 text-[10px] text-[#566166]">Estos datos ahora vienen desde la base de datos.</p>
          </div>

          <div className="xl:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-[#2a3439]">Lista de Elementos</h4>
              {canManageInventory && selectedGroup ? (
                <button className="rounded-md border border-[#3a5f94] bg-[#3a5f94] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2f4f7a]" type="button" onClick={createItem}>
                  Nuevo elemento
                </button>
              ) : null}
            </div>
            {isLoadingInventory ? (
              <p className="text-xs text-[#566166]">Cargando inventario...</p>
            ) : selectedItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {selectedItems.map((item) => (
                  <div
                    className={`relative overflow-visible rounded-lg border p-3 ${
                      item.defective ? "border-rose-200 bg-rose-50" : "border-transparent bg-[#f0f4f7]/60"
                    }`}
                    key={item.id}
                  >
                    {canManageInventory ? (
                      <button
                        className="absolute top-2 right-2 rounded-full p-1 text-[#566166] transition hover:bg-white hover:text-[#2a3439]"
                        onClick={() => setActiveItemMenuId((current) => (current === item.id ? null : item.id))}
                        type="button"
                        aria-label="Abrir menú de acciones"
                      >
                        <span className="material-symbols-outlined text-lg">more_vert</span>
                      </button>
                    ) : null}

                    {activeItemMenuId === item.id && canManageInventory ? (
                      <div className="absolute top-9 right-2 z-20 w-48 rounded-xl border border-slate-200 bg-white shadow-xl">
                        <button
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#566166] hover:bg-slate-50"
                          onClick={() => {
                            setActiveItemMenuId(null);
                            editItem(item);
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                          Editar
                        </button>
                        <button
                          className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-[#566166] hover:bg-slate-50"
                          onClick={() => {
                            setActiveItemMenuId(null);
                            openDefectiveModal(item);
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-base text-rose-600">{item.defective ? "edit" : "error"}</span>
                          {item.defective ? "Actualizar motivo" : "Marcar como defectuoso"}
                        </button>
                        {item.defective && (
                          <button
                            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-green-600 hover:bg-green-50"
                            onClick={() => {
                              markAsFixed(item);
                            }}
                            type="button"
                          >
                            <span className="material-symbols-outlined text-base">check_circle</span>
                            Marcar como arreglado
                          </button>
                        )}
                        <button
                          className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          onClick={() => {
                            setActiveItemMenuId(null);
                            deleteItem(item);
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                          Eliminar
                        </button>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2 pr-8">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${item.defective ? "bg-rose-100 text-rose-700" : "bg-[#e8eff3] text-[#3a5f94]"}`}>
                        <span className="material-symbols-outlined text-base">{item.defective ? "warning" : (selectedGroup?.icon ?? item.groupIcon)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-xs font-bold text-[#2a3439]">{item.name}</p>
                          <p className="inline-flex shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#566166] shadow-sm">
                            {item.code}
                          </p>
                        </div>
                        {item.defective ? (
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-700">
                            <span className="material-symbols-outlined text-sm">error</span>
                            Defectuoso
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {(() => {
                      const isHdmiGroup = isHdmiGroupName(item.groupName);
                      const isTelevisionGroup = isTelevisionGroupName(item.groupName);
                      const linkedHdmi = isTelevisionGroup && item.hdmiItemId ? inventoryItemsById.get(item.hdmiItemId) ?? null : null;
                      const linkedTelevision = isHdmiGroup ? televisionByHdmiId.get(item.id) ?? null : null;
                      const effectiveStatus = item.defective
                        ? "Defectuoso"
                        : isHdmiGroup
                          ? linkedTelevision
                            ? "Asignado"
                            : "Disponible"
                          : item.status;

                      return (
                        <>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pr-8">
                            <p className="text-xs font-semibold text-[#2a3439]">{item.room}</p>
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  item.defective
                                    ? "bg-rose-100 text-rose-700"
                                    : effectiveStatus === "Fijo"
                                      ? "bg-[#d9d7f8]/40 text-[#5d5d78]"
                                      : effectiveStatus === "Asignado"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-[#d5e3ff] text-[#2c5287]"
                                }`}
                              >
                                {effectiveStatus}
                              </span>
                            </div>
                          </div>

                          {typeof item.price === "number" ? (
                            <p className="mt-2 text-xs font-semibold text-[#2a3439]">Precio: {formatCurrencyCOP(item.price)}</p>
                          ) : null}

                          {isTelevisionGroup && item.hdmiItemId ? (
                            <p className="mt-2 rounded-lg bg-white/80 px-2 py-1 text-[10px] text-[#2c5287]">
                              <span className="font-bold">HDMI enlazado:</span>{" "}
                              {linkedHdmi ? `${linkedHdmi.name} — ${linkedHdmi.code} · ${linkedHdmi.room}` : "Asignado"}
                            </p>
                          ) : isHdmiGroup && linkedTelevision ? (
                            <p className="mt-2 rounded-lg bg-white/80 px-2 py-1 text-[10px] text-emerald-700">
                              <span className="font-bold">Televisor enlazado:</span> {linkedTelevision.name} · {linkedTelevision.room}
                            </p>
                          ) : null}
                        </>
                      );
                    })()}

                    {item.defective && item.motivo ? (
                      <p className="mt-2 rounded-lg bg-white/80 px-2 py-1 text-[10px] text-rose-700">
                        <span className="font-bold">Motivo:</span> {item.motivo}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#566166]">No hay elementos para este grupo.</p>
            )}
          </div>
        </div>
      </section>

      {activeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <form className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.2)] max-h-[90vh] overflow-hidden flex flex-col" onSubmit={submitInventoryModal}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 shrink-0">
              <div>
                <p className="text-[10px] font-bold tracking-[0.3em] text-[#3a5f94] uppercase">
                  {activeModal.kind === "group"
                    ? activeModal.mode === "create"
                      ? "Nuevo grupo"
                      : "Editar grupo"
                    : activeModal.kind === "item"
                      ? activeModal.mode === "create"
                        ? "Nuevo elemento"
                        : "Editar elemento"
                      : activeModal.kind === "defective-item"
                        ? "Marcar como defectuoso"
                      : activeModal.kind === "delete-group"
                        ? "Eliminar grupo"
                        : "Eliminar elemento"}
                </p>
                <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-[#1A365D]">
                  {activeModal.kind === "group"
                    ? activeModal.mode === "create"
                      ? "Crear un grupo de inventario"
                      : "Actualizar grupo de inventario"
                    : activeModal.kind === "item"
                      ? activeModal.mode === "create"
                        ? "Registrar un nuevo elemento"
                        : "Actualizar elemento"
                      : activeModal.kind === "defective-item"
                        ? "Registrar motivo del defecto"
                      : activeModal.kind === "delete-group"
                        ? "Confirmar eliminación"
                        : "Confirmar eliminación"}
                </h3>
              </div>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                onClick={closeModal}
                type="button"
                aria-label="Cerrar modal"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-5 px-6 py-5">
                {modalError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{modalError}</div> : null}

                {activeModal.kind === "group" ? (
                <>
                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="inventory-group-name">
                      Nombre del grupo
                    </label>
                    <input
                      id="inventory-group-name"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                      onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Por ejemplo: Audio, Laboratorio, Red"
                      value={groupForm.name}
                    />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold tracking-widest text-[#566166] uppercase">Catálogo de iconos</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {INVENTORY_ICON_OPTIONS.map((option) => {
                        const isSelected = groupForm.icon === option.value;
                        return (
                          <button
                            className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${
                              isSelected
                                ? "border-[#3a5f94] bg-[#d5e3ff]/30 text-[#1A365D]"
                                : "border-slate-200 bg-white text-[#566166] hover:border-slate-300 hover:bg-slate-50"
                            }`}
                            key={option.value}
                            onClick={() => setGroupForm((current) => ({ ...current, icon: option.value }))}
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[20px]">{option.value}</span>
                            <span className="text-xs font-semibold">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#f0f4f7] p-4">
                    <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Vista previa</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#3a5f94] shadow-sm">
                        <span className="material-symbols-outlined text-[24px]">{groupForm.icon}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#2a3439]">{groupForm.name.trim() || modalGroup?.name || "Nuevo grupo"}</p>
                        <p className="text-xs text-[#566166]">El icono seleccionado se verá en la tarjeta del grupo.</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : activeModal.kind === "defective-item" ? (
                <>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                    <p className="font-bold">{inventoryItems.find((item) => item.id === activeModal.itemId)?.name ?? "Este elemento"}</p>
                    <p className="mt-1">Indica por qué el elemento está defectuoso para dejarlo registrado.</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="inventory-defective-reason">
                      Motivo
                    </label>
                    <textarea
                      id="inventory-defective-reason"
                      className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                      onChange={(event) => setDefectiveReason(event.target.value)}
                      placeholder="Describe la falla, daño o problema detectado"
                      value={defectiveReason}
                    />
                  </div>
                </>
              ) : activeModal.kind === "item" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="inventory-item-group">
                        Grupo
                      </label>
                      <select
                        id="inventory-item-group"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                        onChange={(event) => setItemForm((current) => ({ ...current, groupId: event.target.value }))}
                        value={itemForm.groupId}
                      >
                        {inventoryGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="inventory-item-status">
                        Estado
                      </label>
                      <select
                        id="inventory-item-status"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                        onChange={(event) =>
                          setItemForm((current) => ({
                            ...current,
                            status: normalizeStatus(event.target.value),
                          }))
                        }
                        value={itemForm.status}
                      >
                        <option value="Disponible">Disponible</option>
                        <option value="Fijo">Fijo</option>
                        <option value="Asignado">Asignado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="inventory-item-name">
                        Nombre
                      </label>
                      <input
                        id="inventory-item-name"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                        onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Nombre del elemento"
                        value={itemForm.name}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="inventory-item-code">
                        Código
                      </label>
                      <input
                        id="inventory-item-code"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                        onChange={(event) => setItemForm((current) => ({ ...current, code: event.target.value }))}
                        placeholder="Código de inventario"
                        value={itemForm.code}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="inventory-item-room">
                        Lugar
                      </label>
                      <select
                        id="inventory-item-room"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                        onChange={(event) => setItemForm((current) => ({ ...current, room: event.target.value }))}
                        value={itemForm.room}
                      >
                        <option value="">Selecciona un salón del sistema</option>
                        {roomOptions.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="inventory-item-price">
                        Precio (COP)
                      </label>
                      <input
                        id="inventory-item-price"
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                        onChange={(event) => setItemForm((current) => ({ ...current, price: event.target.value ? Number(event.target.value) : null }))}
                        placeholder="Ej. 50000"
                        value={itemForm.price ?? ""}
                      />
                    </div>
                  </div>

                  {(() => {
                    const groupName = inventoryGroups.find((group) => group.id === itemForm.groupId)?.name.trim().toLowerCase() ?? "";
                    const isHdmiGroup = isHdmiGroupName(groupName);

                    if (isHdmiGroup) {
                      const linkedTelevision = modalItem?.id ? televisionByHdmiId.get(modalItem.id) ?? null : null;

                      return (
                        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-800">
                          <p className="text-[10px] font-bold tracking-widest text-sky-600 uppercase">Relación lógica</p>
                          <p className="mt-1 font-semibold">Televisor enlazado</p>
                          <p className="mt-1 text-sm">
                            {linkedTelevision ? `${linkedTelevision.name} · ${linkedTelevision.room}` : "Este HDMI no tiene un televisor enlazado."}
                          </p>
                        </div>
                      );
                    }

                    const isTV = isTelevisionGroupName(groupName);

                    if (!isTV) return null;

                    const filteredHdmis = hdmiItems.filter((h) => {
                      const query = hdmiSearchQuery.toLowerCase();
                      return (
                        h.name.toLowerCase().includes(query) ||
                        h.code.toLowerCase().includes(query) ||
                        h.room.toLowerCase().includes(query)
                      );
                    });
                    const normalizedHdmiQuery = hdmiSearchQuery.trim().toLowerCase();
                    const exactHdmiMatch = normalizedHdmiQuery.length > 0 && hdmiItems.some((h) => {
                      const name = h.name.trim().toLowerCase();
                      const code = h.code.trim().toLowerCase();
                      const room = h.room.trim().toLowerCase();
                      return name === normalizedHdmiQuery || code === normalizedHdmiQuery || room === normalizedHdmiQuery;
                    });

                    const selectedHdmi = itemForm.hdmiItemId ? inventoryItems.find((h) => h.id === itemForm.hdmiItemId) : null;
                    const fallbackHdmiText = hdmiAssignedLabel || (itemForm.hdmiItemId ? "HDMI asignado" : "Sin HDMI asignado");
                    const hasExistingHdmi = Boolean(selectedHdmi || fallbackHdmiText !== "Sin HDMI asignado");
                    const canOfferCreateHdmi = !selectedHdmi && normalizedHdmiQuery.length > 0 && !exactHdmiMatch;
                    const shouldShowHdmiSelector = showHdmiSelector || !hasExistingHdmi;

                    return (
                      <div>
                        <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase">
                          Cable HDMI asignado
                        </label>
                        <div className="mb-2 flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                          <p className="text-[11px] font-semibold text-emerald-700">
                            Asignado: {selectedHdmi ? `${selectedHdmi.name} — ${selectedHdmi.code}` : fallbackHdmiText}
                          </p>
                        </div>

                        {shouldShowHdmiSelector ? (
                          <div className="relative">
                            <input
                              type="text"
                              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                              placeholder="Buscar HDMI por nombre, código o salón..."
                              value={showHdmiSelector ? hdmiSearchQuery : (selectedHdmi ? `${selectedHdmi.name} — ${selectedHdmi.code}` : hdmiSearchQuery || hdmiAssignedLabel)}
                              onChange={(e) => {
                                if (selectedHdmi) {
                                  setItemForm((current) => ({ ...current, hdmiItemId: null }));
                                }
                                setHdmiAssignedLabel("");
                                setHdmiSearchQuery(e.target.value);
                              }}
                              onFocus={() => {
                                if (!hasExistingHdmi) {
                                  setHdmiSearchQuery("");
                                }
                              }}
                            />

                            {hdmiSearchQuery && (
                              <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                                {filteredHdmis.length > 0 ? (
                                  <>
                                    {filteredHdmis.map((h) => (
                                      <button
                                        key={h.id}
                                        type="button"
                                        className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                                        onClick={() => {
                                          setItemForm((current) => ({ ...current, hdmiItemId: h.id, hdmiAssigned: true }));
                                          setHdmiAssignedLabel(`${h.name} — ${h.code}`);
                                          setHdmiSearchQuery("");
                                          setShowHdmiSelector(false);
                                        }}
                                      >
                                        <p className="text-xs font-bold text-[#2a3439]">{h.name}</p>
                                        <p className="text-[10px] text-[#566166]">{h.code} • {h.room}</p>
                                      </button>
                                    ))}
                                    {canOfferCreateHdmi && (
                                      <button
                                        type="button"
                                        className="w-full px-4 py-3 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50"
                                        onClick={() => {
                                          setShowCreateHdmiModal(true);
                                          setNewHdmiForm({ name: `HDMI de ${itemForm.name}`, price: "", code: "" });
                                        }}
                                      >
                                        + Crear nuevo HDMI: "{hdmiSearchQuery}"
                                      </button>
                                    )}
                                  </>
                                ) : canOfferCreateHdmi ? (
                                  <button
                                    type="button"
                                    className="w-full px-4 py-3 text-left text-xs font-semibold text-blue-600 hover:bg-blue-50"
                                    onClick={() => {
                                      setShowCreateHdmiModal(true);
                                      setNewHdmiForm({ name: `HDMI de ${itemForm.name}`, price: "", code: "" });
                                    }}
                                  >
                                    + Crear nuevo HDMI: "{hdmiSearchQuery}"
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="mt-1 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#3a5f94] transition hover:bg-slate-50"
                            onClick={() => {
                              setHdmiSearchQuery("");
                              setHdmiAssignedLabel("");
                              setShowHdmiSelector(true);
                            }}
                          >
                            Cambiar HDMI asignado
                          </button>
                        )}

                        {selectedHdmi && shouldShowHdmiSelector && (
                          <p className="mt-1 text-xs font-semibold text-emerald-600">✓ {selectedHdmi.name} seleccionado</p>
                        )}
                      </div>
                    );
                  })()}

                  <div className="rounded-2xl bg-[#f0f4f7] p-4 text-sm text-[#566166]">
                    <p className="font-bold text-[#2a3439]">Resumen</p>
                    <p className="mt-1">El elemento quedará vinculado al grupo seleccionado y reflejará su estado en la lista principal.</p>
                  </div>
                </>
              ) : activeModal.kind === "delete-group" ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-bold">{modalDeleteGroup?.name ?? "Este grupo"}</p>
                  <p className="mt-1">Se eliminará el grupo y todos los elementos asociados.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <p className="font-bold">{modalDeleteItem?.name ?? "Este elemento"}</p>
                  <p className="mt-1">Esta acción elimina el elemento del inventario de forma permanente.</p>
                </div>
              )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end shrink-0">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-[#566166] transition hover:bg-slate-50"
                onClick={closeModal}
                type="button"
              >
                Cancelar
              </button>
              <button
                className={`rounded-2xl px-5 py-3 text-sm font-bold text-white transition ${
                  activeModal.kind === "delete-group" || activeModal.kind === "delete-item"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-[#3a5f94] hover:bg-[#2f4f7a]"
                } disabled:cursor-not-allowed disabled:opacity-70`}
                disabled={isModalSubmitting}
                type="submit"
              >
                {isModalSubmitting
                  ? "Procesando..."
                  : activeModal.kind === "group"
                    ? activeModal.mode === "create"
                      ? "Crear grupo"
                      : "Guardar cambios"
                    : activeModal.kind === "defective-item"
                      ? "Guardar motivo"
                    : activeModal.kind === "item"
                      ? activeModal.mode === "create"
                        ? "Crear elemento"
                        : "Guardar cambios"
                      : activeModal.kind === "delete-group"
                        ? "Eliminar grupo"
                        : "Eliminar elemento"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showCreateHdmiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <form
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.2)]"
            onSubmit={async (e) => {
              e.preventDefault();
              setIsModalSubmitting(true);
              try {
                const hdmiGroupId = inventoryGroups.find((group) => group.name.toLowerCase().includes("hdmi") || group.name.toLowerCase().includes("cable"))?.id;
                if (!hdmiGroupId) {
                  throw new Error("No se encontró grupo para HDMIs. Verifica que exista un grupo 'Cables HDMI'.");
                }

                const normalizedName = newHdmiForm.name.trim().toLowerCase();
                const normalizedCode = newHdmiForm.code.trim().toLowerCase();
                const duplicateHdmi = inventoryItems.find((item) => {
                  if (item.groupName !== "Cables HDMI") return false;
                  return item.name.trim().toLowerCase() === normalizedName || item.code.trim().toLowerCase() === normalizedCode;
                });

                if (duplicateHdmi) {
                  throw new Error(`Ese HDMI ya existe: ${duplicateHdmi.name} (${duplicateHdmi.code}).`);
                }

                const response = await fetchApiJson<{ id: string }>("/api/inventory/items", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    groupId: hdmiGroupId,
                    name: newHdmiForm.name,
                    code: newHdmiForm.code,
                    room: "Monitoría",
                    status: "Disponible",
                    defective: false,
                    motivo: null,
                    price: newHdmiForm.price ? Number(newHdmiForm.price) : null,
                    hdmiAssigned: false,
                    hdmiItemId: null,
                  }),
                });

                await loadInventory();
                setItemForm((current) => ({ ...current, hdmiItemId: response.id, hdmiAssigned: true }));
                setShowCreateHdmiModal(false);
                setNewHdmiForm({ name: "", price: "", code: "" });
                setHdmiSearchQuery("");
                setHdmiAssignedLabel(`HDMI de ${itemForm.name}`);
              } catch (error) {
                setModalError(error instanceof Error ? error.message : "Error al crear HDMI.");
              } finally {
                setIsModalSubmitting(false);
              }
            }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold tracking-[0.3em] text-[#3a5f94] uppercase">Nuevo Cable HDMI</p>
                <h3 className="mt-1 text-xl font-extrabold tracking-tight text-[#1A365D]">Registrar Cable HDMI</h3>
              </div>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                onClick={() => {
                  setShowCreateHdmiModal(false);
                  setNewHdmiForm({ name: "", price: "", code: "" });
                }}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div>
                <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="new-hdmi-name">
                  Nombre
                </label>
                <input
                  id="new-hdmi-name"
                  type="text"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                  onChange={(e) => setNewHdmiForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Cable HDMI Estándar"
                  value={newHdmiForm.name}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="new-hdmi-code">
                  Código
                </label>
                <input
                  id="new-hdmi-code"
                  type="text"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                  onChange={(e) => setNewHdmiForm((current) => ({ ...current, code: e.target.value }))}
                  placeholder="Ej. 0001"
                  value={newHdmiForm.code}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold tracking-widest text-[#566166] uppercase" htmlFor="new-hdmi-price">
                  Precio (COP)
                </label>
                <input
                  id="new-hdmi-price"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-[#2a3439] outline-none transition focus:border-[#3a5f94]"
                  onChange={(e) => setNewHdmiForm((current) => ({ ...current, price: e.target.value }))}
                  placeholder="Ej. 50000"
                  value={newHdmiForm.price}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
              <button
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-[#566166] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  setShowCreateHdmiModal(false);
                  setNewHdmiForm({ name: "", price: "", code: "" });
                }}
                type="button"
                disabled={isModalSubmitting}
              >
                Cancelar
              </button>
              <button
                className="rounded-2xl bg-[#3a5f94] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2f4f7a] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isModalSubmitting}
                type="submit"
              >
                {isModalSubmitting ? "Creando HDMI..." : "Crear HDMI"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
