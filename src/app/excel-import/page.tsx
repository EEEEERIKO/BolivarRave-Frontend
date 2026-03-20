"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

const EXCEL_EXTENSIONS = [".xlsx", ".xls"];
const CSV_EXTENSIONS = [".csv"];
const EXCEL_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
];
const WEEK_DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"] as const;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type ImportResponse = {
  message: string;
  import: {
    id: string;
    sourceFile: string;
    importedAt: string;
    rowsCount: number;
    classesCount: number;
    slotsCount: number;
  };
};

function isExcelFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const byExtension = [...EXCEL_EXTENSIONS, ...CSV_EXTENSIONS].some((ext) => lowerName.endsWith(ext));
  const byMime = EXCEL_MIME_TYPES.includes(file.type);
  return byExtension || byMime;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export default function ExcelImportPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fallbackDay, setFallbackDay] = useState<(typeof WEEK_DAYS)[number]>("Lunes");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse["import"] | null>(null);

  const isCsvFile = useMemo(() => {
    if (!selectedFile) return false;
    return selectedFile.name.toLowerCase().endsWith(".csv");
  }, [selectedFile]);

  const fileLabel = useMemo(() => {
    if (!selectedFile) {
      return {
        name: "Ningun archivo cargado",
        detail: "Arrastra y suelta un archivo Excel o usa Change file",
      };
    }

    return {
      name: selectedFile.name,
      detail: `File uploaded successfully - ${formatFileSize(selectedFile.size)}`,
    };
  }, [selectedFile]);

  const processFile = (file: File | null) => {
    if (!file) return;

    if (!isExcelFile(file)) {
      const message = "Formato no permitido. Solo se aceptan archivos .xls, .xlsx o .csv.";
      setFileError(message);
      window.alert(message);
      return;
    }

    setSelectedFile(file);
    setFileError(null);
    setImportError(null);
    setImportResult(null);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) {
      setImportError("Primero debes seleccionar un archivo.");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (isCsvFile) {
        formData.append("day", fallbackDay);
      }

      const response = await fetch(`${API_BASE_URL}/api/schedules/import`, {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as ImportResponse | { error?: string };

      if (!response.ok) {
        throw new Error((body as { error?: string }).error ?? "No se pudo importar el archivo");
      }

      setImportResult((body as ImportResponse).import);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al importar el archivo";
      setImportError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    processFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    processFile(file);
  };

  return (
    <div className="bg-background-light p-8 dark:bg-background-dark">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">Import Schedule</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Upload an Excel file to update the building timetable and room allocations.
          </p>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
          <span className="material-symbols-outlined mt-0.5 text-amber-600 dark:text-amber-500">warning</span>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">Warning: Data Override</h4>
            <p className="mt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-500">
              Importing a new schedule will replace the currently active schedule for the selected semester.
              Please review the data preview carefully before confirming the import.
            </p>
          </div>
        </div>

        <div>
          <div
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white p-6 text-center transition-all dark:bg-slate-900/50 ${
              isDragOver
                ? "border-[#295786] bg-[#295786]/5"
                : "border-primary/30 dark:border-primary/40"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,application/csv"
              onChange={handleFileChange}
            />

            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">{fileLabel.name}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{fileLabel.detail}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Formato recomendado: .xlsx (con hojas Lunes-Viernes). CSV solo una hoja.</p>
            {fileError && (
              <p className="mt-2 rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700">{fileError}</p>
            )}
            <button
              type="button"
              className="mt-4 text-sm font-semibold text-primary hover:underline dark:text-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Change file
            </button>

            {isCsvFile ? (
              <div className="mt-4 flex w-full max-w-sm items-center justify-center gap-2 rounded-md bg-slate-50 p-2">
                <label className="text-xs font-semibold text-slate-600">Dia del CSV:</label>
                <select
                  value={fallbackDay}
                  onChange={(event) => setFallbackDay(event.target.value as (typeof WEEK_DAYS)[number])}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  {WEEK_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Total Classes</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{importResult?.classesCount ?? "-"}</h4>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Bloques Horarios</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{importResult?.slotsCount ?? "-"}</h4>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Work Days</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">Mon - Fri</h4>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Time Range</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">6AM - 10PM</h4>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-slate-100">Schedule Data Preview</h3>
            <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400">
              <span className="material-symbols-outlined text-sm">verified</span>
              No conflicts detected
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Classroom</th>
                  <th className="px-6 py-3">Day</th>
                  <th className="px-6 py-3">Start Time</th>
                  <th className="px-6 py-3">End Time</th>
                  <th className="px-6 py-3">Course</th>
                  <th className="px-6 py-3">Professor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-4 font-medium">Room 301</td>
                  <td className="px-6 py-4">Monday</td>
                  <td className="px-6 py-4 text-slate-500">08:00 AM</td>
                  <td className="px-6 py-4 text-slate-500">10:00 AM</td>
                  <td className="px-6 py-4 font-semibold text-primary dark:text-blue-400">Programming I</td>
                  <td className="px-6 py-4">Prof. Perez</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-4 font-medium">Room 102</td>
                  <td className="px-6 py-4">Monday</td>
                  <td className="px-6 py-4 text-slate-500">10:00 AM</td>
                  <td className="px-6 py-4 text-slate-500">12:00 PM</td>
                  <td className="px-6 py-4 font-semibold text-primary dark:text-blue-400">Data Structures</td>
                  <td className="px-6 py-4">Prof. Smith</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-4 font-medium">Room 305</td>
                  <td className="px-6 py-4">Tuesday</td>
                  <td className="px-6 py-4 text-slate-500">02:00 PM</td>
                  <td className="px-6 py-4 text-slate-500">04:00 PM</td>
                  <td className="px-6 py-4 font-semibold text-primary dark:text-blue-400">Ethics 101</td>
                  <td className="px-6 py-4">Prof. Jordan</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-4 font-medium">Room 201</td>
                  <td className="px-6 py-4">Wednesday</td>
                  <td className="px-6 py-4 text-slate-500">08:00 AM</td>
                  <td className="px-6 py-4 text-slate-500">11:00 AM</td>
                  <td className="px-6 py-4 font-semibold text-primary dark:text-blue-400">Physics II</td>
                  <td className="px-6 py-4">Prof. Tanaka</td>
                </tr>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-4 font-medium">Room 301</td>
                  <td className="px-6 py-4">Friday</td>
                  <td className="px-6 py-4 text-slate-500">04:00 PM</td>
                  <td className="px-6 py-4 text-slate-500">06:00 PM</td>
                  <td className="px-6 py-4 font-semibold text-primary dark:text-blue-400">Algorithms</td>
                  <td className="px-6 py-4">Prof. Rossi</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-slate-200 py-6 dark:border-slate-800">
          <div className="flex w-full flex-col items-center gap-4">
            <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!selectedFile || isImporting}
                className="rounded-lg bg-primary px-8 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? "Importando..." : "Confirm Schedule Import"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFileError(null);
                  setImportError(null);
                  setImportResult(null);
                }}
                className="rounded-lg px-8 py-3 font-bold text-slate-600 transition-all hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel Import
              </button>
            </div>
            <p className="max-w-lg text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Once confirmed, the new schedule will become the active schedule for the selected semester.
              A snapshot of the previous schedule will be archived.
            </p>
            {importResult ? (
              <p className="max-w-lg rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-700">
                Importacion exitosa: {importResult.rowsCount} filas procesadas, {importResult.classesCount} clases y {importResult.slotsCount} bloques.
              </p>
            ) : null}
            {importError ? (
              <p className="max-w-lg rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700">{importError}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 pt-10">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Previous Imports History</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Semester</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="px-6 py-4 text-slate-500">Nov 12, 2025 - 10:45 AM</td>
                  <td className="px-6 py-4">admin_jane</td>
                  <td className="px-6 py-4">2025-2</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 uppercase dark:bg-green-900/30 dark:text-green-400">
                      Success
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-500">May 15, 2025 - 03:20 PM</td>
                  <td className="px-6 py-4">admin_john</td>
                  <td className="px-6 py-4">2025-1</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 uppercase dark:bg-green-900/30 dark:text-green-400">
                      Success
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-500">Dec 01, 2024 - 09:12 AM</td>
                  <td className="px-6 py-4">sys_root</td>
                  <td className="px-6 py-4">2024-2</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 uppercase dark:bg-slate-800 dark:text-slate-400">
                      Archived
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
