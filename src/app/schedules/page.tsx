"use client";

import { Fragment, useMemo, useState } from "react";

type ScheduleEvent = {
  id: string;
  day: string;
  room: string;
  start: string;
  end: string;
  title: string;
  teacher: string;
  area: string;
  color: "blue" | "emerald" | "amber" | "violet";
};

const weekDays = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

const weekDates: Record<string, string> = {
  Lunes: "14",
  Martes: "15",
  Miercoles: "16",
  Jueves: "17",
  Viernes: "18",
  Sabado: "19",
  Domingo: "20",
};

const rooms = [
  "Aula Foro Union 101",
  "Aseo Salones 101",
  "Aula Foro UNAC 102",
  "Aseo Salones 102",
  "Sala Informatica 1 Bolivar",
  "Aseo Salones",
  "Sala Informatica 2 Bolivar",
  "Aseo Salones",
  "Sala de Simulacion 104",
  "Aseo Salones 104",
  "Sala de Simulacion 105",
  "Aseo Salones 105",
  "Sala de Simulacion 106",
  "Aseo Salones 106",
  "Salon 201",
  "Aseo Salones 201",
  "Salon 202",
  "Aseo Salones 202",
  "Salon 203",
  "Aseo Salones 203",
  "Laboratorio de Infantil 204",
  "Aseo Salones 204",
  "Salon 205",
  "Aseo Salones 205",
  "Salon 206",
  "Aseo Salones 206",
  "Salon 301 MD",
  "Aseo Salones 301",
  "Salon 302",
  "Aseo Salones 302",
  "Salon 303",
  "Aseo Salones 303",
  "Salon 304 MD",
  "Aseo Salones 304",
  "Salon 305",
  "Aseo Salones 305",
  "Laboratorio de Musica 308",
  "Aseo Salones 308",
  "Salon 401 MD",
  "Aseo Salones 401",
  "Salon 402 MD",
  "Aseo Salones 402",
  "Laboratorio de analisis de datos y simulacion financiera 403",
  "Aseo Salones 403",
  "Laboratorio de Desarrollo de Software (LDS) 404",
  "Aseo Salones 404",
  "Laboratorio de Fisica 405",
  "Aseo Salones 405",
  "Salon 406",
  "Aseo Salones 406",
  "Aula Interamericana 501",
  "Aseo Salones 501",
  "Aula Interamericana 502",
  "Aseo Salones 502",
  "Aula Interamericana 503",
  "Aseo Salones 503",
  "Salon 505 MD",
  "Aseo Salones 505",
  "Salon 506 MD",
  "Aseo Salones 506",
  "Solicitar salon a Planeacion",
  "Virtual",
];

const timeSlots = [
  "06:00-06:30",
  "06:30-07:00",
  "07:00-07:30",
  "07:30-08:00",
  "08:00-08:30",
  "08:30-09:00",
  "09:00-09:30",
  "09:30-10:00",
  "10:00-10:30",
  "10:30-11:00",
  "11:30-12:00",
  "12:00-12:30",
  "12:30-13:00",
  "13:00-13:30",
  "13:30-14:00",
  "14:00-14:30",
  "14:30-15:00",
  "15:00-15:30",
  "15:30-16:00",
  "16:00-16:30",
  "16:30-17:00",
  "17:00-17:30",
  "17:30-18:00",
  "18:00-18:30",
  "18:30-19:00",
  "19:00-19:30",
  "19:30-20:00",
  "20:00-20:30",
  "20:30-21:00",
  "21:00-21:30",
  "21:30-22:00",
];

const demoEvents: ScheduleEvent[] = [
  {
    id: "ev-1",
    day: "Lunes",
    room: "Salon 301 MD",
    start: "08:00",
    end: "10:00",
    title: "Programacion I",
    teacher: "Prof. Perez",
    area: "Ingenieria",
    color: "blue",
  },
  {
    id: "ev-2",
    day: "Martes",
    room: "Laboratorio de Desarrollo de Software (LDS) 404",
    start: "10:00",
    end: "12:00",
    title: "Estructuras de Datos",
    teacher: "Dr. Smith",
    area: "Sistemas",
    color: "emerald",
  },
  {
    id: "ev-3",
    day: "Miercoles",
    room: "Sala de Simulacion 105",
    start: "14:00",
    end: "15:30",
    title: "Etica en Tecnologia",
    teacher: "Prof. Jamila",
    area: "Humanidades",
    color: "amber",
  },
  {
    id: "ev-4",
    day: "Jueves",
    room: "Laboratorio de Fisica 405",
    start: "16:00",
    end: "18:00",
    title: "Fisica Experimental",
    teacher: "Ing. Vargas",
    area: "Ciencias",
    color: "violet",
  },
  {
    id: "ev-5",
    day: "Viernes",
    room: "Virtual",
    start: "18:00",
    end: "20:00",
    title: "Seminario de Investigacion",
    teacher: "Dra. Mendez",
    area: "Posgrados",
    color: "blue",
  },
];

const eventStyles: Record<ScheduleEvent["color"], string> = {
  blue: "bg-blue-100 border-blue-600 text-blue-900",
  emerald: "bg-emerald-100 border-emerald-600 text-emerald-900",
  amber: "bg-amber-100 border-amber-600 text-amber-900",
  violet: "bg-violet-100 border-violet-600 text-violet-900",
};

