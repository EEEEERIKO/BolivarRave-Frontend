"use client";

import { useMemo, useState } from "react";

type RoomStatus = "Available" | "Occupied" | "Starting Soon";

type RoomData = {
  room: string;
  floor: string;
  status: RoomStatus;
  session: string;
  section: string;
  professor: string;
  department: string;
  schedule: string;
  remaining: string;
};

const floorGroups: { floor: string; rooms: string[] }[] = [
  { floor: "Floor 5", rooms: ["501", "502", "503", "504", "505"] },
  { floor: "Floor 4", rooms: ["401", "402", "403", "404", "405"] },
  { floor: "Floor 3", rooms: ["301", "302", "303", "304", "305"] },
  { floor: "Floor 2", rooms: ["201", "202", "203", "204", "205"] },
  { floor: "Floor 1", rooms: ["101", "102", "103", "104", "105"] },
];

const roomData: RoomData[] = [
  {
    room: "301",
    floor: "Floor 3",
    status: "Occupied",
    session: "Advanced Data Structures",
    section: "CS-302 - Section A",
    professor: "Dr. Sarah Thompson",
    department: "Department of Computer Science",
    schedule: "14:00 - 15:30",
    remaining: "45m",
  },
  {
    room: "302",
    floor: "Floor 3",
    status: "Available",
    session: "No active class",
    section: "Free slot",
    professor: "N/A",
    department: "N/A",
    schedule: "Available now",
    remaining: "-",
  },
  {
    room: "303",
    floor: "Floor 3",
    status: "Starting Soon",
    session: "Software Engineering",
    section: "SE-210 - Section B",
    professor: "Ing. Camilo Vega",
    department: "Systems Engineering",
    schedule: "16:00 - 18:00",
    remaining: "Starts in 20m",
  },
  {
    room: "401",
    floor: "Floor 4",
    status: "Available",
    session: "No active class",
    section: "Free slot",
    professor: "N/A",
    department: "N/A",
    schedule: "Available now",
    remaining: "-",
  },
  {
    room: "405",
    floor: "Floor 4",
    status: "Occupied",
    session: "Physics II",
    section: "PHY-220 - Section C",
    professor: "Prof. Tanaka",
    department: "Department of Physics",
    schedule: "10:00 - 12:00",
    remaining: "1h 10m",
  },
  {
    room: "501",
    floor: "Floor 5",
    status: "Occupied",
    session: "Algorithms",
    section: "CS-401 - Section A",
    professor: "Prof. Rossi",
    department: "Computer Science",
    schedule: "08:00 - 10:00",
    remaining: "35m",
  },
  {
    room: "505",
    floor: "Floor 5",
    status: "Starting Soon",
    session: "Ethics 101",
    section: "HUM-101 - Section D",
    professor: "Prof. Jordan",
    department: "Humanities",
    schedule: "15:00 - 17:00",
    remaining: "Starts in 10m",
  },
];

function getFallback(room: string, floor: string): RoomData {
  return {
    room,
    floor,
    status: "Available",
    session: "No active class",
    section: "Free slot",
    professor: "N/A",
    department: "N/A",
    schedule: "Available now",
    remaining: "-",
  };
}

function statusDot(status: RoomStatus) {
  if (status === "Available") return "bg-emerald-500 ring-emerald-500/10";
  if (status === "Occupied") return "bg-rose-500 ring-rose-500/10";
  return "bg-amber-400 ring-amber-400/10";
}

function statusText(status: RoomStatus) {
  if (status === "Available") return "Currently Available";
  if (status === "Occupied") return "Currently Occupied";
  return "Starting Soon";
}

export default function RoomsPage() {
  const [selectedRoom, setSelectedRoom] = useState("301");

  const allRooms = useMemo(() => {
    return floorGroups.flatMap((group) =>
      group.rooms.map((room) => {
        const found = roomData.find((item) => item.room === room);
        return found ?? getFallback(room, group.floor);
      })
    );
  }, []);

  const selectedInfo = allRooms.find((item) => item.room === selectedRoom) ?? allRooms[0];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-8">
          <h3 className="mb-1 text-2xl font-bold">Room Availability</h3>
          <p className="text-sm text-slate-500">Real-time occupancy status across all floors in Building A.</p>
          <div className="mt-6 flex gap-4">
            <Legend dot="bg-emerald-500" label="Available" />
            <Legend dot="bg-rose-500" label="Occupied" />
            <Legend dot="bg-amber-400" label="Starting Soon" />
          </div>
        </div>

        <div className="space-y-8 pb-12">
          {floorGroups.map((group) => (
            <div key={group.floor} className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="rounded bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{group.floor}</span>
                <div className="h-[1px] flex-1 bg-primary/10"></div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {group.rooms.map((room) => {
                  const data = allRooms.find((item) => item.room === room) ?? getFallback(room, group.floor);
                  return (
                    <RoomCard
                      key={room}
                      room={data.room}
                      status={data.status}
                      selected={selectedRoom === data.room}
                      onSelect={() => setSelectedRoom(data.room)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="w-80 overflow-y-auto border-l border-primary/10 bg-white dark:bg-slate-900">
        <div className="p-6">
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Room Information</h3>
            <button className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="material-symbols-outlined text-slate-400">close</span>
            </button>
          </div>

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
            <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100">Room {selectedInfo.room}</h4>
            <div className="mt-1 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${selectedInfo.status === "Available" ? "bg-emerald-500" : selectedInfo.status === "Occupied" ? "bg-rose-500" : "bg-amber-400"}`}></span>
              <span className="text-[10px] font-bold tracking-widest text-slate-600 uppercase dark:text-slate-300">{statusText(selectedInfo.status)}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Current Session</p>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-900 dark:text-slate-100">{selectedInfo.session}</h5>
                <p className="text-xs text-slate-500">{selectedInfo.section}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Professor</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                  <span className="material-symbols-outlined text-slate-400">person</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{selectedInfo.professor}</p>
                  <p className="text-[10px] text-slate-500">{selectedInfo.department}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Schedule</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base text-slate-400">schedule</span>
                <span>
                  {selectedInfo.schedule}
                  {selectedInfo.remaining !== "-" ? ` (Remaining: ${selectedInfo.remaining})` : ""}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
              <p className="mb-4 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Room Equipment</p>
              <div className="grid grid-cols-2 gap-4">
                <Equip icon="videocam" label="Projector" />
                <Equip icon="wifi" label="Hi-Speed Wi-Fi" />
                <Equip icon="tv" label="Smart TV" />
                <Equip icon="volume_up" label="Sound System" />
              </div>
            </div>

            <div className="pt-6">
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90">
                <span className="material-symbols-outlined text-sm">edit</span>
                Manage Schedule
              </button>
              <button className="mt-3 w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                View Full History
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
  selected?: boolean;
  onSelect: () => void;
};

function RoomCard({ room, status, selected, onSelect }: RoomCardProps) {
  const selectedStyles = selected ? "border-2 border-primary relative" : "border border-slate-200 dark:border-slate-700";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full cursor-pointer rounded-xl bg-white p-4 text-left transition-all hover:shadow-lg dark:bg-slate-800 ${selectedStyles}`}
    >
      <div className="mb-4 flex items-start justify-between">
        <span className="text-lg font-bold">{room}</span>
        <span className={`h-2.5 w-2.5 rounded-full ring-4 ${statusDot(status)}`}></span>
      </div>
      <p className={`text-[10px] font-bold tracking-widest uppercase ${selected ? "font-black text-primary" : "text-slate-400"}`}>
        {selected ? "Currently Selected" : status}
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
