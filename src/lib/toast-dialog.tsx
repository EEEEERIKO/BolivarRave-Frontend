"use client";

import React, { useState } from "react";
import { createRoot } from "react-dom/client";

function mountModal(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(element);
  return () => {
    try {
      root.unmount();
    } catch {
      // ignore
    }
    if (container.parentNode) container.parentNode.removeChild(container);
  };
}

type ConfirmToastOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PromptToastOptions = ConfirmToastOptions & {
  defaultValue?: string;
  placeholder?: string;
};

export function confirmToast(message: string, options?: ConfirmToastOptions): Promise<boolean> {
  return new Promise((resolve) => {
    function Modal() {
      return (
        <div style={{ zIndex: 2147483647 }} className="fixed inset-0 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
              <div className="min-w-0 flex-1">
                {options?.title ? <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{options.title}</p> : null}
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300 whitespace-pre-line">{message}</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  unmount();
                  resolve(false);
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold tracking-wide text-slate-600 uppercase transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {options?.cancelLabel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  unmount();
                  resolve(true);
                }}
                className="rounded-md bg-[#3a5f94] px-3 py-2 text-xs font-bold tracking-wide text-white uppercase transition hover:brightness-110"
              >
                {options?.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const unmount = mountModal(<Modal />);
  });
}

export function promptToast(message: string, options?: PromptToastOptions): Promise<string | null> {
  return new Promise((resolve) => {
    function Prompt() {
      const [value, setValue] = useState(options?.defaultValue ?? "");
      return (
        <div style={{ zIndex: 2147483647 }} className="fixed inset-0 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                <span className="material-symbols-outlined text-[20px]">edit_note</span>
              </div>
              <div className="min-w-0 flex-1">
                {options?.title ? <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{options.title}</p> : null}
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300 whitespace-pre-line">{message}</p>
              </div>
            </div>

            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={options?.placeholder ?? "Escribe aquí"}
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-[#3a5f94] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  unmount();
                  resolve(null);
                }}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold tracking-wide text-slate-600 uppercase transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {options?.cancelLabel ?? "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  unmount();
                  resolve(value.trim());
                }}
                className="rounded-md bg-[#3a5f94] px-3 py-2 text-xs font-bold tracking-wide text-white uppercase transition hover:brightness-110"
              >
                {options?.confirmLabel ?? "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const unmount = mountModal(<Prompt />);
  });
}