export default function SchedulesPage() {
  const [selectedDay, setSelectedDay] = useState("Miercoles");
  const [roomQuery, setRoomQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const filteredRooms = useMemo(() => {
    const query = roomQuery.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter((room) => room.toLowerCase().includes(query));
  }, [roomQuery]);

  const visibleEvents = useMemo(
    () => demoEvents.filter((event) => event.day === selectedDay && filteredRooms.includes(event.room)),
    [selectedDay, filteredRooms]
  );

  const selectedEvent = demoEvents.find((event) => event.id === selectedEventId) ?? null;

  const slotStarts = useMemo(() => timeSlots.map((slot) => slot.split("-")[0]), []);
  const slotToIndex = useMemo(
    () => Object.fromEntries(slotStarts.map((start, index) => [start, index])),
    [slotStarts]
  );

  const timeColWidth = 120;
  const roomColWidth = 220;
  const headerHeight = 64;
  const slotHeight = 44;

  return (
    <div className="p-4 md:p-6">
      <div className="sticky top-20 z-30 mb-4 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold">Academic Planner - Schedules</h1>
            <span className="rounded-full bg-[#295786]/10 px-3 py-1 text-xs font-semibold text-[#295786]">
              Semana Oct 14 - Oct 20, 2024
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {weekDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedDay === day ? "bg-[#295786] text-white" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {day.slice(0, 3)} {weekDates[day]}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={roomQuery}
              onChange={(event) => setRoomQuery(event.target.value)}
              placeholder="Filtrar salon..."
              className="h-10 w-56 rounded-lg border border-slate-200 px-3 text-sm outline-none ring-[#295786]/30 focus:ring"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="relative isolate overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-auto" style={{ maxHeight: "75vh" }}>
            <div
              className="relative min-w-max"
              style={{ width: timeColWidth + filteredRooms.length * roomColWidth }}
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `${timeColWidth}px repeat(${filteredRooms.length}, ${roomColWidth}px)`,
                  gridTemplateRows: `${headerHeight}px repeat(${timeSlots.length}, ${slotHeight}px)`,
                }}
              >
                <div className="sticky top-0 left-0 z-30 flex items-center border-r border-b border-slate-200 bg-slate-50 px-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  HORA
                </div>

                {filteredRooms.map((room, roomIndex) => (
                  <div
                    key={`header-${room}-${roomIndex}`}
                    className="sticky top-0 z-20 border-r border-b border-slate-200 bg-white px-3 py-2"
                  >
                    <p className="line-clamp-2 text-xs font-semibold text-slate-700">{room}</p>
                  </div>
                ))}

                {timeSlots.map((slot, rowIndex) => (
                  <Fragment key={`row-${slot}`}>
                    <div
                      className="sticky left-0 z-20 border-r border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"
                      style={{ gridRow: rowIndex + 2, gridColumn: 1 }}
                    >
                      {slot}
                    </div>

                    {filteredRooms.map((room, roomIndex) => (
                      <button
                        key={`${slot}-${room}-${roomIndex}`}
                        type="button"
                        className="border-r border-b border-slate-100 transition-colors hover:bg-[#295786]/5"
                        style={{
                          gridRow: rowIndex + 2,
                          gridColumn: roomIndex + 2,
                        }}
                        onClick={() => setSelectedEventId(null)}
                        title={`${room} - ${slot}`}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>

              {visibleEvents.map((event) => {
                const roomIndex = filteredRooms.findIndex((room) => room === event.room);
                const startIndex = slotToIndex[event.start] ?? -1;
                const endIndex = slotToIndex[event.end] ?? startIndex + 1;

                if (roomIndex < 0 || startIndex < 0) return null;

                const span = Math.max(1, endIndex - startIndex);

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={`absolute z-10 overflow-hidden rounded-lg border-l-4 p-2 text-left shadow-sm transition hover:shadow-md ${eventStyles[event.color]} ${
                      selectedEventId === event.id ? "ring-2 ring-[#295786]" : ""
                    }`}
                    style={{
                      left: timeColWidth + roomIndex * roomColWidth + 4,
                      top: headerHeight + startIndex * slotHeight + 4,
                      width: roomColWidth - 8,
                      height: span * slotHeight - 8,
                    }}
                  >
                    <p className="truncate text-[11px] font-semibold opacity-80">{event.area}</p>
                    <p className="truncate text-sm font-bold">{event.title}</p>
                    <p className="mt-1 truncate text-[11px] font-medium">{event.teacher}</p>
                    <p className="truncate text-[11px]">{event.start} - {event.end}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
          <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Detalle interactivo</h2>
          <p className="mt-2 text-sm text-slate-600">
            Haz clic sobre cualquier bloque para ver detalle rapido del horario.
          </p>

          {selectedEvent ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-[#295786]">{selectedEvent.day}</p>
              <h3 className="mt-1 text-base font-bold">{selectedEvent.title}</h3>
              <p className="mt-2 text-sm text-slate-600">Docente: {selectedEvent.teacher}</p>
              <p className="text-sm text-slate-600">Salon: {selectedEvent.room}</p>
              <p className="text-sm text-slate-600">Horario: {selectedEvent.start} - {selectedEvent.end}</p>
              <button
                type="button"
                className="mt-4 w-full rounded-lg bg-[#295786] px-3 py-2 text-sm font-semibold text-white"
              >
                Editar evento
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No hay evento seleccionado. Puedes explorar el calendario y filtrar salones para una busqueda rapida.
            </div>
          )}

          <div className="mt-6 space-y-2">
            <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Atajos</h3>
            <div className="rounded-lg bg-[#295786]/5 px-3 py-2 text-xs text-slate-700">1. Usa filtro para encontrar un salon.</div>
            <div className="rounded-lg bg-[#295786]/5 px-3 py-2 text-xs text-slate-700">2. Selecciona dia de la semana.</div>
            <div className="rounded-lg bg-[#295786]/5 px-3 py-2 text-xs text-slate-700">3. Click en bloque para ver detalle.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
