"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ParsedScheduleRowPayload, parseScheduleWorkbookClient } from "@/lib/schedule-parser";
import { fetchApiJson } from "@/lib/api-client";
import { readAuthSession } from "@/lib/auth-session";
import toast from "react-hot-toast";

const EXCEL_EXTENSIONS = [".xlsx", ".xls"];
const CSV_EXTENSIONS = [".csv"];
const EXCEL_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
];
const WEEK_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;

type ExistingEvent = {
  id: string;
  classId: string;
  reservationType?: "normal" | "momentanea" | "iglesia";
  day: string;
  room: string;
  start: string;
  end: string;
  faculty: string;
  code: string;
  subject: string;
  teacher: string;
  startDate: string;
  endDate: string;
};

type ExistingEventsResponse = {
  events: ExistingEvent[];
};

type ImportHistoryItem = {
  id: string;
  source_file: string;
  imported_at: string;
  rows_count: number;
  classes_count: number;
  slots_count: number;
  conflicts_detected: number;
  conflicts_accepted: number;
  conflicts_rejected: number;
  imported_by: string | null;
  status: string;
};

type ImportsHistoryResponse = {
  imports: ImportHistoryItem[];
};

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

type ImportProgress = {
  active: boolean;
  percent: number;
  stage: string;
  detail: string;
};

type ClassSlot = {
  day: string;
  room: string;
  startTime: string;
  endTime: string;
};

type ClassBlock = {
  key: string;
  faculty: string;
  code: string;
  subject: string;
  teacher: string;
  startDate: string;
  endDate: string;
  slots: ClassSlot[];
};

type ConflictInfo = {
  type: "existing" | "import";
  label: string;
  overlapLabel?: string;
  existingClassId?: string;
};

type ConflictDecision = "pending" | "accept" | "reject";

type ReviewClass = ClassBlock & {
  conflicts: ConflictInfo[];
  decision: ConflictDecision;
};

type PreviewRow = {
  item: ReviewClass;
  rowType: "upsert" | "deleted";
};

type DeletedClassDecision = "pending" | "keep" | "delete";

type ManualEntryRow = {
  id: string;
  faculty: string;
  code: string;
  subject: string;
  teacher: string;
  startDate: string;
  endDate: string;
  day: string;
  room: string;
  startTime: string;
  endTime: string;
};

const createEmptyManualEntry = (): ManualEntryRow => ({
  id: crypto.randomUUID(),
  faculty: "",
  code: "",
  subject: "",
  teacher: "",
  startDate: "",
  endDate: "",
  day: "Lunes",
  room: "",
  startTime: "",
  endTime: "",
});

