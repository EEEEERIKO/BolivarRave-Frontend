"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  icon: string;
  href: string;
  isRoute?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: "dashboard", href: "/", isRoute: true },
  { label: "Schedules", icon: "calendar_today", href: "/schedules", isRoute: true },
  { label: "Rooms", icon: "meeting_room", href: "/rooms", isRoute: true },
  { label: "Auditorio", icon: "theater_comedy", href: "/auditorio", isRoute: true },
  { label: "Staff", icon: "groups", href: "/staff", isRoute: true },
  { label: "Inventory", icon: "inventory_2", href: "/inventory", isRoute: true },
  { label: "Excel Import", icon: "upload_file", href: "/excel-import", isRoute: true },
];

function navClasses(isActive: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[#295786] text-white shadow-sm"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#f6f7f8] font-[Inter,sans-serif] text-slate-900 dark:bg-[#13181f] dark:text-slate-100">
      <aside className="fixed z-50 flex h-full w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 p-6">
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-lg bg-white">
            <Image src="/logo.png" alt="UNAC" width={40} height={40} className="h-10 w-10 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-wider text-[#295786] dark:text-slate-100">UNAC</h1>
            <p className="text-[10px] font-medium text-slate-500">Edificio Bolivar Rave</p>
          </div>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-4">
          {navItems.map((item) => {
            const isActive = item.isRoute ? pathname === item.href : false;
            if (item.isRoute) {
              return (
                <Link key={item.label} className={navClasses(isActive)} href={item.href}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            }

            return (
              <a key={item.label} className={navClasses(false)} href={item.href}>
                <span className="material-symbols-outlined">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          })}

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <a className={navClasses(false)} href="#">
              <span className="material-symbols-outlined">settings</span>
              <span>Settings</span>
            </a>
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Admin"
              className="size-10 rounded-full border-2 border-white shadow-sm dark:border-slate-700"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCf7vWJrNb7o1XBBrzM2xzCS4_C7UmE435vlnJi2LoNwXddvTG_y1Ogz6uRM4V3mRh3XRRZJB8AOc_U2rXTIndFEodHHFChy9jNdJEfS5aS3zMov4-5YlCNNR2ZFUKnY2HyC1fQ4LIjLaclGk7AaoiK0gLsfvI1oLBXdfXNkBuXIDWlN62sWikIxc_eXc0wuvIjmTSLUmNghZSb5xYR3TErR2mXWrXqGGA_Je6nFh4HQ8N4NuZPFyR0MBYdAHAa_mMUgKSizBCC1w"
            />
            <div className="overflow-hidden">
              <p className="truncate text-xs font-semibold">Dr. Ricardo Silva</p>
              <p className="truncate text-[10px] text-slate-500">System Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-64 min-h-screen flex-1">
        <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h2 className="text-lg leading-tight font-bold text-slate-900 dark:text-white">Bolivar Building</h2>
              <p className="text-xs font-medium text-[#295786]">Semester 2026-1</p>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="relative w-96">
              <span className="material-symbols-outlined absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">search</span>
              <input
                className="w-full rounded-xl border-none bg-slate-100 py-2 pr-4 pl-10 text-sm transition-all focus:ring-2 focus:ring-[#295786]/20 dark:bg-slate-800"
                placeholder="Search classrooms or professors..."
                type="text"
              />
            </div>
          </div>
          <button className="relative flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2.5 size-2 rounded-full border-2 border-white bg-red-500 dark:border-slate-900" />
          </button>
        </header>

        {children}
      </main>
    </div>
  );
}
