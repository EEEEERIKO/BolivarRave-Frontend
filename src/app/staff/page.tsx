/* eslint-disable @next/next/no-img-element */
"use client";

import { fetchApiJson } from "@/lib/api-client";
import { useEffect, useMemo, useState } from "react";

type StaffView = "directory" | "schedule";
type ContractPlan = "Plan 1" | "Plan 2" | "Plan 3" | "Plan Monitoria" | "Plan Especial";
type WeekDay = "Lunes" | "Martes" | "Miercoles" | "Jueves" | "Viernes" | "Sabado";

type UnavailableClassSlot = {
  id: string;
  day: WeekDay;
  startTime: string;
  endTime: string;
};

type StaffEstado = "Active" | "Inactive";

type StaffApi = {
  id: string;
  numeroStaff: number;
  rol: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  telefono: string;
  fechaNacimiento: string;
  carrera: string;
  tipoContrato: ContractPlan;
  conocimientoSonido: boolean;
  estado: StaffEstado;
  balanceHoras: number;
  bloqueosClase: Array<{
    id: string;
    diaSemana: string;
    horaInicio: string;
    horaFin: string;
  }>;
};

type ScheduleRow = {
  id: string;
  name: string;
  role: string;
  staffNumber: number;
  shiftLabel: string;
  shiftLeft: string;
  shiftRight: string;
  note?: string;
};

const HOURS = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

const WEEK_DAYS: WeekDay[] = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

const SCHEDULE_ROWS: ScheduleRow[] = [
  {
    id: "aris",
    name: "Dr. Aris Thorne",
    role: "Research Lead • Fl 4",
    staffNumber: 1,
    shiftLabel: "Working Shift (08:00 - 16:00)",
    shiftLeft: "left-[12.5%]",
    shiftRight: "right-[37.5%]",
    note: "Academic Unavailability 06:00 - 08:00",
  },
  {
    id: "julian",
    name: "Julian Vane",
    role: "Security Supervisor • Fl 1",
    staffNumber: 2,
    shiftLabel: "Security Patrol (10:00 - 18:00)",
    shiftLeft: "left-[25%]",
    shiftRight: "right-[12.5%]",
  },
  {
    id: "elena",
    name: "Elena Rossi",
    role: "Lab Technician • Fl 3",
    staffNumber: 3,
    shiftLabel: "Evening Shift (13:00 - 22:00)",
    shiftLeft: "left-[43.75%]",
    shiftRight: "right-[0%]",
  },
  {
    id: "kent",
    name: "Officer Kent",
    role: "Gate Security • Fl G",
    staffNumber: 4,
    shiftLabel: "Morning Watch (06:00 - 12:00)",
    shiftLeft: "left-[0%]",
    shiftRight: "right-[62.5%]",
    note: "Coverage gap after 20:00",
  },
];

