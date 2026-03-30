/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";

type StaffView = "directory" | "schedule";

type ScheduleRow = {
  id: string;
  name: string;
  role: string;
  image: string;
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

const SCHEDULE_ROWS: ScheduleRow[] = [
  {
    id: "aris",
    name: "Dr. Aris Thorne",
    role: "Research Lead • Fl 4",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuApYUbH8NtHFdQ3yy7apgnJu0XyHpOKjohVHJDdXsNguRvjrOXiO2jQIiBhspY5EO3gx0XrWc39YSiwU4LEu3IoGVNGYmDfTecy3E5kvHB6bHo9bcyGHqelj2kjtKNGRbnWZYizdRCJj7XpSOHCHzP0-5rwW0jE3aQON7XQ3b8yPkBF1btvw7xztc_K47kdaxrKcbVtL8pWQi6DH2m-XUvmmcuWuYmrJw-ef_n0JBYegz3jNT3L3p299sgGy5UeoN0cSx_txfSoHg",
    shiftLabel: "Working Shift (08:00 - 16:00)",
    shiftLeft: "left-[12.5%]",
    shiftRight: "right-[37.5%]",
    note: "Academic Unavailability 06:00 - 08:00",
  },
  {
    id: "julian",
    name: "Julian Vane",
    role: "Security Supervisor • Fl 1",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCVWVWiyvFCXn8Ux0ivXIKdJzbmVW3h1aTChovR-e_RuiHvLRfagOVgz6Sy30wkcZEwamM0qhhfiBHYRHebH-u4fC4IJxkIRm_Z0v7VC2-tAPgPv7HeIU5ptQ9V0SWXSBfZS7xw3LUyqYGL6rulTzaO9rI3P0An67CwMrcqhrdvajwDunklfowydwrwikufPYEIm2Ep5QFUNtcR2qo92fzYVPozFNBfk-LXNNXQdA8XvNSF4I9yBUN0kiE5OM9tggqJE3m8cMRSbA",
    shiftLabel: "Security Patrol (10:00 - 18:00)",
    shiftLeft: "left-[25%]",
    shiftRight: "right-[12.5%]",
  },
  {
    id: "elena",
    name: "Elena Rossi",
    role: "Lab Technician • Fl 3",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAK1ah-6rKKUEyCOXbd0FiHzHoiBAF_-aAuXhaJz1CuhOv221YwSDfajYGLX8akHPvxexMkWVQUe2fsdarMe5-YzOPhIS9_ZeZL3RPC76kasjWZbfLMkhPOxRIIDqnLM7cOFm7Ziu0c8vqmlpUV4QIAjHUl_jxaHtnPrrxI4s5mVgSnSGPxJHDckexw5vqupHxHH5n1qI0x8o7RrUKHWFx6ZSVDc0NnFnjA_V43KH84O1ctKycTj-egmRTAeKlOJamAnVm35kDAxg",
    shiftLabel: "Evening Shift (13:00 - 22:00)",
    shiftLeft: "left-[43.75%]",
    shiftRight: "right-[0%]",
  },
  {
    id: "kent",
    name: "Officer Kent",
    role: "Gate Security • Fl G",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBW9HiRHJmAQ7nTHlvxhqzX6qvGc9h5HrSGMEYtoa6K-nbFZKQY-hCVgJKdsdXoPeLyKeCnDlBj6xsvORd-Uk1IUMjiEvkhVYfM7OTk5sb8ppg0kSV0Xxyrwfizx0-76Cvdgaff5EemCWxTn4kpaWxtqRnnn7fMz41xd-mn-Cw-PovfhctJgEpIa3WyXriFNyBD8VanWe-K9Bi553BYd1ytQEyQafRTA3Y-vaG_eZ6HhwQKeGG1AjQcYh0Xw7B4Cs86h-Yss095cw",
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
                <img alt={row.name} className="h-10 w-10 rounded-lg object-cover" src={row.image} />
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
  const isOnShift = true;
  const balanceHours = 4;
  const formattedBalanceHours = `${balanceHours > 0 ? "+" : ""}${balanceHours} hours`;

  return (
    <div className="p-8">
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
              <p className="text-sm text-[#566166]">Managing 42 active academic personnel</p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 rounded-lg bg-[#d9e4ea] px-4 py-2 text-xs font-bold text-[#2a3439]">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                Filter
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-[#3a5f94] px-4 py-2 text-xs font-bold text-white shadow-sm">
                <span className="material-symbols-outlined text-sm">person_add</span>
                Add Staff
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden xl:grid-cols-2">
            <div className="flex items-center gap-4 rounded-xl border-2 border-[#3a5f94] bg-white p-5 shadow-xl ring-4 ring-[#3a5f94]/5 transition-all">
              <img
                alt="professional portrait of a male worker named Juan Carlos with a friendly expression"
                className="h-14 w-14 rounded-xl object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIhwsGDGIgpcBFrQGztHzSUvUQI5wAH_s5CW0fXVirhDcLzoT_bFX_TK8lccIcL7RwdJ40MjusyZC0ycFExUgZufewA0Jaf6Qo_IG78R_SbiburRkSMd4NUbS1xO7NC_MJlHnDrNfOKEwREMPNJn10vHrgtiyeHE5jLhT-zN-TsF2IUAVJm6TTuQk1MyOMMLvMteWvPUr5_gMgUaNiARXyepnn59Aib2svqq9qSvA3qnVrUVHf2IYtNAZHlOd7K_tuB5VxpJASBw"
              />
              <div className="flex-1">
                <h3 className="leading-tight font-bold text-[#2a3439]">Juan Carlos</h3>
                <p className="text-xs text-[#566166]">ID: 1.032.485.901</p>
                <p className="mt-1 text-xs font-semibold text-[#3a5f94]">Maintenance Staff</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-green-50 px-2 py-1 text-[10px] font-bold tracking-wider text-green-600 uppercase">
                  Active Now
                </span>
              </div>
            </div>

            <div className="group flex cursor-pointer items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <img
                alt="portrait of a female academic staff member in a professional studio setting"
                className="h-14 w-14 rounded-xl object-cover grayscale transition-all group-hover:grayscale-0"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCH2KANvPf18oQ82gVpOd7GBwn9O-7YbheGqNPjaDuhbLam3s7aF7sBW5PIm5mZB5NYxeShd_88kK8PyCmE-zdkFlgr4FqT621kvdvrpBame3Wah0Zbcrb2k46hj2HnKUUP4Q2nVylISQXgiIq89KsZ12jbb9Pp8rtUdx6Xes4w_0No3GaPNHgz2YTAKGRwixoCqJLyypIgj9xxg2_mDKBEgfk8jX3Fstq1hsEhWGYShgH4SJ38Hm5jfOGnUgvhdsooNv9QGJXQtw"
              />
              <div className="flex-1">
                <h3 className="leading-tight font-bold text-[#2a3439]">Elena Rodriguez</h3>
                <p className="text-xs text-[#566166]">ID: 1.099.332.115</p>
                <p className="mt-1 text-xs font-semibold text-[#566166]">Reception Lead</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-slate-50 px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Off Shift
                </span>
              </div>
            </div>

            <div className="group flex cursor-pointer items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#e8eff3] text-xl font-black text-[#566166]">
                MM
              </div>
              <div className="flex-1">
                <h3 className="leading-tight font-bold text-[#2a3439]">Marco Mendoza</h3>
                <p className="text-xs text-[#566166]">ID: 1.055.221.008</p>
                <p className="mt-1 text-xs font-semibold text-[#566166]">IT Technician</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-green-50 px-2 py-1 text-[10px] font-bold tracking-wider text-green-600 uppercase">
                  Active Now
                </span>
              </div>
            </div>

            <div className="group flex cursor-pointer items-center gap-4 rounded-xl bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <img
                alt="young professional woman staff member looking at the camera"
                className="h-14 w-14 rounded-xl object-cover grayscale transition-all group-hover:grayscale-0"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBoQYRWJFkQsfwHpQLC6vH4Wfm2wryC6UZk-2icNiz2CFbvcyTwwuyucIy86Tw87Ccl0231JHHL34t2olLIct544fYmGGGLrV78g1wz0VqKml-WZtykZVJ4Ye3pHKOH3ikGwOrJXxbqUUll1jAnADroaawY_96ZZ-EbFh17hWZ4U5JObk3KR5LU2eTLtQS_KPp-CUhwzpjeAQwsJff8uDLXah2cJuN10Wh4QzLFMEPZRuqj1_1rOWEa_OC_xAL98zbwWj97mUggig"
              />
              <div className="flex-1">
                <h3 className="leading-tight font-bold text-[#2a3439]">Sara Gaviria</h3>
                <p className="text-xs text-[#566166]">ID: 1.022.993.441</p>
                <p className="mt-1 text-xs font-semibold text-[#566166]">Library Assistant</p>
              </div>
              <div className="text-right">
                <span className="rounded bg-amber-50 px-2 py-1 text-[10px] font-bold tracking-wider text-amber-600 uppercase">
                  On Break
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#e8eff3] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-black text-[#153f73]">
                <span className="material-symbols-outlined">assignment</span>
                Assigned Tasks: Juan Carlos
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
              <img
                alt="centered large professional headshot of Juan Carlos for his staff profile"
                className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0B4fZ2quGRiR-7VV6-MZS6DSN9fYXEYzmsj_fkvODIbikG85zDeSnspxcm_DabHsC7j-tbEFMfI7-8w7V-cMaAsNZxYWXcwjeyn-DSpDkaFN3HjepkhO-elKx2XKkrm7v3RZztnAL1vuDO4CoHgON8dhXHvl72p17RVsP3j9DmnLa6ZZu8lFI1dFoktg3I3Pn24Nt0_EMEjQPm7k2z0W3piUw1NkoGc_g3mkNQ8YUz7-oWAJRs0k5ULGW-A4vFbRFkTLI9Y4Ctg"
              />
              <span className="absolute right-0 bottom-0 h-6 w-6 rounded-full border-4 border-white bg-green-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black text-[#2a3439]">Juan Carlos</h2>
              <p className="text-sm font-medium text-[#566166]">Maintenance &amp; AV Specialist</p>
            </div>
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                <p className={`text-lg font-black ${isOnShift ? "text-green-600" : "text-slate-500"}`}>
                  {isOnShift ? "Active" : "Off Shift"}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-black text-slate-400 uppercase">Balance Hours</p>
                <p className={`text-lg font-black ${balanceHours >= 0 ? "text-green-600" : "text-[#9f403d]"}`}>
                  {formattedBalanceHours}
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
                  <p className="text-sm font-semibold text-[#2a3439]">1.032.485.901</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Academic Program</label>
                  <p className="text-sm font-semibold text-[#2a3439]">B.Sc. in Electrical Engineering (Junior)</p>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-[#f0f4f7] p-3">
                  <span className="material-symbols-outlined text-[#3a5f94]">speaker_group</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#2a3439]">Audio/Sound Specialist</p>
                    <p className="text-[10px] text-[#566166]">Qualified for complex rack setups</p>
                  </div>
                  <div className="relative flex h-6 w-10 items-center rounded-full bg-[#3a5f94] px-1">
                    <div className="ml-auto h-4 w-4 rounded-full bg-white" />
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
