export default function Home() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-medium tracking-wider text-slate-500 uppercase">Rooms in Class Now</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">28</h3>
            <span className="rounded bg-green-50 px-2 py-1 text-xs font-bold text-green-600 dark:bg-green-900/20">66% Active</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-medium tracking-wider text-slate-500 uppercase">Rooms Available</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">14</h3>
            <span className="rounded bg-[#295786]/10 px-2 py-1 text-xs font-bold text-[#295786]">Ready for Booking</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-medium tracking-wider text-slate-500 uppercase">Total Weekly Classes</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white">1,240</h3>
            <span className="text-xs font-medium text-slate-500">This Semester</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-2 text-xs font-medium tracking-wider text-slate-500 uppercase">Last Import</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-slate-400">history</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Feb 25 by Admin</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <button className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white transition-all hover:border-[#295786] hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#295786]/10 text-[#295786] transition-colors group-hover:bg-[#295786] group-hover:text-white">
                <span className="material-symbols-outlined">upload</span>
              </div>
              <span className="px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300">Upload Excel</span>
            </button>
            <button className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white transition-all hover:border-[#295786] hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#295786]/10 text-[#295786] transition-colors group-hover:bg-[#295786] group-hover:text-white">
                <span className="material-symbols-outlined">view_week</span>
              </div>
              <span className="px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300">Weekly Schedule</span>
            </button>
            <button className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white transition-all hover:border-[#295786] hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#295786]/10 text-[#295786] transition-colors group-hover:bg-[#295786] group-hover:text-white">
                <span className="material-symbols-outlined">person_search</span>
              </div>
              <span className="px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300">Search Search</span>
            </button>
            <button className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white transition-all hover:border-[#295786] hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#295786]/10 text-[#295786] transition-colors group-hover:bg-[#295786] group-hover:text-white">
                <span className="material-symbols-outlined">map</span>
              </div>
              <span className="px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300">Building Map</span>
            </button>
          </div>
        </div>
        <div className="space-y-6">
          <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">System Alerts</h4>
          <div className="space-y-3">
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
              <span className="material-symbols-outlined text-amber-600">warning</span>
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-400">Conflict Detected</p>
                <p className="text-[11px] text-amber-800 dark:text-amber-500">
                  2 schedule conflicts found in Room 302 for Wednesday.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-[#295786]/20 bg-[#295786]/5 p-4">
              <span className="material-symbols-outlined text-[#295786]">pending_actions</span>
              <div>
                <p className="text-xs font-bold text-[#295786]">Import Pending</p>
                <p className="text-[11px] text-[#295786]/80">Excel import &quot;Spring_Update&quot; is awaiting confirmation.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Next Classes</h4>
            <button className="text-xs font-bold text-[#295786] hover:underline">View All</button>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            <div className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="flex min-w-[60px] flex-col items-center rounded-lg bg-slate-100 px-2 py-3 dark:bg-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">10:00</span>
                  <span className="text-[9px] text-slate-500 uppercase">AM</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Programming I</p>
                  <div className="flex gap-2 text-xs text-slate-500">
                    <span className="font-medium text-[#295786]">Room 301</span>
                    <span>•</span>
                    <span>Prof. Perez</span>
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700">Starting Soon</span>
            </div>
            <div className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="flex min-w-[60px] flex-col items-center rounded-lg bg-slate-100 px-2 py-3 dark:bg-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">10:30</span>
                  <span className="text-[9px] text-slate-500 uppercase">AM</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Calculus II</p>
                  <div className="flex gap-2 text-xs text-slate-500">
                    <span className="font-medium text-[#295786]">Room 405</span>
                    <span>•</span>
                    <span>Dr. Mendez</span>
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">Scheduled</span>
            </div>
            <div className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="flex min-w-[60px] flex-col items-center rounded-lg bg-slate-100 px-2 py-3 dark:bg-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">11:00</span>
                  <span className="text-[9px] text-slate-500 uppercase">AM</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Physics Lab</p>
                  <div className="flex gap-2 text-xs text-slate-500">
                    <span className="font-medium text-[#295786]">Room 102</span>
                    <span>•</span>
                    <span>Prof. Thompson</span>
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">Scheduled</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-5 dark:border-slate-800">
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Weekly Building Overview</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Day</th>
                  <th className="px-6 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Occupancy (%)</th>
                  <th className="px-6 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Conflicts</th>
                  <th className="px-6 py-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                <tr>
                  <td className="px-6 py-4 text-sm font-semibold">Monday</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-[#295786]" style={{ width: "82%" }} />
                      </div>
                      <span className="text-xs font-medium">82%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">0</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                      <span className="size-1.5 rounded-full bg-green-600" />
                      Healthy
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-semibold">Tuesday</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-[#295786]" style={{ width: "94%" }} />
                      </div>
                      <span className="text-xs font-medium">94%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-amber-600">1</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                      <span className="size-1.5 rounded-full bg-amber-600" />
                      Warning
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-semibold">Wednesday</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full bg-[#295786]" style={{ width: "76%" }} />
                      </div>
                      <span className="text-xs font-medium">76%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">0</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                      <span className="size-1.5 rounded-full bg-green-600" />
                      Healthy
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h4 className="text-sm font-bold tracking-wider text-slate-800 uppercase dark:text-slate-200">Mini Building Map Preview</h4>
            <p className="mt-1 text-xs text-slate-500">Real-time room occupancy status visualization</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button className="rounded-lg bg-white px-3 py-1 text-[10px] font-bold text-[#295786] uppercase shadow-sm dark:bg-slate-700">FL 1</button>
            <button className="rounded-lg px-3 py-1 text-[10px] font-bold text-slate-500 uppercase hover:bg-white/50 dark:hover:bg-slate-700/50">FL 2</button>
            <button className="rounded-lg px-3 py-1 text-[10px] font-bold text-slate-500 uppercase hover:bg-white/50 dark:hover:bg-slate-700/50">FL 3</button>
            <button className="rounded-lg px-3 py-1 text-[10px] font-bold text-slate-500 uppercase hover:bg-white/50 dark:hover:bg-slate-700/50">FL 4</button>
            <button className="rounded-lg px-3 py-1 text-[10px] font-bold text-slate-500 uppercase hover:bg-white/50 dark:hover:bg-slate-700/50">FL 5</button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="group flex aspect-video cursor-default flex-col items-center justify-center rounded-xl border-2 border-red-500/30 bg-red-100 p-4 dark:bg-red-900/20">
            <span className="text-lg font-black text-red-700 dark:text-red-400">301</span>
            <span className="text-[10px] font-bold text-red-600/70 uppercase">In Class</span>
          </div>
          <div className="group flex aspect-video cursor-default flex-col items-center justify-center rounded-xl border-2 border-green-500/30 bg-green-100 p-4 dark:bg-green-900/20">
            <span className="text-lg font-black text-green-700 dark:text-green-400">302</span>
            <span className="text-[10px] font-bold text-green-600/70 uppercase">Available</span>
          </div>
          <div className="group flex aspect-video cursor-default flex-col items-center justify-center rounded-xl border-2 border-amber-500/30 bg-amber-100 p-4 dark:bg-amber-900/20">
            <span className="text-lg font-black text-amber-700 dark:text-amber-400">303</span>
            <span className="text-[10px] font-bold text-amber-600/70 uppercase">Starting Soon</span>
          </div>
          <div className="group flex aspect-video cursor-default flex-col items-center justify-center rounded-xl border-2 border-red-500/30 bg-red-100 p-4 dark:bg-red-900/20">
            <span className="text-lg font-black text-red-700 dark:text-red-400">304</span>
            <span className="text-[10px] font-bold text-red-600/70 uppercase">In Class</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row">
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-green-500" />
              <span className="text-xs font-medium text-slate-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-red-500" />
              <span className="text-xs font-medium text-slate-600">In Class</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-amber-500" />
              <span className="text-xs font-medium text-slate-600">Starting Soon</span>
            </div>
          </div>
          <button className="w-full rounded-xl bg-[#295786] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#295786]/20 transition-all hover:scale-105 active:scale-95 sm:w-auto">
            Open Full Building Map
          </button>
        </div>
      </section>
    </div>
  );
}