function StaffScheduleBoard() {
  const hourCells = useMemo(
    () => HOURS.map((hour) => <div key={hour} className="p-4 text-center text-[10px] font-bold text-[#566166]">{hour}</div>),
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#2a3439]">Staff Master Weekly Schedule</h2>
          <p className="mt-1 text-sm text-[#566166]">Academic Week 34 • Central Facility Coverage</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg bg-[#f0f4f7] p-1">
            <button className="rounded-md bg-white px-4 py-1.5 text-xs font-bold text-[#3a5f94] shadow-sm">Week</button>
            <button className="rounded-md px-4 py-1.5 text-xs font-medium text-[#566166]">Month</button>
          </div>
          <button className="rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white">Assign Shift</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Active Staff</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#2a3439]">42</span>
            <span className="text-xs font-bold text-[#3a5f94]">/ 48 Total</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Coverage Gap</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#9f403d]">2h</span>
            <span className="text-xs font-medium text-[#566166]">Tonight (Floor 2)</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">On Break</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#2a3439]">6</span>
            <span className="text-xs font-medium text-[#566166]">Currently</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-bold tracking-widest text-[#566166] uppercase">Total Hours</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#2a3439]">1,840</span>
            <span className="text-xs font-medium text-[#566166]">This Week</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex border-b border-slate-200">
          <div className="flex w-64 shrink-0 items-center gap-2 border-r border-slate-200 bg-[#f0f4f7] p-4 text-xs font-bold tracking-wider text-[#2a3439] uppercase">
            <span className="material-symbols-outlined text-sm">badge</span>
            Staff Member
          </div>
          <div className="flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="grid min-w-[1120px] bg-[#f0f4f7] divide-x divide-slate-200" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
              {hourCells}
            </div>
          </div>
        </div>

        <div className="max-h-[600px] divide-y divide-slate-200 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {SCHEDULE_ROWS.map((row) => (
            <div className="flex" key={row.id}>
              <div className="flex w-64 shrink-0 items-center gap-3 border-r border-slate-200 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8eff3] text-xs font-black text-[#375c91]">
                  N.{row.staffNumber}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2a3439]">{row.name}</p>
                  <p className="text-[10px] text-[#566166]">{row.role}</p>
                </div>
              </div>

              <div className="relative flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="relative grid min-h-[74px] min-w-[1120px] divide-x divide-slate-200/60" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
                  {HOURS.map((hour) => (
                    <div key={`${row.id}-${hour}`} className="h-full" />
                  ))}

                  <div className={`absolute inset-y-2 ${row.shiftLeft} ${row.shiftRight} flex items-center rounded-r-md border-l-4 border-[#3a5f94] bg-[#3a5f94]/10 px-4`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="h-2 w-2 shrink-0 rounded-full bg-[#3a5f94]" />
                      <span className="truncate text-[10px] font-bold text-[#3a5f94]">{row.shiftLabel}</span>
                    </div>
                  </div>

                  {row.note ? (
                    <div className="absolute top-2 right-3 rounded-md bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700">{row.note}</div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const [view, setView] = useState<StaffView>("directory");
  const [showAddStaffForm, setShowAddStaffForm] = useState(false);
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffApi[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [unavailableClassSlots, setUnavailableClassSlots] = useState<UnavailableClassSlot[]>([
    { id: "slot-1", day: "Lunes", startTime: "", endTime: "" },
  ]);
  const [newStaff, setNewStaff] = useState({
    staffNumber: "",
    citizenshipId: "",
    firstName: "",
    lastName: "",
    major: "",
    phone: "",
    contractPlan: "Plan 1" as ContractPlan,
    birthDate: "",
    hasSoundKnowledge: false,
    role: "",
  });
  const isOnShift = true;
  const balanceHours = 4;
  const formattedBalanceHours = `${balanceHours > 0 ? "+" : ""}${balanceHours} hours`;

  const selectedStaff = useMemo(() => {
    if (staffList.length === 0) return null;
    if (!selectedStaffId) return staffList[0] ?? null;
    return staffList.find((staff) => staff.id === selectedStaffId) ?? staffList[0] ?? null;
  }, [selectedStaffId, staffList]);

  const selectedStaffBalanceHours = selectedStaff?.balanceHoras ?? 0;
  const selectedStaffFormattedBalanceHours = `${selectedStaffBalanceHours > 0 ? "+" : ""}${selectedStaffBalanceHours} hours`;

  const loadStaff = async () => {
    try {
      setIsLoadingStaff(true);
      setStaffError(null);

      const response = await fetchApiJson<{ staff?: StaffApi[] }>("/api/staff", {
        cache: "no-store",
      });

      const nextStaff = Array.isArray(response.staff) ? response.staff : [];
      setStaffList(nextStaff);

      if (nextStaff.length > 0) {
        setSelectedStaffId((prev) => prev ?? nextStaff[0]?.id ?? null);
      } else {
        setSelectedStaffId(null);
      }
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "No se pudo cargar el staff.");
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    void loadStaff();
  }, []);

  async function handleAddStaffSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const parsedNumber = Number(newStaff.staffNumber);
      const parsedBalance = Number.isFinite(balanceHours) ? balanceHours : 0;

      const bloqueosClase = unavailableClassSlots
        .filter((slot) => slot.startTime && slot.endTime)
        .map((slot) => ({
          diaSemana: slot.day,
          horaInicio: slot.startTime,
          horaFin: slot.endTime,
        }));

      await fetchApiJson<{ message: string; staffId: string }>("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroStaff: parsedNumber,
          rol: newStaff.role,
          nombres: newStaff.firstName,
          apellidos: newStaff.lastName,
          cedula: newStaff.citizenshipId,
          telefono: newStaff.phone,
          fechaNacimiento: newStaff.birthDate,
          carrera: newStaff.major || "Sin carrera",
          tipoContrato: newStaff.contractPlan,
          conocimientoSonido: newStaff.hasSoundKnowledge,
          estado: "Active",
          balanceHoras: parsedBalance,
          bloqueosClase,
        }),
      });

      setFormFeedback("Staff creado correctamente.");
      setShowAddStaffForm(false);
      setNewStaff({
        staffNumber: "",
        citizenshipId: "",
        firstName: "",
        lastName: "",
        major: "",
        phone: "",
        contractPlan: "Plan 1",
        birthDate: "",
        hasSoundKnowledge: false,
        role: "",
      });
      setUnavailableClassSlots([]);
      await loadStaff();
    } catch (error) {
      setFormFeedback(error instanceof Error ? error.message : "No se pudo guardar el staff.");
    }
  }

  function addUnavailableClassSlot() {
    setUnavailableClassSlots((prev) => [
      ...prev,
      { id: `slot-${Date.now()}-${prev.length + 1}`, day: "Lunes", startTime: "", endTime: "" },
    ]);
  }

  function removeUnavailableClassSlot(slotId: string) {
    setUnavailableClassSlots((prev) => prev.filter((slot) => slot.id !== slotId));
  }

  function updateUnavailableClassSlot(slotId: string, field: "day" | "startTime" | "endTime", value: string) {
    setUnavailableClassSlots((prev) =>
      prev.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)),
    );
  }

  return (
    <div className="p-8">
      {formFeedback ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {formFeedback}
        </div>
      ) : null}

      {showAddStaffForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-[#2a3439]">Nuevo Staff</h3>
                <p className="text-xs text-[#566166]">Formulario simbolico (sin integracion a backend)</p>
              </div>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-[#566166] hover:bg-slate-50"
                onClick={() => setShowAddStaffForm(false)}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleAddStaffSubmit}>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Numero de Staff</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, staffNumber: event.target.value }))}
                  placeholder="Ej: 5"
                  required
                  type="text"
                  value={newStaff.staffNumber}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Rol</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, role: event.target.value }))}
                  placeholder="Ej: Auxiliar de Biblioteca"
                  required
                  type="text"
                  value={newStaff.role}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Nombres</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, firstName: event.target.value }))}
                  placeholder="Ej: Juan Carlos"
                  required
                  type="text"
                  value={newStaff.firstName}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Cedula de Ciudadania</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, citizenshipId: event.target.value }))}
                  placeholder="Ej: 1032485901"
                  required
                  type="text"
                  value={newStaff.citizenshipId}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Apellidos</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Ej: Rodriguez Mendoza"
                  required
                  type="text"
                  value={newStaff.lastName}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Carrera</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, major: event.target.value }))}
                  placeholder="Ej: Ingenieria de Sistemas"
                  type="text"
                  value={newStaff.major}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Numero de Telefono</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Ej: +57 300 000 0000"
                  required
                  type="tel"
                  value={newStaff.phone}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Fecha de Nacimiento</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, birthDate: event.target.value }))}
                  required
                  type="date"
                  value={newStaff.birthDate}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold text-slate-500">Tipo de Contrato</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, contractPlan: event.target.value as ContractPlan }))}
                  value={newStaff.contractPlan}
                >
                  <option value="Plan 1">Plan 1</option>
                  <option value="Plan 2">Plan 2</option>
                  <option value="Plan 3">Plan 3</option>
                  <option value="Plan Monitoria">Plan Monitoria</option>
                  <option value="Plan Especial">Plan Especial</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">Horas de Clase (No Disponible)</label>
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-bold text-[#566166]"
                    onClick={addUnavailableClassSlot}
                    type="button"
                  >
                    + Agregar bloque
                  </button>
                </div>

                {unavailableClassSlots.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-[#566166]">
                    Sin horarios de clase cargados. Este campo es opcional.
                  </p>
                ) : (
                  unavailableClassSlots.map((slot, index) => (
                    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[1fr_1fr_1fr_auto]" key={slot.id}>
                      <select
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateUnavailableClassSlot(slot.id, "day", event.target.value)}
                        value={slot.day}
                      >
                        {WEEK_DAYS.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>

                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateUnavailableClassSlot(slot.id, "startTime", event.target.value)}
                        type="time"
                        value={slot.startTime}
                      />

                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        onChange={(event) => updateUnavailableClassSlot(slot.id, "endTime", event.target.value)}
                        type="time"
                        value={slot.endTime}
                      />

                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-[#9f403d]"
                        onClick={() => removeUnavailableClassSlot(slot.id)}
                        type="button"
                      >
                        Quitar
                      </button>

                      <p className="text-[10px] text-[#566166] md:col-span-4">Bloque {index + 1}: horario no disponible por clase</p>
                    </div>
                  ))
                )}
              </div>

              <label className="md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#2a3439]">
                <input
                  checked={newStaff.hasSoundKnowledge}
                  className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]"
                  onChange={(event) => setNewStaff((prev) => ({ ...prev, hasSoundKnowledge: event.target.checked }))}
                  type="checkbox"
                />
                Tiene conocimientos de manejo de sonido
              </label>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-[#566166]"
                  onClick={() => setShowAddStaffForm(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white" type="submit">
                  Guardar (Demo)
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 w-fit">
        <button
          className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            view === "directory" ? "bg-[#3a5f94] text-white" : "text-[#566166] hover:bg-slate-100"
          }`}
          onClick={() => setView("directory")}
          type="button"
        >
          Staff Directory
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
            view === "schedule" ? "bg-[#3a5f94] text-white" : "text-[#566166] hover:bg-slate-100"
          }`}
          onClick={() => setView("schedule")}
          type="button"
        >
          Horario Maestro
        </button>
      </div>

      {view === "schedule" ? (
        <StaffScheduleBoard />
      ) : (
        <main className="flex min-h-[calc(100vh-7rem)] gap-8 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="tracking-tight text-2xl font-extrabold text-[#2a3439]">Staff Directory</h2>
              <p className="text-sm text-[#566166]">Managing {staffList.length} active academic personnel</p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 rounded-lg bg-[#d9e4ea] px-4 py-2 text-xs font-bold text-[#2a3439]">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                Filter
              </button>
              <button
                className="flex items-center gap-2 rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white shadow-sm"
                onClick={() => setShowAddStaffForm(true)}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Add Staff
              </button>
            </div>
          </div>

          {staffError ? <p className="text-sm font-medium text-[#9f403d]">{staffError}</p> : null}

          <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:grid-cols-2">
            {isLoadingStaff ? (
              <p className="text-sm text-[#566166]">Cargando staff...</p>
            ) : staffList.length === 0 ? (
              <p className="text-sm text-[#566166]">No hay staff registrado aun.</p>
            ) : (
              staffList.map((staff) => {
                const isActiveCard = selectedStaff?.id === staff.id;
                return (
                  <button
                    className={`flex items-center gap-4 rounded-xl bg-white p-5 text-left transition-all ${
                      isActiveCard
                        ? "border-2 border-[#3a5f94] shadow-xl ring-4 ring-[#3a5f94]/5"
                        : "border border-slate-200 shadow-sm hover:shadow-md"
                    }`}
                    key={staff.id}
                    onClick={() => setSelectedStaffId(staff.id)}
                    type="button"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#e8eff3] text-sm font-black text-[#375c91]">
                      N.{staff.numeroStaff}
                    </div>
                    <div className="flex-1">
                      <h3 className="leading-tight font-bold text-[#2a3439]">{staff.nombres}</h3>
                      <p className="text-xs text-[#566166]">ID: {staff.cedula}</p>
                      <p className="mt-1 text-xs font-semibold text-[#566166]">{staff.rol}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${
                          staff.estado === "Active" ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-400"
                        }`}
                      >
                        {staff.estado === "Active" ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="rounded-2xl bg-[#e8eff3] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-black text-[#153f73]">
                <span className="material-symbols-outlined">assignment</span>
                Assigned Tasks: {selectedStaff?.nombres ?? "Staff"}
              </h3>
              <span className="text-xs font-bold text-[#566166]">4 Tasks Pending</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm">
                <input checked className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]" type="checkbox" readOnly />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#566166] line-through">Clean Hallway 3 (North Wing)</p>
                  <p className="text-[10px] text-slate-400">Completed at 08:30 AM</p>
                </div>
                <span className="material-symbols-outlined text-lg text-green-500">check_circle</span>
              </div>

              <div className="flex items-center gap-4 rounded-xl border-l-4 border-amber-400 bg-white p-4 shadow-sm">
                <input className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]" type="checkbox" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#2a3439]">Set up Room 101 (AV Rack)</p>
                  <p className="text-[10px] text-[#566166]">Priority: High • Due by 11:00 AM</p>
                </div>
                <span className="material-symbols-outlined text-lg text-amber-500">schedule</span>
              </div>

              <div className="flex items-center gap-4 rounded-xl border-l-4 border-slate-200 bg-white p-4 shadow-sm">
                <input className="rounded border-slate-300 text-[#3a5f94] focus:ring-[#3a5f94]" type="checkbox" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#2a3439]">Deliver Projector to Room 302</p>
                  <p className="text-[10px] text-[#566166]">Scheduled for 1:30 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-[450px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl">
          <div className="flex flex-col items-center gap-3 border-b border-slate-200 bg-[#f0f4f7] p-6">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#d5e3ff] text-2xl font-black text-[#153f73] shadow-lg">
                N.{selectedStaff?.numeroStaff ?? 1}
              </div>
              <span className="absolute right-0 bottom-0 h-6 w-6 rounded-full border-4 border-white bg-green-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-[#2a3439]">{selectedStaff?.nombres ?? "Sin staff"}</h2>
              <p className="text-sm font-medium text-[#566166]">
                {selectedStaff?.apellidos ?? "Sin staff seleccionado"}
              </p>
            </div>
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                <p className={`text-lg font-black ${selectedStaff?.estado === "Active" ? "text-green-600" : "text-slate-500"}`}>
                  {selectedStaff?.estado === "Active" ? "Active" : "Off Shift"}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-black text-slate-400 uppercase">Balance Hours</p>
                <p className={`text-lg font-black ${selectedStaffBalanceHours >= 0 ? "text-green-600" : "text-[#9f403d]"}`}>
                  {selectedStaffFormattedBalanceHours}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto p-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <section>
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                General Information
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">National ID (Cedula)</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.cedula ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Numero de Telefono</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.telefono ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Contrato</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.tipoContrato ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha de Nacimiento</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.fechaNacimiento ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Carrera</label>
                  <p className="text-sm font-semibold text-[#2a3439]">{selectedStaff?.carrera ?? "-"}</p>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-[#f0f4f7] p-3">
                  <span className="material-symbols-outlined text-[#3a5f94]">speaker_group</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#2a3439]">Manejo de Sonido</p>
                    <p className="text-[10px] text-[#566166]">{selectedStaff?.conocimientoSonido ? "Si" : "No"}</p>
                  </div>
                  <div className={`relative flex h-6 w-10 items-center rounded-full px-1 ${selectedStaff?.conocimientoSonido ? "bg-[#3a5f94]" : "bg-slate-400"}`}>
                    <div className={`h-4 w-4 rounded-full bg-white ${selectedStaff?.conocimientoSonido ? "ml-auto" : "mr-auto"}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Extra Notes</label>
                  <p className="text-xs leading-relaxed text-[#566166]">
                    Available for late-night event setups. Preferred contact via campus radio channel 4.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                Academic Unavailability
              </h4>
              <div className="grid h-32 grid-cols-7 gap-1">
                <div className="flex flex-col gap-1">
                  <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase">M</div>
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#3a5f94] opacity-20" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase">T</div>
                  <div className="flex-1 rounded-sm bg-[#3a5f94]" />
                  <div className="flex-1 rounded-sm bg-[#3a5f94]" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase">W</div>
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase">T</div>
                  <div className="flex-1 rounded-sm bg-[#3a5f94] opacity-50" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#3a5f94]" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase">F</div>
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#3a5f94]" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase">S</div>
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="h-4 text-center text-[8px] font-black text-slate-400 uppercase">S</div>
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                  <div className="flex-1 rounded-sm bg-[#f0f4f7]" />
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] italic text-[#566166]">
                Highlighted blocks indicate class times.
              </p>
            </section>

            <section>
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                Staff Daily Schedule
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-50 py-2">
                  <span className="text-xs font-bold text-[#2a3439]">Morning Shift</span>
                  <span className="text-xs text-[#566166]">07:00 AM - 12:00 PM</span>
                </div>
                <div className="flex items-center justify-between rounded bg-amber-50 px-2 py-2 border-b border-slate-50">
                  <span className="text-xs font-bold text-amber-700">Lunch Break</span>
                  <span className="text-xs text-amber-700">12:00 PM - 01:00 PM</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-50 py-2">
                  <span className="text-xs font-bold text-[#2a3439]">Afternoon Shift</span>
                  <span className="text-xs text-[#566166]">01:00 PM - 04:00 PM</span>
                </div>
              </div>
            </section>

            <section>
              <h4 className="mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest text-[#566166] uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3a5f94]" />
                Recent Activities &amp; Reports
              </h4>
              <div className="relative space-y-6 pl-6 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-[2px] before:bg-[#cfdce3] before:content-['']">
                <div className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                  <p className="text-[10px] font-bold text-slate-400">TODAY, 10:45 AM</p>
                  <p className="text-sm font-bold text-[#2a3439]">Cleaned Room 302</p>
                  <p className="text-xs text-[#566166]">Activity: Maintenance Log</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#9f403d]" />
                  <p className="text-[10px] font-bold text-slate-400">YESTERDAY, 02:15 PM</p>
                  <p className="text-sm font-bold text-[#9f403d]">Late Arrival Report</p>
                  <p className="text-xs text-[#566166]">Infraction: 15min delay without notice.</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                  <p className="text-[10px] font-bold text-slate-400">OCT 24, 09:00 AM</p>
                  <p className="text-sm font-bold text-[#2a3439]">Inventory Check Complete</p>
                  <p className="text-xs text-[#566166]">Activity: Equipment Audit</p>
                </div>
              </div>
            </section>
          </div>

          <div className="flex gap-3 bg-slate-50 p-6">
            <button className="flex-1 rounded-xl bg-[#3a5f94] py-3 text-xs font-bold text-white shadow-lg shadow-[#3a5f94]/20">
              Edit Profile
            </button>
            <button className="rounded-xl border border-slate-200 bg-white p-3 text-[#9f403d] transition-colors hover:bg-red-50">
              <span className="material-symbols-outlined text-lg">flag</span>
            </button>
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