const toParsedRowFromManual = (row: ManualEntryRow, index: number): ParsedScheduleRowPayload => {
  const required: Array<keyof Omit<ManualEntryRow, "id">> = [
    "faculty",
    "code",
    "subject",
    "teacher",
    "startDate",
    "endDate",
    "day",
    "room",
    "startTime",
    "endTime",
  ];

  for (const field of required) {
    if (!row[field].trim()) {
      throw new Error(`Completa todos los campos en la fila manual ${index + 1}.`);
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(row.endDate)) {
    throw new Error(`Formato de fecha invalido en la fila manual ${index + 1} (usa YYYY-MM-DD).`);
  }

  if (!/^\d{2}:\d{2}$/.test(row.startTime) || !/^\d{2}:\d{2}$/.test(row.endTime)) {
    throw new Error(`Formato de hora invalido en la fila manual ${index + 1} (usa HH:MM).`);
  }

  return {
    faculty: row.faculty.trim(),
    code: row.code.trim(),
    subject: row.subject.trim(),
    teacher: row.teacher.trim(),
    startDate: row.startDate.trim(),
    endDate: row.endDate.trim(),
    day: row.day.trim(),
    room: row.room.trim(),
    startTime: row.startTime.trim(),
    endTime: row.endTime.trim(),
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

const normalizeText = (value: string) =>
  value
    .replace(/\uFFFD/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const OFFICIAL_ROOMS = [
  "Aula Foro Unión 101",
  "Aula Foro Unac 102",
  "Sala Informática 1 Bolivar",
  "Sala Informática 2 Bolivar",
  "Salón 201",
  "Salón 202",
  "Salón 203",
  "Laboratorio de Infantil 204",
  "Salón 205",
  "Salón 206",
  "Salón 301",
  "Salón 302",
  "Salón 303",
  "Salón 304",
  "Salón 305",
  "Laboratorio de Música 308",
  "Salón 401",
  "Salón 402",
  "Laboratorio de análisis de datos y simulación financiera 403",
  "Laboratorio de Desarrollo de Software (LDS) 404",
  "Laboratorio Múltiple de Física 405",
  "Salón 406",
  "Aula Interamericana 501",
  "Aula Interamericana 502",
  "Aula Interamericana 503",
  "Salón 505",
  "Salón 506",
] as const;

const OFFICIAL_ROOM_SET = new Set<string>(OFFICIAL_ROOMS.map((room) => normalizeText(room)));

const ROOM_ALIASES: Array<[RegExp, string]> = [
  [/^aula foro union( 101)?$/, "Aula Foro Unión 101"],
  [/^aula foro unac( 102)?$/, "Aula Foro Unac 102"],
  [/^sala( de)? informatica 1 bolivar$/, "Sala Informática 1 Bolivar"],
  [/^sala( de)? informatica 2 bolivar$/, "Sala Informática 2 Bolivar"],
  [/^laboratorio (multiple )?de infantil( 204)?$/, "Laboratorio de Infantil 204"],
  [/^laboratorio (multiple )?de musica( 308)?$/, "Laboratorio de Música 308"],
  [/^laboratorio (multiple )?de fisica( 405)?$/, "Laboratorio Múltiple de Física 405"],
  [/^laboratorio de (analisis de datos y )?simulacion financiera( 403)?$/, "Laboratorio de análisis de datos y simulación financiera 403"],
  [/^laboratorio de desarrollo de software( lds)?( 404)?$/, "Laboratorio de Desarrollo de Software (LDS) 404"],
  [/^aula interamericana (501|1)$/, "Aula Interamericana 501"],
  [/^aula interamericana (502|2)$/, "Aula Interamericana 502"],
  [/^aula interamericana (503|3)$/, "Aula Interamericana 503"],
];

const canonicalOfficialRoom = (value: string): string | null => {
  const normalized = normalizeText(value)
    .replace(/[()]/g, " ")
    .replace(/\bmd\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  if (OFFICIAL_ROOM_SET.has(normalized)) {
    return OFFICIAL_ROOMS.find((room) => normalizeText(room) === normalized) ?? null;
  }

  for (const [pattern, canonical] of ROOM_ALIASES) {
    if (pattern.test(normalized)) {
      return canonical;
    }
  }

  return null;
};

const isValidOfficialRoom = (value: string): boolean => canonicalOfficialRoom(value) !== null;

const normalizeRoomForCompare = (value: string) =>
  {
    const canonical = canonicalOfficialRoom(value);
    if (canonical) return canonical;

    const normalized = normalizeText(value)
      .replace(/[()]/g, " ")
      .replace(/\bmd\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/^laboratorio (multiple )?de (analisis de datos y )?simulacion financiera( 403)?$/.test(normalized)) {
      return "laboratorio de simulacion financiera 403";
    }

    if (/^laboratorio (multiple )?de desarrollo de software( lds)?( 404)?$/.test(normalized)) {
      return "laboratorio de desarrollo de software lds 404";
    }

    if (/^laboratorio (multiple )?de fisica( 405)?$/.test(normalized)) {
      return "laboratorio de fisica 405";
    }

    if (/^laboratorio (multiple )?de musica( 308)?$/.test(normalized)) {
      return "laboratorio de musica 308";
    }

    if (/^laboratorio (multiple )?de infantil( 204)?$/.test(normalized)) {
      return "laboratorio de infantil 204";
    }

    if (/^aula foro union( 101)?$/.test(normalized)) return "aula foro union 101";
    if (/^aula foro unac( 102)?$/.test(normalized)) return "aula foro unac 102";
    if (/^sala( de)? informatica 1 bolivar$/.test(normalized)) return "sala informatica 1 bolivar";
    if (/^sala( de)? informatica 2 bolivar$/.test(normalized)) return "sala informatica 2 bolivar";

    if (/^aula interamericana (501|1)$/.test(normalized)) return "aula interamericana 501";
    if (/^aula interamericana (502|2)$/.test(normalized)) return "aula interamericana 502";
    if (/^aula interamericana (503|3)$/.test(normalized)) return "aula interamericana 503";

    return normalized;
  };

const cleanDisplayText = (value: string) => value.replace(/\uFFFD/g, "").replace(/\s+/g, " ").trim();

const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
};

const daySortOrder: Record<string, number> = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Domingo: 7,
};

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

const dateRangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  rangesOverlap(new Date(`${aStart}T00:00:00`).getTime(), new Date(`${aEnd}T23:59:59`).getTime(), new Date(`${bStart}T00:00:00`).getTime(), new Date(`${bEnd}T23:59:59`).getTime());

const isSameClassIdentity = (uploaded: ClassBlock, existing: ExistingEvent) => {
  return (
    normalizeText(uploaded.code) === normalizeText(existing.code) &&
    normalizeText(uploaded.subject) === normalizeText(existing.subject) &&
    normalizeText(uploaded.teacher) === normalizeText(existing.teacher) &&
    uploaded.startDate === existing.startDate &&
    uploaded.endDate === existing.endDate
  );
};

const isSameScheduledOccurrence = (uploaded: ClassBlock, slot: ClassSlot, existing: ExistingEvent) => {
  return (
    isSameClassIdentity(uploaded, existing) &&
    normalizeText(slot.day) === normalizeText(existing.day) &&
    normalizeRoomForCompare(slot.room) === normalizeRoomForCompare(existing.room) &&
    slot.startTime === existing.start &&
    slot.endTime === existing.end
  );
};

const minutesToHHMM = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

const expandedRowSignatures = (row: ParsedScheduleRowPayload) => {
  const day = normalizeText(row.day);
  const room = normalizeRoomForCompare(row.room);
  const base = `${day}|${room}|${row.startDate}|${row.endDate}|`;

  const start = toMinutes(row.startTime);
  const end = toMinutes(row.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [`${base}${row.startTime}-${row.endTime}`];
  }

  const chunks: string[] = [];
  for (let cursor = start; cursor < end; cursor += 30) {
    const next = Math.min(end, cursor + 30);
    chunks.push(`${base}${minutesToHHMM(cursor)}-${minutesToHHMM(next)}`);
  }

  return chunks;
};

const findUnchangedExistingClassId = (
  uploadedClassRows: ParsedScheduleRowPayload[],
  existingRowsByClassId: Map<string, ParsedScheduleRowPayload[]>
) => {
  if (!uploadedClassRows.length) return null;

  const sample = uploadedClassRows[0];
  if (!sample) return null;

  const uploadedSet = new Set(uploadedClassRows.flatMap(expandedRowSignatures));

  for (const [existingClassId, existingRows] of existingRowsByClassId.entries()) {
    const firstExisting = existingRows[0];
    if (!firstExisting) continue;

    const sameIdentity =
      normalizeText(sample.code) === normalizeText(firstExisting.code) &&
      normalizeText(sample.subject) === normalizeText(firstExisting.subject) &&
      normalizeText(sample.teacher) === normalizeText(firstExisting.teacher) &&
      sample.startDate === firstExisting.startDate &&
      sample.endDate === firstExisting.endDate;

    if (!sameIdentity) continue;

    const existingSet = new Set(existingRows.flatMap(expandedRowSignatures));
    if (uploadedSet.size !== existingSet.size) continue;

    let identical = true;
    for (const key of uploadedSet) {
      if (!existingSet.has(key)) {
        identical = false;
        break;
      }
    }

    if (identical) return existingClassId;
  }

  return null;
};

const classKey = (row: ParsedScheduleRowPayload) =>
  [row.faculty, row.code, row.subject, row.teacher, row.startDate, row.endDate].join("|");

const slotKey = (slot: ClassSlot) =>
  [normalizeText(slot.day), normalizeRoomForCompare(slot.room), slot.startTime, slot.endTime].join("|");

const buildClassBlocks = (rows: ParsedScheduleRowPayload[]): ClassBlock[] => {
  const validRows = rows.filter((row) => isValidOfficialRoom(row.room));
  const map = new Map<string, ClassBlock>();

  validRows.forEach((row) => {
    const key = classKey(row);
    const current = map.get(key);

    if (!current) {
      map.set(key, {
        key,
        faculty: row.faculty,
        code: row.code,
        subject: row.subject,
        teacher: row.teacher,
        startDate: row.startDate,
        endDate: row.endDate,
        slots: [
          {
            day: row.day,
            room: row.room,
            startTime: row.startTime,
            endTime: row.endTime,
          },
        ],
      });
      return;
    }

    const candidateSlot: ClassSlot = {
      day: row.day,
      room: row.room,
      startTime: row.startTime,
      endTime: row.endTime,
    };

    if (!current.slots.some((slot) => slotKey(slot) === slotKey(candidateSlot))) {
      current.slots.push(candidateSlot);
    }
  });

  return [...map.values()];
};

const buildExistingRowsByClassId = (events: ExistingEvent[]) => {
  const map = new Map<string, ParsedScheduleRowPayload[]>();

  events.forEach((event) => {
    const row: ParsedScheduleRowPayload = {
      faculty: event.faculty,
      code: event.code,
      subject: event.subject,
      teacher: event.teacher,
      startDate: event.startDate,
      endDate: event.endDate,
      day: event.day,
      room: event.room,
      startTime: event.start,
      endTime: event.end,
    };

    const list = map.get(event.classId) ?? [];
    list.push(row);
    map.set(event.classId, list);
  });

  return map;
};

const formatExistingClassSlots = (events: ExistingEvent[]) => {
  const slots: ClassSlot[] = events.map((event) => ({
    day: cleanDisplayText(event.day),
    room: cleanDisplayText(event.room),
    startTime: event.start,
    endTime: event.end,
  }));

  return formatSlots(slots);
};

const buildExistingLabelByClassId = (events: ExistingEvent[]) => {
  const grouped = new Map<string, ExistingEvent[]>();

  events.forEach((event) => {
    const current = grouped.get(event.classId) ?? [];
    current.push(event);
    grouped.set(event.classId, current);
  });

  const labels = new Map<string, string>();
  for (const [classId, rows] of grouped.entries()) {
    const first = rows[0];
    if (!first) continue;

    labels.set(
      classId,
      `${cleanDisplayText(first.code)} | ${cleanDisplayText(first.subject)} | ${cleanDisplayText(first.teacher)} | ${formatExistingClassSlots(rows)} | ${first.startDate} a ${first.endDate}`
    );
  }

  return labels;
};

const detectConflicts = (uploadedClasses: ClassBlock[], existingEvents: ExistingEvent[]): ReviewClass[] => {
  const conflictsMap = new Map<string, ConflictInfo[]>();
  const existingLabelByClassId = buildExistingLabelByClassId(existingEvents);

  const addConflict = (key: string, conflict: ConflictInfo) => {
    const current = conflictsMap.get(key) ?? [];
    const alreadyExists = current.some((item) => {
      if (item.type !== conflict.type) return false;

      if (conflict.type === "existing") {
        return (
          !!item.existingClassId &&
          !!conflict.existingClassId &&
          item.existingClassId === conflict.existingClassId
        );
      }

      return item.label === conflict.label;
    });

    if (!alreadyExists) {
      current.push(conflict);
      conflictsMap.set(key, current);
    }
  };

  uploadedClasses.forEach((uploaded) => {
    uploaded.slots.forEach((slot) => {
      const normalizedRoom = normalizeRoomForCompare(slot.room);
      const normalizedDay = normalizeText(slot.day);
      const slotStart = toMinutes(slot.startTime);
      const slotEnd = toMinutes(slot.endTime);

      existingEvents.forEach((existing) => {
        // The same class should not conflict against itself during replacement analysis.
        if (isSameClassIdentity(uploaded, existing)) return;

        if (normalizeRoomForCompare(existing.room) !== normalizedRoom) return;
        if (normalizeText(existing.day) !== normalizedDay) return;

        const overlapTime = rangesOverlap(slotStart, slotEnd, toMinutes(existing.start), toMinutes(existing.end));
        if (!overlapTime) return;

        const overlapDate = dateRangesOverlap(uploaded.startDate, uploaded.endDate, existing.startDate, existing.endDate);
        if (!overlapDate) return;

        // If incoming row is exactly the same class occurrence already in DB, treat it as unchanged.
        if (isSameScheduledOccurrence(uploaded, slot, existing)) return;

        const label =
          existingLabelByClassId.get(existing.classId) ??
          `${cleanDisplayText(existing.code)} | ${cleanDisplayText(existing.subject)} | ${cleanDisplayText(existing.teacher)} | ${cleanDisplayText(existing.day)} ${existing.start}-${existing.end} (${cleanDisplayText(existing.room)}) | ${existing.startDate} a ${existing.endDate}`;
        addConflict(uploaded.key, {
          type: "existing",
          label,
          overlapLabel: `${cleanDisplayText(existing.day)} ${existing.start}-${existing.end} (${cleanDisplayText(existing.room)})`,
          existingClassId: existing.classId,
        });
      });
    });
  });

  for (let i = 0; i < uploadedClasses.length; i++) {
    for (let j = i + 1; j < uploadedClasses.length; j++) {
      const left = uploadedClasses[i];
      const right = uploadedClasses[j];
      if (!left || !right) continue;

      const dateOverlap = dateRangesOverlap(left.startDate, left.endDate, right.startDate, right.endDate);
      if (!dateOverlap) continue;

      let classOverlap = false;
      for (const leftSlot of left.slots) {
        for (const rightSlot of right.slots) {
          if (normalizeRoomForCompare(leftSlot.room) !== normalizeRoomForCompare(rightSlot.room)) continue;
          if (normalizeText(leftSlot.day) !== normalizeText(rightSlot.day)) continue;

          const overlapTime = rangesOverlap(
            toMinutes(leftSlot.startTime),
            toMinutes(leftSlot.endTime),
            toMinutes(rightSlot.startTime),
            toMinutes(rightSlot.endTime)
          );

          if (overlapTime) {
            classOverlap = true;
            break;
          }
        }

        if (classOverlap) break;
      }

      if (classOverlap) {
        addConflict(left.key, { type: "import", label: `${right.code} | ${right.subject}` });
        addConflict(right.key, { type: "import", label: `${left.code} | ${left.subject}` });
      }
    }
  }

  return uploadedClasses.map((item) => {
    const conflicts = conflictsMap.get(item.key) ?? [];
    return {
      ...item,
      conflicts,
      decision: conflicts.length ? "pending" : "accept",
    };
  });
};

const formatSlots = (slots: ClassSlot[]) => {
  const sorted = [...slots].sort((a, b) => {
    const dayDelta = (daySortOrder[a.day] ?? 99) - (daySortOrder[b.day] ?? 99);
    if (dayDelta !== 0) return dayDelta;
    const roomDelta = a.room.localeCompare(b.room, "es");
    if (roomDelta !== 0) return roomDelta;
    return toMinutes(a.startTime) - toMinutes(b.startTime);
  });

  const merged: Array<ClassSlot> = [];
  sorted.forEach((slot) => {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.day === slot.day &&
      last.room === slot.room &&
      toMinutes(last.endTime) === toMinutes(slot.startTime)
    ) {
      last.endTime = slot.endTime;
      return;
    }

    merged.push({ ...slot });
  });

  return merged.map((slot) => `${slot.day} ${slot.startTime}-${slot.endTime} (${slot.room})`).join(" | ");
};

const dedupeRows = (rows: ParsedScheduleRowPayload[]) => {
  const seen = new Set<string>();
  const output: ParsedScheduleRowPayload[] = [];

  rows.forEach((row) => {
    const key = [
      row.faculty,
      row.code,
      row.subject,
      row.teacher,
      row.startDate,
      row.endDate,
      row.day,
      row.room,
      row.startTime,
      row.endTime,
    ].join("|");

    if (seen.has(key)) return;
    seen.add(key);
    output.push(row);
  });

  return output;
};

const rowSignatureSet = (rows: ParsedScheduleRowPayload[]) => new Set(rows.flatMap(expandedRowSignatures));

const areRowSetsEqual = (leftRows: ParsedScheduleRowPayload[], rightRows: ParsedScheduleRowPayload[]) => {
  const left = rowSignatureSet(leftRows);
  const right = rowSignatureSet(rightRows);

  if (left.size !== right.size) return false;
  for (const key of left) {
    if (!right.has(key)) {
      return false;
    }
  }

  return true;
};

const buildRowsByClassKey = (rows: ParsedScheduleRowPayload[]) => {
  const map = new Map<string, ParsedScheduleRowPayload[]>();

  rows.forEach((row) => {
    const key = classKey(row);
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  });

  return map;
};

const formatHistoryDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDisplayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatDisplayDateRange = (startDate: string, endDate: string) => {
  return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
};

const formatConflictsSummary = (detected: number, accepted: number, rejected: number) => {
  if (detected === 0) return "Sin conflictos detectados";
  return `${detected} detectados | ${accepted} aceptados | ${rejected} rechazados`;
};

const formatImportStatus = (status: string) => {
  if (status === "manual-clear") return "Horario Eliminado";
  if (status === "success") return "Exitoso";
  return status;
};

const personalizeAnalyzeError = (rawMessage: string) => {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("no se encontraron hojas validas con nombre de dia para importar")) {
    return "No pudimos leer el Excel porque las hojas no tienen nombres válidos de día.\n\nRenombra las hojas como: Lunes, Martes, Miércoles/Miercoles, Jueves y Viernes.\nSi importas CSV, selecciona el día en el campo 'Día del CSV'.";
  }

  return rawMessage;
};

export default function ExcelImportPage() {
  const router = useRouter();
  const authSession = useMemo(() => readAuthSession(), []);
  const canImportExcel = authSession?.role === "admin";

  useEffect(() => {
    if (!authSession) {
      router.replace("/login");
      return;
    }

    if (!canImportExcel) {
      router.replace("/");
    }
  }, [authSession, canImportExcel, router]);

  if (!authSession || !canImportExcel) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Acceso restringido. Solo el perfil Administrador puede importar archivos Excel.
        </div>
      </div>
    );
  }

  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fallbackDay, setFallbackDay] = useState<(typeof WEEK_DAYS)[number]>("Lunes");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [invalidSheetNamesError, setInvalidSheetNamesError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse["import"] | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    active: false,
    percent: 0,
    stage: "",
    detail: "",
  });

  const [reviewClasses, setReviewClasses] = useState<ReviewClass[]>([]);
  const [rowsByClassKey, setRowsByClassKey] = useState<Map<string, ParsedScheduleRowPayload[]>>(new Map());
  const [existingRowsByClassKey, setExistingRowsByClassKey] = useState<Map<string, ParsedScheduleRowPayload[]>>(new Map());
  const [deletedClassDecisions, setDeletedClassDecisions] = useState<Record<string, DeletedClassDecision>>({});
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualRows, setManualRows] = useState<ManualEntryRow[]>([createEmptyManualEntry()]);
  const [manualNotice, setManualNotice] = useState<string | null>(null);

  const [importsHistory, setImportsHistory] = useState<ImportHistoryItem[]>([]);

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

    if (isAnalyzing) {
      return {
        name: selectedFile.name,
        detail: `Analizando archivo - ${formatFileSize(selectedFile.size)}`,
      };
    }

    if (pageError) {
      return {
        name: selectedFile.name,
        detail: `Archivo con errores de formato - ${formatFileSize(selectedFile.size)}`,
      };
    }

    if (hasAnalyzed) {
      return {
        name: selectedFile.name,
        detail: `Archivo validado - ${formatFileSize(selectedFile.size)}`,
      };
    }

    return {
      name: selectedFile.name,
      detail: `Archivo seleccionado - ${formatFileSize(selectedFile.size)}`,
    };
  }, [selectedFile, isAnalyzing, pageError, hasAnalyzed]);

  const conflictClasses = useMemo(() => reviewClasses.filter((item) => item.conflicts.length > 0), [reviewClasses]);
  const nonConflictClasses = useMemo(() => reviewClasses.filter((item) => item.conflicts.length === 0), [reviewClasses]);

  const pendingConflictCount = useMemo(
    () => conflictClasses.filter((item) => item.decision === "pending").length,
    [conflictClasses]
  );

  const acceptedConflictCount = useMemo(
    () => conflictClasses.filter((item) => item.decision === "accept").length,
    [conflictClasses]
  );

  const rejectedConflictCount = useMemo(
    () => conflictClasses.filter((item) => item.decision === "reject").length,
    [conflictClasses]
  );

  const unchangedClassKeys = useMemo(() => {
    const keys = new Set<string>();

    rowsByClassKey.forEach((uploadedRows, key) => {
      const existingRows = existingRowsByClassKey.get(key) ?? [];
      if (existingRows.length > 0 && areRowSetsEqual(uploadedRows, existingRows)) {
        keys.add(key);
      }
    });

    return keys;
  }, [rowsByClassKey, existingRowsByClassKey]);

  const visibleReviewClasses = useMemo(
    () => reviewClasses.filter((item) => !unchangedClassKeys.has(item.key)),
    [reviewClasses, unchangedClassKeys]
  );

  const visibleConflictClasses = useMemo(
    () => visibleReviewClasses.filter((item) => item.conflicts.length > 0),
    [visibleReviewClasses]
  );

  const visibleNonConflictClasses = useMemo(
    () => visibleReviewClasses.filter((item) => item.conflicts.length === 0),
    [visibleReviewClasses]
  );

  const changedClassKeys = useMemo(() => {
    const keys = new Set<string>();

    rowsByClassKey.forEach((uploadedRows, key) => {
      const existingRows = existingRowsByClassKey.get(key) ?? [];
      if (existingRows.length > 0 && !areRowSetsEqual(uploadedRows, existingRows)) {
        keys.add(key);
      }
    });

    return keys;
  }, [rowsByClassKey, existingRowsByClassKey]);

  const deletedReviewClasses = useMemo(() => {
    const rowsToDelete: ParsedScheduleRowPayload[] = [];

    existingRowsByClassKey.forEach((existingRows, key) => {
      if (!rowsByClassKey.has(key)) {
        rowsToDelete.push(...existingRows);
      }
    });

    return buildClassBlocks(rowsToDelete).map((item) => ({
      ...item,
      conflicts: [],
      decision: "accept" as ConflictDecision,
    }));
  }, [existingRowsByClassKey, rowsByClassKey]);

  useEffect(() => {
    setDeletedClassDecisions((current) => {
      const next: Record<string, DeletedClassDecision> = {};
      deletedReviewClasses.forEach((item) => {
        next[item.key] = current[item.key] ?? "pending";
      });
      return next;
    });
  }, [deletedReviewClasses]);

  const actionableReviewClasses = visibleReviewClasses;

  const effectiveImportClassCount = useMemo(
    () =>
      actionableReviewClasses.filter(
        (item) => item.conflicts.length === 0 || item.decision === "accept"
      ).length,
    [actionableReviewClasses]
  );

  const pendingDeletedCount = useMemo(
    () => deletedReviewClasses.filter((item) => (deletedClassDecisions[item.key] ?? "pending") === "pending").length,
    [deletedReviewClasses, deletedClassDecisions]
  );

  const deletedClassKeysToDelete = useMemo(
    () =>
      new Set(
        deletedReviewClasses
          .filter((item) => (deletedClassDecisions[item.key] ?? "pending") === "delete")
          .map((item) => item.key)
      ),
    [deletedReviewClasses, deletedClassDecisions]
  );

  const hasEffectiveChanges = effectiveImportClassCount > 0 || deletedClassKeysToDelete.size > 0;

  const canConfirmImport =
    !isImporting &&
    ((manualMode && hasAnalyzed && manualRows.length > 0) ||
      (hasAnalyzed && hasEffectiveChanges && visibleConflictClasses.filter((item) => item.decision === "pending").length === 0 && pendingDeletedCount === 0));

  const orderedPreviewRows = useMemo(() => {
    // Keep conflicts grouped first but stable in-place so rows do not "disappear" on decision click.
    return [...visibleConflictClasses, ...visibleNonConflictClasses];
  }, [visibleConflictClasses, visibleNonConflictClasses]);

  const previewRows = useMemo<PreviewRow[]>(
    () => [
      ...orderedPreviewRows.map((item) => ({ item, rowType: "upsert" as const })),
      ...deletedReviewClasses.map((item) => ({ item, rowType: "deleted" as const })),
    ],
    [orderedPreviewRows, deletedReviewClasses]
  );

  const previousSlotsByClassKey = useMemo(() => {
    const map = new Map<string, string>();
    existingRowsByClassKey.forEach((rows, key) => {
      const blocks = buildClassBlocks(rows);
      const first = blocks[0];
      if (first) {
        map.set(key, formatSlots(first.slots));
      }
    });
    return map;
  }, [existingRowsByClassKey]);

  const latestImportsHistory = useMemo(() => importsHistory.slice(0, 10), [importsHistory]);

  const loadImportsHistory = async () => {
    try {
      const response = await fetchApiJson<ImportsHistoryResponse>("/api/schedules/imports-history");
      setImportsHistory(response.imports ?? []);
    } catch {
      setImportsHistory([]);
    }
  };

  useEffect(() => {
    void loadImportsHistory();
  }, []);

  const analyzeRowsAgainstCurrentSchedule = async (parsedRows: ParsedScheduleRowPayload[]) => {
    const validParsedRows = parsedRows.filter((row) => isValidOfficialRoom(row.room));
    const classRowsMap = buildRowsByClassKey(validParsedRows);

    const classBlocks = buildClassBlocks(validParsedRows);
    const existing = await fetchApiJson<ExistingEventsResponse>("/api/schedules/events");
    const reviewed = detectConflicts(classBlocks, existing.events ?? []);

    const existingNormalRows = (existing.events ?? [])
      .filter((event) => event.reservationType === "normal")
      .map((event) => ({
        faculty: event.faculty,
        code: event.code,
        subject: event.subject,
        teacher: event.teacher,
        startDate: event.startDate,
        endDate: event.endDate,
        day: event.day,
        room: event.room,
        startTime: event.start,
        endTime: event.end,
      }))
      .filter((row) => isValidOfficialRoom(row.room));

    return {
      reviewed,
      classRowsMap,
      existingRowsByClassKeyMap: buildRowsByClassKey(existingNormalRows),
    };
  };

  const analyzeProvidedFile = async (file: File, csvFallbackDay?: (typeof WEEK_DAYS)[number]) => {
    setIsAnalyzing(true);
    setPageError(null);
    setImportResult(null);

    try {
      const parsedRows = await parseScheduleWorkbookClient(file, {
        fallbackDay: file.name.toLowerCase().endsWith(".csv") ? csvFallbackDay : undefined,
      });

      const analysis = await analyzeRowsAgainstCurrentSchedule(parsedRows);
      setReviewClasses(analysis.reviewed);
      setRowsByClassKey(analysis.classRowsMap);
      setExistingRowsByClassKey(analysis.existingRowsByClassKeyMap);
      setHasAnalyzed(true);
      setManualMode(false);
      setManualNotice(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo analizar el archivo";
      const friendlyMessage = personalizeAnalyzeError(message);
      const isMissingColumns = message.includes("Faltan columnas requeridas");
      const isInvalidSheetNames = friendlyMessage.includes("Renombra las hojas como:");

      if (isInvalidSheetNames) {
        setInvalidSheetNamesError("No pudimos leer el Excel porque las hojas no tienen nombres válidos de día.");
        setHasAnalyzed(false);
        setReviewClasses([]);
        setRowsByClassKey(new Map());
        setExistingRowsByClassKey(new Map());
        setManualMode(false);
        setManualNotice(null);
        setPageError(null);
      } else if (isMissingColumns) {
        setManualMode(true);
        setManualRows([createEmptyManualEntry()]);
        setReviewClasses([]);
        setRowsByClassKey(new Map());
        setExistingRowsByClassKey(new Map());
        setHasAnalyzed(true);
        setManualNotice(
          "No se detectaron columnas estandar. Completa los datos faltantes directamente en Schedule Data Preview."
        );
        setPageError(null);
      } else {
        setPageError(friendlyMessage);
        setHasAnalyzed(false);
        setReviewClasses([]);
        setRowsByClassKey(new Map());
        setExistingRowsByClassKey(new Map());
        setManualMode(false);
        setManualNotice(null);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processFile = async (file: File | null) => {
    if (!file) return;

    if (!isExcelFile(file)) {
      const message = "Formato no permitido. Solo se aceptan archivos .xls, .xlsx o .csv.";
      setFileError(message);
      toast.error(message);
      return;
    }

    setSelectedFile(file);
    setFileError(null);
    setPageError(null);
    setInvalidSheetNamesError(null);
    setImportResult(null);
    setReviewClasses([]);
    setRowsByClassKey(new Map());
    setExistingRowsByClassKey(new Map());
    setHasAnalyzed(false);
    setManualMode(false);
    setManualRows([createEmptyManualEntry()]);
    setManualNotice(null);

    await analyzeProvidedFile(file, fallbackDay);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    void processFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    void processFile(file);
  };

  useEffect(() => {
    if (!selectedFile || !selectedFile.name.toLowerCase().endsWith(".csv")) return;
    if (!hasAnalyzed) return;

    void analyzeProvidedFile(selectedFile, fallbackDay);
  }, [fallbackDay]);

  const setConflictDecision = (classKeyValue: string, decision: ConflictDecision) => {
    console.debug("[Excel Import] conflict decision changed", { classKeyValue, decision });
    setReviewClasses((current) =>
      current.map((item) => {
        if (item.key !== classKeyValue) return item;
        return { ...item, decision };
      })
    );
  };

  const setDeletedClassDecision = (classKeyValue: string, decision: DeletedClassDecision) => {
    console.debug("[Excel Import] deleted class decision changed", { classKeyValue, decision });
    setDeletedClassDecisions((current) => ({
      ...current,
      [classKeyValue]: decision,
    }));
  };

  const clearImport = () => {
    setSelectedFile(null);
    setFileError(null);
    setPageError(null);
    setInvalidSheetNamesError(null);
    setImportResult(null);
    setReviewClasses([]);
    setRowsByClassKey(new Map());
    setExistingRowsByClassKey(new Map());
    setDeletedClassDecisions({});
    setHasAnalyzed(false);
    setManualMode(false);
    setManualRows([createEmptyManualEntry()]);
    setManualNotice(null);
  };

  const handleConfirmImport = async () => {
    setIsImporting(true);
    setPageError(null);
    setInvalidSheetNamesError(null);
    setImportProgress({
      active: true,
      percent: 5,
      stage: "Preparando importacion",
      detail: "Verificando conflictos y datos finales...",
    });

    try {
      let workingReviewClasses = reviewClasses;
      let workingRowsByClassKey = rowsByClassKey;
      let workingExistingRowsByClassKey = existingRowsByClassKey;

      if (manualMode) {
        const manualParsedRows = manualRows.map((row, index) => toParsedRowFromManual(row, index));
        const analysis = await analyzeRowsAgainstCurrentSchedule(manualParsedRows);

        workingReviewClasses = analysis.reviewed;
        workingRowsByClassKey = analysis.classRowsMap;
        workingExistingRowsByClassKey = analysis.existingRowsByClassKeyMap;

        setReviewClasses(analysis.reviewed);
        setRowsByClassKey(analysis.classRowsMap);
        setExistingRowsByClassKey(analysis.existingRowsByClassKeyMap);
        setManualMode(false);
      }

      if (!hasAnalyzed && !manualMode) {
        throw new Error("Debes adjuntar un archivo valido antes de confirmar.");
      }

      const reviewClassesForValidation = workingReviewClasses.filter((item) => !unchangedClassKeys.has(item.key));
      const workingConflictClasses = reviewClassesForValidation.filter((item) => item.conflicts.length > 0);
      const workingPending = workingConflictClasses.filter((item) => item.decision === "pending").length;
      const workingAccepted = workingConflictClasses.filter((item) => item.decision === "accept").length;
      const workingRejected = workingConflictClasses.filter((item) => item.decision === "reject").length;

      const workingRowsToDelete: ParsedScheduleRowPayload[] = [];
      workingExistingRowsByClassKey.forEach((existingRows, key) => {
        if (!workingRowsByClassKey.has(key)) {
          workingRowsToDelete.push(...existingRows);
        }
      });

      const workingDeletedReviewClasses = buildClassBlocks(workingRowsToDelete);
      const workingPendingDeleted = workingDeletedReviewClasses.filter(
        (item) => (deletedClassDecisions[item.key] ?? "pending") === "pending"
      ).length;

      console.debug("[Excel Import] validation state", {
        mode: manualMode ? "manual" : "file",
        reviewClassesCount: workingReviewClasses.length,
        reviewClassesForValidationCount: reviewClassesForValidation.length,
        pendingConflictCount: workingPending,
        acceptedConflictCount: workingAccepted,
        rejectedConflictCount: workingRejected,
        pendingDeletedCount: workingPendingDeleted,
        deletedDecisionMap: deletedClassDecisions,
      });

      if (workingPending > 0) {
        throw new Error("Debes revisar todos los conflictos antes de confirmar la importacion.");
      }

      if (workingPendingDeleted > 0) {
        throw new Error("Debes decidir qué hacer con todas las clases que no aparecen en el Excel (conservar o eliminar).");
      }

      const rejectedClasses = reviewClassesForValidation.filter((item) => item.conflicts.length > 0 && item.decision === "reject");
      const keptClasses = reviewClassesForValidation.filter(
        (item) => item.conflicts.length === 0 || item.decision === "accept"
      );

      const deletedClassesToKeep = workingDeletedReviewClasses.filter(
        (item) => (deletedClassDecisions[item.key] ?? "pending") === "keep"
      );

      const newRows = keptClasses.flatMap((item) => workingRowsByClassKey.get(item.key) ?? []);
      const oldRows = rejectedClasses.flatMap((item) => workingExistingRowsByClassKey.get(item.key) ?? []);
      const oldRowsFromKeptDeleted = deletedClassesToKeep.flatMap(
        (item) => workingExistingRowsByClassKey.get(item.key) ?? []
      );
      const finalRows = dedupeRows([...newRows, ...oldRows, ...oldRowsFromKeptDeleted]);
      const totalRowsToSend = finalRows.length;

      console.groupCollapsed("[Excel Import] Confirmación");
      console.log("Archivo:", selectedFile?.name ?? "archivo.xlsx");
      console.log("Clases analizadas:", workingReviewClasses.length);
      console.log("Clases nuevas/aceptadas:", keptClasses.length);
      console.log("Clases rechazadas (se conservan viejas):", rejectedClasses.length);
      console.log("Clases no encontradas en Excel:", workingDeletedReviewClasses.length);
      console.log("Clases no encontradas que se conservarán:", deletedClassesToKeep.length);
      console.log("Filas finales a enviar:", totalRowsToSend);
      console.log("Primeras filas finales:", finalRows.slice(0, 10));
      console.groupEnd();

      setImportProgress({
        active: true,
        percent: 15,
        stage: "Payload listo",
        detail: `Registros a enviar: ${totalRowsToSend}`,
      });

      const requestBody = JSON.stringify({
        sourceFile: selectedFile?.name ?? "archivo.xlsx",
        rows: finalRows,
        meta: {
          conflictsDetected: workingConflictClasses.length,
          conflictsAccepted: workingAccepted,
          conflictsRejected: workingRejected,
          importedBy: "excel-import-ui",
        },
      });

      if (!authSession?.accessToken) {
        throw new Error("Sesión no válida. Inicia sesión nuevamente.");
      }

      console.groupCollapsed("[Excel Import] import request");
      console.log("POST /api/schedules/import-parsed");
      console.log("Auth present:", Boolean(authSession.accessToken));
      console.log("Role:", authSession.role);
      console.log("Payload rows:", finalRows.length);
      console.log("Payload meta:", {
        conflictsDetected: workingConflictClasses.length,
        conflictsAccepted: workingAccepted,
        conflictsRejected: workingRejected,
        deletedPending: workingPendingDeleted,
      });
      console.groupEnd();

      setImportProgress({
        active: true,
        percent: 35,
        stage: "Procesando servidor",
        detail: "El horario está siendo actualizado. Puede tardar algunos segundos...",
      });

      const progressTimer = setInterval(() => {
        setImportProgress((current) => {
          if (current.percent >= 80) return current;

          return {
            ...current,
            percent: current.percent + 5,
            detail: "Validando clases y guardando cambios...",
          };
        });
      }, 3000);

      
      const body = await fetchApiJson<ImportResponse>("/api/schedules/import-parsed", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.accessToken}`,
        },
        body: requestBody,
      });

      setImportProgress({
        active: true,
        percent: 85,
        stage: "Procesando importacion",
        detail: "El servidor está aplicando los cambios en la base de datos.",
      });

      setImportResult(body.import);
      setHasAnalyzed(true);
      setImportProgress({
        active: true,
        percent: 100,
        stage: "Importacion completada",
        detail: `Se procesaron ${body.import.rowsCount} registros`,
      });

      setSelectedFile(null);
      setReviewClasses([]);
      setRowsByClassKey(new Map());
      setExistingRowsByClassKey(new Map());
      setDeletedClassDecisions({});
      setHasAnalyzed(false);
      setManualMode(false);
      setManualRows([createEmptyManualEntry()]);

      await loadImportsHistory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al importar el archivo";
      setPageError(message);
      setImportProgress({
        active: false,
        percent: 0,
        stage: "",
        detail: "",
      });
    } finally {
      setIsImporting(false);
      setTimeout(() => {
        setImportProgress((current) =>
          current.percent === 100
            ? { active: false, percent: 0, stage: "", detail: "" }
            : current
        );
      }, 1200);
    }
  };

  return (
    <div className="bg-background-light p-8 dark:bg-background-dark">
      {invalidSheetNamesError ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white shadow-2xl dark:border-red-800 dark:bg-slate-900">
            <div className="border-b border-red-200 bg-red-50 px-6 py-5 dark:border-red-800 dark:bg-red-900/30">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-red-600 dark:text-red-400">error</span>
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Excel con nombre de hojas inválidas</h3>
              </div>
            </div>
            <div className="space-y-4 px-6 py-6">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{invalidSheetNamesError}</p>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/30">
                <p className="mb-2 text-xs font-bold text-blue-900 dark:text-blue-300">Las hojas deben llamarse exactamente:</p>
                <ul className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
                  <li>✓ <span className="font-semibold">Lunes</span></li>
                  <li>✓ <span className="font-semibold">Martes</span></li>
                  <li>✓ <span className="font-semibold">Miércoles</span> o <span className="font-semibold">Miercoles</span></li>
                  <li>✓ <span className="font-semibold">Jueves</span></li>
                  <li>✓ <span className="font-semibold">Viernes</span></li>
                </ul>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Si tu archivo es CSV (un solo día), selecciona el día en el campo "Día del CSV" debajo del selector de archivo.
              </p>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => {
                  setInvalidSheetNamesError(null);
                  setSelectedFile(null);
                }}
                className="w-full rounded-lg bg-primary px-4 py-2 font-semibold text-white transition-all hover:bg-primary/90"
              >
                Entendido, cargar otro archivo
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">Importar Horario</h2>
          <p className="text-slate-500 dark:text-slate-400">
            El archivo se transforma en el frontend y el backend solo recibe datos listos para guardar.
          </p>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
          <span className="material-symbols-outlined mt-0.5 text-amber-600 dark:text-amber-500">warning</span>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">Advertencia: Superponer Datos</h4>
            <p className="mt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-500">
              Este flujo permite revisar conflictos antes de confirmar. Si cancelas, no se sube ningún cambio.
            </p>
          </div>
        </div>

        <div>
          <div
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white p-6 text-center transition-all dark:bg-slate-900/50 ${
              isDragOver ? "border-[#295786] bg-[#295786]/5" : "border-primary/30 dark:border-primary/40"
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
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              .xlsx con 5 hojas (Lunes-Viernes) en orden fijo. CSV solo para un día.
            </p>

            {fileError ? <p className="mt-2 rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700">{fileError}</p> : null}

            <button
              type="button"
              className="mt-4 text-sm font-semibold text-primary hover:underline dark:text-blue-400"
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
            >
              Cambiar archivo
            </button>

            {isCsvFile ? (
              <div className="mt-4 flex w-full max-w-sm items-center justify-center gap-2 rounded-md bg-slate-50 p-2">
                <label className="text-xs font-semibold text-slate-600">Día del CSV:</label>
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

            {isAnalyzing ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/85 backdrop-blur-[1px] dark:bg-slate-900/85">
                <span className="material-symbols-outlined animate-spin text-3xl text-[#295786]">progress_activity</span>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Procesando archivo...</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Transformando datos y detectando conflictos</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Clases Totales</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{hasAnalyzed ? previewRows.length : "-"}</h4>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Clases con conflictos</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{hasAnalyzed ? conflictClasses.length : "-"}</h4>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Días Laborales</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">Lun - Vie</h4>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Rango Horario</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">6AM - 10PM</h4>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-wider text-slate-900 uppercase dark:text-slate-100">Vista Previa de Datos del Horario</h3>

            {hasAnalyzed ? (
              manualMode ? (
                <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Completa los campos faltantes
                </div>
              ) :
              conflictClasses.length === 0 && pendingDeletedCount === 0 ? (
                <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Sin conflictos ni eliminaciones pendientes
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Revisión pendiente
                </div>
              )
            ) : (
              <div className="text-xs text-slate-500">Aún no hay análisis del archivo</div>
            )}
          </div>

          <div className="overflow-x-auto">
            {manualMode ? (
              <div className="p-4">
                {manualNotice ? (
                  <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{manualNotice}</p>
                ) : null}
                <p className="mb-3 text-sm text-amber-700">
                  Completa las columnas faltantes aquí. Luego presiona &quot;Confirmar Importación de Horario&quot; para validar conflictos y guardar.
                </p>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-2 py-2">Facultad</th>
                      <th className="px-2 py-2">Código</th>
                      <th className="px-2 py-2">Asignatura</th>
                      <th className="px-2 py-2">Docente</th>
                      <th className="px-2 py-2">Fecha Inicio</th>
                      <th className="px-2 py-2">Fecha Fin</th>
                      <th className="px-2 py-2">Día</th>
                      <th className="px-2 py-2">Salón</th>
                      <th className="px-2 py-2">Inicio</th>
                      <th className="px-2 py-2">Fin</th>
                      <th className="px-2 py-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {manualRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-2 py-2"><input className="w-40 rounded border border-slate-300 px-2 py-1" value={row.faculty} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, faculty: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input className="w-28 rounded border border-slate-300 px-2 py-1" value={row.code} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, code: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input className="w-44 rounded border border-slate-300 px-2 py-1" value={row.subject} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, subject: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input className="w-44 rounded border border-slate-300 px-2 py-1" value={row.teacher} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, teacher: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input placeholder="YYYY-MM-DD" className="w-32 rounded border border-slate-300 px-2 py-1" value={row.startDate} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, startDate: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input placeholder="YYYY-MM-DD" className="w-32 rounded border border-slate-300 px-2 py-1" value={row.endDate} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, endDate: e.target.value } : item))} /></td>
                        <td className="px-2 py-2">
                          <select className="w-28 rounded border border-slate-300 px-2 py-1" value={row.day} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, day: e.target.value } : item))}>
                            {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => (
                              <option key={`${row.id}-${day}`} value={day}>{day}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2"><input className="w-44 rounded border border-slate-300 px-2 py-1" value={row.room} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, room: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input placeholder="HH:MM" className="w-24 rounded border border-slate-300 px-2 py-1" value={row.startTime} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, startTime: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input placeholder="HH:MM" className="w-24 rounded border border-slate-300 px-2 py-1" value={row.endTime} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, endTime: e.target.value } : item))} /></td>
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600"
                            onClick={() => setManualRows((all) => all.filter((item) => item.id !== row.id))}
                            disabled={manualRows.length <= 1}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  className="mt-3 rounded border border-primary px-3 py-1.5 text-xs font-semibold text-primary"
                  onClick={() => setManualRows((all) => [...all, createEmptyManualEntry()])}
                >
                  Agregar fila manual
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3">Clase</th>
                    <th className="px-6 py-3">Facultad</th>
                    <th className="px-6 py-3">Bloques</th>
                    <th className="px-6 py-3 min-w-[260px]">Rango fechas</th>
                    <th className="px-6 py-3">Conflictos</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.length ? (
                    previewRows.map((row) => {
                      const item = row.item;
                      const isDeleted = row.rowType === "deleted";
                      const isConflict = !isDeleted && item.conflicts.length > 0;
                      const isChanged = !isDeleted && changedClassKeys.has(item.key);
                      const previousSlots = previousSlotsByClassKey.get(item.key);
                      const deletedDecision = deletedClassDecisions[item.key] ?? "pending";

                      return (
                        <tr
                          key={`${row.rowType}-${item.key}`}
                          className={
                            isDeleted
                              ? "bg-rose-50/30"
                              : isConflict
                                ? "bg-amber-50/40"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                          }
                        >
                          <td className="px-6 py-4 font-medium">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{item.code} | {item.subject}</div>
                            <div className="text-xs text-slate-500">{item.teacher}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{item.faculty}</td>
                          <td className="px-6 py-4 text-xs text-slate-600">{formatSlots(item.slots)}</td>
                          <td className="px-6 py-4 text-xs text-slate-600 whitespace-normal leading-5">
                            {formatDisplayDateRange(item.startDate, item.endDate)}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {isDeleted ? (
                              <div className="space-y-1">
                                <div>
                                  <span className="font-semibold text-rose-700">Clase no encontrada en el Excel:</span>{" "}
                                  ¿Deseas conservarla en el sistema o eliminarla del horario normal?
                                </div>
                              </div>
                            ) : isConflict ? (
                              <div className="space-y-1">
                                <div>
                                  <span className="font-semibold text-blue-700">Nueva propuesta:</span>{" "}
                                  {item.code} | {item.subject} | {item.teacher} | {formatSlots(item.slots)} | {formatDisplayDateRange(item.startDate, item.endDate)}
                                </div>
                                {item.conflicts.map((conflict, idx) => (
                                  <div key={`${item.key}-conflict-${idx}`}>
                                    <span className="font-semibold text-rose-700">
                                      {conflict.type === "existing" ? "Clase actual:" : "Otra clase nueva:"}
                                    </span>{" "}
                                    {conflict.type === "existing" ? (
                                      <>
                                        Choca en {conflict.overlapLabel ?? "bloque no identificado"}.<br />
                                        <span className="text-slate-500">Detalle clase: {conflict.label}</span>
                                      </>
                                    ) : (
                                      conflict.label
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : isChanged ? (
                              <div className="space-y-1">
                                <div>
                                  <span className="font-semibold text-blue-700">Clase cambiada:</span>{" "}
                                  Se actualizará con nuevo bloque.
                                </div>
                                {previousSlots ? (
                                  <div>
                                    <span className="font-semibold text-slate-700">Antes:</span> {previousSlots}
                                  </div>
                                ) : null}
                                <div>
                                  <span className="font-semibold text-emerald-700">Ahora:</span> {formatSlots(item.slots)}
                                </div>
                              </div>
                            ) : (
                              "Clase nueva"
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isDeleted ? (
                              deletedDecision === "pending" ? (
                                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 uppercase">Pendiente</span>
                              ) : deletedDecision === "delete" ? (
                                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 uppercase">Eliminar</span>
                              ) : (
                                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700 uppercase">Conservar</span>
                              )
                            ) : !isConflict ? (
                              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 uppercase">
                                {isChanged ? "Cambiada" : "Nueva"}
                              </span>
                            ) : item.decision === "pending" ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 uppercase">Pendiente</span>
                            ) : item.decision === "accept" ? (
                              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 uppercase">Aceptado</span>
                            ) : (
                              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700 uppercase">Rechazado</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isDeleted ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className={`inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
                                    deletedDecision === "keep"
                                      ? "border-slate-700 bg-slate-200 text-slate-800 ring-2 ring-slate-400"
                                      : "border-slate-300 text-slate-600"
                                  }`}
                                  title="Conservar esta clase aunque no aparezca en el Excel"
                                  onClick={() => setDeletedClassDecision(item.key, "keep")}
                                >
                                  Conservar
                                </button>
                                <button
                                  type="button"
                                  className={`inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
                                    deletedDecision === "delete"
                                      ? "border-red-700 bg-red-200 text-red-800 ring-2 ring-red-400"
                                      : "border-slate-300 text-slate-600"
                                  }`}
                                  title="Eliminar esta clase porque no aparece en el Excel"
                                  onClick={() => setDeletedClassDecision(item.key, "delete")}
                                >
                                  Eliminar
                                </button>
                              </div>
                            ) : isConflict ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${
                                    item.decision === "accept"
                                      ? "border-green-700 bg-green-200 text-green-800 ring-2 ring-green-400"
                                      : "border-slate-300 text-slate-500"
                                  }`}
                                  title="Aceptar nuevo solapamiento"
                                  onClick={() => setConflictDecision(item.key, "accept")}
                                >
                                  <span className="material-symbols-outlined text-[18px]">check</span>
                                </button>
                                <button
                                  type="button"
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${
                                    item.decision === "reject"
                                      ? "border-red-700 bg-red-200 text-red-800 ring-2 ring-red-400"
                                      : "border-slate-300 text-slate-500"
                                  }`}
                                  title="Rechazar y mantener horario anterior"
                                  onClick={() => setConflictDecision(item.key, "reject")}
                                >
                                  <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                          {hasAnalyzed
                            ? "No hay clases nuevas, eliminadas o cambiadas para mostrar."
                            : "Carga un archivo para ver la visualización automáticamente."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 py-6 dark:border-slate-800">
          <div className="flex w-full flex-col items-center gap-4">
            <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!canConfirmImport}
                className="rounded-lg bg-primary px-8 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? "Importando..." : "Confirmar Importación de Horario"}
              </button>

              <button
                type="button"
                onClick={clearImport}
                className="rounded-lg px-8 py-3 font-bold text-slate-600 transition-all hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancelar Importación
              </button>
            </div>

            {importProgress.active ? (
              <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">{importProgress.stage}</p>
                  <p className="text-xs font-semibold text-slate-500">{importProgress.percent}%</p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-[#295786] transition-all duration-300"
                    style={{ width: `${importProgress.percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">{importProgress.detail}</p>
                {importProgress.percent >= 98 ? (
                  <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                    Esta fase puede tardar. Es normal y no significa que el sistema se haya caído.
                  </p>
                ) : null}
              </div>
            ) : null}

            {hasAnalyzed && (visibleConflictClasses.length > 0 || pendingDeletedCount > 0) ? (
              <p className="max-w-lg text-center text-sm text-amber-700">
                Debes revisar {visibleConflictClasses.filter((item) => item.decision === "pending").length} conflictos y {pendingDeletedCount} clases no encontradas en el Excel antes de continuar.
              </p>
            ) : null}

            {hasAnalyzed && visibleConflictClasses.length === 0 && pendingDeletedCount === 0 ? (
              <p className="max-w-lg text-center text-sm text-green-700">Sin conflictos ni eliminaciones pendientes.</p>
            ) : null}

            {hasAnalyzed && !manualMode && !hasEffectiveChanges ? (
              <p className="max-w-lg text-center text-sm text-slate-600">
                No hay cambios para importar. El archivo coincide con el horario actual.
              </p>
            ) : null}

            {importResult ? (
              <p className="max-w-lg rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-700">
                Importación exitosa: {importResult.rowsCount} filas procesadas, {importResult.classesCount} clases y {importResult.slotsCount} bloques.
              </p>
            ) : null}

            {pageError ? (
              <p className="max-w-lg rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700">{pageError}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 pt-10">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Historial de Importaciones Anteriores</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Archivo Fuente</th>
                  <th className="px-6 py-3">Clases</th>
                  <th className="px-6 py-3">Conflictos</th>
                  <th className="px-6 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {latestImportsHistory.length ? (
                  latestImportsHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 text-slate-500">{formatHistoryDate(item.imported_at)}</td>
                      <td className="px-6 py-4">{item.source_file}</td>
                      <td className="px-6 py-4">{item.classes_count}</td>
                      <td className="px-6 py-4">
                        {formatConflictsSummary(
                          item.conflicts_detected,
                          item.conflicts_accepted,
                          item.conflicts_rejected
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 uppercase dark:bg-green-900/30 dark:text-green-400">
                          {formatImportStatus(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No hay historial de importaciones todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
