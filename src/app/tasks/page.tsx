export default function TasksPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/30 bg-slate-100 p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <select className="appearance-none rounded-md bg-white px-3 py-1.5 pr-8 text-[11px] font-bold tracking-wider text-slate-500 uppercase shadow-sm focus:ring-1 focus:ring-[#3a5f94]">
                <option>All Floors</option>
                <option>Floor 1</option>
                <option>Floor 2</option>
                <option>Floor 3</option>
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute top-1.5 right-2 text-[14px]">expand_more</span>
            </div>
            <div className="relative">
              <select className="appearance-none rounded-md bg-white px-3 py-1.5 pr-8 text-[11px] font-bold tracking-wider text-slate-500 uppercase shadow-sm focus:ring-1 focus:ring-[#3a5f94]">
                <option>All Staff</option>
                <option>Marcus Miller</option>
                <option>Elena Rodriguez</option>
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute top-1.5 right-2 text-[14px]">expand_more</span>
            </div>
            <div className="relative">
              <select className="appearance-none rounded-md bg-white px-3 py-1.5 pr-8 text-[11px] font-bold tracking-wider text-slate-500 uppercase shadow-sm focus:ring-1 focus:ring-[#3a5f94]">
                <option>Priority: All</option>
                <option>High</option>
                <option>Medium</option>
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute top-1.5 right-2 text-[14px]">expand_more</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md border border-slate-200/30 bg-white px-3 py-1 shadow-sm">
              <span className="material-symbols-outlined mr-2 text-[18px] text-slate-500">search</span>
              <input className="w-48 border-none bg-transparent p-0 text-xs focus:ring-0" placeholder="Quick search ID or task..." type="text" />
            </div>
            <button className="flex items-center gap-2 rounded-md bg-[#3a5f94] px-4 py-1.5 text-[11px] font-bold tracking-widest text-white uppercase shadow-lg transition-all active:scale-95">
              <span className="material-symbols-outlined text-[16px]">add</span> New Task
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 items-start gap-6">
          <div className="col-span-12 space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-black tracking-[0.2em] text-slate-500 uppercase">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#3a5f94]" />
                Active Tasks (Right Now)
              </h3>
              <span className="rounded-full bg-[#d5e3ff] px-2 py-0.5 text-[10px] font-bold text-[#2c5287]">4 IN PROGRESS</span>
            </div>

            <div className="space-y-2">
              <div className="group flex cursor-pointer items-center justify-between rounded-xl border-l-4 border-[#3a5f94] bg-white p-3 shadow-sm transition-transform hover:translate-x-1">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Staff Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuArKyDaZL1cKEHJ5_Ekdyh5Ocuf6D5qmhPn32NwrEp4CXsQiw8yEzXGxFHgc2ZGDsoJSl1ADf0JCW86EPkGH-2wWAi0WzdypwkSAqQ2ASgxro5KWPryGDY76tSpyWilHX1Baqe5U08hR4jV3C_tyv7SgxfTw3UOgJPcAGrdFWC6Uh2BDhfKSokL_7cUPU7gexOFqZcXxOy7ue_bnoe867RacRSamTQpRK2j-8pVPV478ZYZacGM5gD5RKuRcI7wgGCW7gzSEKTpzA" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Classroom 302 Cleaning</h4>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Assigned to Marcus Miller • <span className="font-bold">Room 302</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-[#d3e4fe] px-2 py-0.5 text-[10px] font-bold text-[#435368]">IN PROGRESS</div>
                  <div className="h-6 w-12 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-3/4 bg-[#3a5f94]" />
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-slate-400 transition-colors group-hover:text-[#3a5f94]">more_vert</span>
                </div>
              </div>

              <div className="group flex cursor-pointer items-center justify-between rounded-xl border-l-4 border-[#3a5f94] bg-white p-3 shadow-sm transition-transform hover:translate-x-1">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Staff Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCqPjkrqbQw5nvz1TUXPTWCEbVe-4FwD9XPNfcprWBXzIh3eVn4pY8Ju43hJFIJYQmuiTfiP3FXJ_J2s4izjndXFaZKtYNWpVFe1K9FWEJkprBl_VVYRZPpGqtmdyopuZqSst79F65ShMzP3ZrNnk9m5SXDAkuSi3NiOLq5XSd_snMy9KLmgwXDh6x-n39M5J9xYJWOExb7rm7zDgVM9o2-x8hGLLxn62pwAfoR9W0n9ia1NNeYaokQIXgrw73rr-iL7zrc0VCYQ" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Projector Repair Room 101</h4>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Assigned to Elena Rodriguez • <span className="font-bold">Room 101</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-[#d3e4fe] px-2 py-0.5 text-[10px] font-bold text-[#435368]">IN PROGRESS</div>
                  <div className="h-6 w-12 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-1/4 bg-[#3a5f94]" />
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-slate-400 transition-colors group-hover:text-[#3a5f94]">more_vert</span>
                </div>
              </div>

              <div className="group flex cursor-pointer items-center justify-between rounded-xl border-l-4 border-[#3a5f94] bg-white p-3 shadow-sm transition-transform hover:translate-x-1">
                <div className="flex items-center gap-4">
                  <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="Staff Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDI_-2jZ7qS1HKaq5iLLKJar3hhZfi3xPPDtLur67krmkMdkXKuqUyVuANJpNSYhlIwJTocSNds-zX7vPbaHbAlyft9FniK-1hROU4wAW91w5tOGpzjBEJ_tFHt9HbT_p0ZRGQr5MwG7EGag0ziDQMK9Cjg-aO6ytBPMIJM1K7LBcPBt4ZCdkxKyHYb3Ew8MaqqPkAgDyfSKCY8P3UR0FRNzVQ2cC1JYON4hFv6hX6RjM0TWHgiYrKCw-VdtT09C9TDFRx4ZQVWtA" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">HVAC Inspection Zone B</h4>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Assigned to Sarah Chen • <span className="font-bold">Lower Level</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-[#d3e4fe] px-2 py-0.5 text-[10px] font-bold text-[#435368]">IN PROGRESS</div>
                  <div className="h-6 w-12 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-[90%] bg-[#3a5f94]" />
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-slate-400 transition-colors group-hover:text-[#3a5f94]">more_vert</span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 space-y-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-black tracking-[0.2em] text-slate-500 uppercase">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                Pending Queue
              </h3>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">8 UNASSIGNED</span>
            </div>

            <div className="max-h-[294px] space-y-2 overflow-y-auto pr-1">
              {[
                ["Library Bulb Replacement", "High", "Floor 2 • Lib 14"],
                ["Lab 4 Chemical Disposal", "Med", "Floor 1 • Lab 4A"],
                ["Gym Lock Repair", "Low", "Athletic Ctr"],
                ["Window Cleaning Admin Blk", "Low", "External"],
              ].map(([task, priority, location]) => (
                <div key={task} className="flex items-center justify-between rounded-lg border-l-2 border-slate-300 bg-slate-100 p-2.5">
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-800">{task}</h4>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 text-[9px] font-black uppercase ${
                          priority === "High" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {priority}
                      </span>
                      <span className="text-[9px] text-slate-500">{location}</span>
                    </div>
                  </div>
                  <button className="rounded p-1 transition-colors hover:bg-white">
                    <span className="material-symbols-outlined text-[18px] text-[#3a5f94]">person_add</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black tracking-[0.2em] text-slate-500 uppercase">General Task Archive</h3>
            <button className="flex items-center gap-1 text-[10px] font-bold text-[#3a5f94]">
              EXPORT REPORT <span className="material-symbols-outlined text-[14px]">download</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-100">
                <tr>
                  {[
                    "ID",
                    "Task Name",
                    "Staff",
                    "Priority",
                    "Floor",
                    "Room",
                    "Status",
                    "Due Date",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className={`px-4 py-2 text-[10px] font-black tracking-wider text-slate-500 uppercase ${
                        heading === "Due Date" ? "text-right" : ""
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ["#TSK-8821", "Emergency Leak Repair", "J. Doe", "Critical", "B1", "Utility Closet", "Completed", "24 Oct 23"],
                  ["#TSK-8822", "Audit Hallway Lighting", "K. Smith", "Medium", "3F", "North Wing", "Active", "25 Oct 23"],
                  ["#TSK-8823", "Floor Waxing Schedule", "A. Wong", "Low", "GF", "Main Lobby", "Pending", "26 Oct 23"],
                  ["#TSK-8824", "Server Room Temp Check", "B. Grant", "High", "B2", "Data Ctr", "Active", "24 Oct 23"],
                ].map(([id, task, staff, priority, floor, room, status, due]) => (
                  <tr key={id} className="cursor-pointer transition-colors hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{id}</td>
                    <td className="px-4 py-2 text-[11px] font-bold text-slate-800">{task}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-slate-200" />
                        <span className="text-[11px] text-slate-800">{staff}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-tighter uppercase ${
                          priority === "Critical" || priority === "High"
                            ? "bg-red-600 text-white"
                            : priority === "Medium"
                              ? "bg-slate-200 text-slate-500"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {priority}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-500">{floor}</td>
                    <td className="px-4 py-2 text-[11px] text-slate-500">{room}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`flex items-center gap-1.5 text-[10px] font-bold ${
                          status === "Active" ? "text-[#3a5f94]" : "text-slate-500"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            status === "Active" ? "bg-[#3a5f94]" : status === "Completed" ? "bg-slate-400" : "bg-slate-300"
                          }`}
                        />
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] font-medium text-slate-500">{due}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between bg-slate-100 px-4 py-2">
              <span className="text-[10px] font-bold text-slate-500">SHOWING 15 OF 124 ENTRIES</span>
              <div className="flex gap-1">
                <button className="rounded p-1 text-slate-500 hover:bg-white">
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <button className="rounded p-1 text-slate-500 hover:bg-white">
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-slate-200 bg-white/90 backdrop-blur-md md:hidden">
        {[
          ["assignment", "Tasks", true],
          ["domain", "Buildings", false],
          ["groups", "Staff", false],
          ["history", "History", false],
        ].map(([icon, label, active]) => (
          <button key={label as string} className={`flex flex-col items-center gap-1 ${active ? "text-[#3a5f94]" : "text-slate-400"}`}>
            <span className="material-symbols-outlined">{icon}</span>
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
