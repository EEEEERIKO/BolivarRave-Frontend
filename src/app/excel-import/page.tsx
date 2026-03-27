"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { ParsedScheduleRowPayload, parseScheduleWorkbookClient } from "@/lib/schedule-parser";
import { fetchApiJson } from "@/lib/api-client";

const EXCEL_EXTENSIONS = [".xlsx", ".xls"];
const CSV_EXTENSIONS = [".csv"];
const EXCEL_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
];
const WEEK_DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"] as const;

type ExistingEvent = {
  id: string;
  classId: string;
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

const normalizeRoomForCompare = (value: string) =>
  {
    const normalized = normalizeText(value)
      .replace(/[()]/g, " ")
      .replace(/\bmd\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/^laboratorio de (analisis de datos y )?simulacion financiera( 403)?$/.test(normalized)) {
      return "laboratorio de simulacion financiera 403";
    }

    if (/^laboratorio de desarrollo de software( lds)?( 404)?$/.test(normalized)) {
      return "laboratorio de desarrollo de software lds 404";
    }

    if (/^laboratorio de fisica( 405)?$/.test(normalized)) {
      return "laboratorio de fisica 405";
    }

    if (/^laboratorio de musica( 308)?$/.test(normalized)) {
      return "laboratorio de musica 308";
    }

    if (/^laboratorio de infantil( 204)?$/.test(normalized)) {
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
  Miercoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sabado: 6,
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
  const map = new Map<string, ClassBlock>();

  rows.forEach((row) => {
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

export default function ExcelImportPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fallbackDay, setFallbackDay] = useState<(typeof WEEK_DAYS)[number]>("Lunes");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse["import"] | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    active: false,
    percent: 0,
    stage: "",
    detail: "",
  });

  const [reviewClasses, setReviewClasses] = useState<ReviewClass[]>([]);
  const [rowsByClassKey, setRowsByClassKey] = useState<Map<string, ParsedScheduleRowPayload[]>>(new Map());
  const [existingRowsByClassId, setExistingRowsByClassId] = useState<Map<string, ParsedScheduleRowPayload[]>>(new Map());
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

    return {
      name: selectedFile.name,
      detail: `Archivo cargado - ${formatFileSize(selectedFile.size)}`,
    };
  }, [selectedFile]);

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

    reviewClasses.forEach((item) => {
      const existingClassId = findUnchangedExistingClassId(
        rowsByClassKey.get(item.key) ?? [],
        existingRowsByClassId
      );

      if (existingClassId) {
        keys.add(item.key);
      }
    });

    return keys;
  }, [reviewClasses, rowsByClassKey, existingRowsByClassId]);

  const actionableReviewClasses = useMemo(
    () => reviewClasses.filter((item) => !unchangedClassKeys.has(item.key)),
    [reviewClasses, unchangedClassKeys]
  );

  const effectiveImportClassCount = useMemo(
    () =>
      actionableReviewClasses.filter(
        (item) => item.conflicts.length === 0 || item.decision === "accept"
      ).length,
    [actionableReviewClasses]
  );

  const canConfirmImport =
    !isImporting &&
    ((manualMode && hasAnalyzed && manualRows.length > 0) ||
      (hasAnalyzed && effectiveImportClassCount > 0 && pendingConflictCount === 0));

  const orderedPreviewRows = useMemo(() => {
    // Keep conflicts grouped first but stable in-place so rows do not "disappear" on decision click.
    return [...conflictClasses, ...nonConflictClasses].filter((item) => !unchangedClassKeys.has(item.key));
  }, [conflictClasses, nonConflictClasses, unchangedClassKeys]);

  const loadImportsHistory = async () => {
    try {
      const response = await fetchApiJson<ImportsHistoryResponse>("/api/schedules/imports-history");
      setImportsHistory(response.imports ?? []);
    } catch {
      setImportsHistory([]);
    }
  };

  useEffect(() => {
    loadImportsHistory();
  }, []);

  const analyzeRowsAgainstCurrentSchedule = async (parsedRows: ParsedScheduleRowPayload[]) => {
    const classRowsMap = new Map<string, ParsedScheduleRowPayload[]>();
    parsedRows.forEach((row) => {
      const key = classKey(row);
      const current = classRowsMap.get(key) ?? [];
      current.push(row);
      classRowsMap.set(key, current);
    });

    const classBlocks = buildClassBlocks(parsedRows);
    const existing = await fetchApiJson<ExistingEventsResponse>("/api/schedules/events");
    const reviewed = detectConflicts(classBlocks, existing.events ?? []);

    return {
      reviewed,
      classRowsMap,
      existingRowsMap: buildExistingRowsByClassId(existing.events ?? []),
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
      setExistingRowsByClassId(analysis.existingRowsMap);
      setHasAnalyzed(true);
      setManualMode(false);
      setManualNotice(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo analizar el archivo";
      const isMissingColumns = message.includes("Faltan columnas requeridas");

      if (isMissingColumns) {
        setManualMode(true);
        setManualRows([createEmptyManualEntry()]);
        setReviewClasses([]);
        setRowsByClassKey(new Map());
        setExistingRowsByClassId(new Map());
        setHasAnalyzed(true);
        setManualNotice(
          "No se detectaron columnas estandar. Completa los datos faltantes directamente en Schedule Data Preview."
        );
        setPageError(null);
      } else {
        setPageError(message);
        setHasAnalyzed(false);
        setReviewClasses([]);
        setRowsByClassKey(new Map());
        setExistingRowsByClassId(new Map());
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
      window.alert(message);
      return;
    }

    setSelectedFile(file);
    setFileError(null);
    setPageError(null);
    setImportResult(null);
    setReviewClasses([]);
    setRowsByClassKey(new Map());
    setExistingRowsByClassId(new Map());
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
    setReviewClasses((current) =>
      current.map((item) => {
        if (item.key !== classKeyValue) return item;
        return { ...item, decision };
      })
    );
  };

  const clearImport = () => {
    setSelectedFile(null);
    setFileError(null);
    setPageError(null);
    setImportResult(null);
    setReviewClasses([]);
    setRowsByClassKey(new Map());
    setExistingRowsByClassId(new Map());
    setHasAnalyzed(false);
    setManualMode(false);
    setManualRows([createEmptyManualEntry()]);
    setManualNotice(null);
  };

  const handleConfirmImport = async () => {
    setIsImporting(true);
    setPageError(null);
    setImportProgress({
      active: true,
      percent: 5,
      stage: "Preparando importacion",
      detail: "Verificando conflictos y datos finales...",
    });

    try {
      let workingReviewClasses = reviewClasses;
      let workingRowsByClassKey = rowsByClassKey;
      let workingExistingRowsByClassId = existingRowsByClassId;

      if (manualMode) {
        const manualParsedRows = manualRows.map((row, index) => toParsedRowFromManual(row, index));
        const analysis = await analyzeRowsAgainstCurrentSchedule(manualParsedRows);

        workingReviewClasses = analysis.reviewed;
        workingRowsByClassKey = analysis.classRowsMap;
        workingExistingRowsByClassId = analysis.existingRowsMap;

        setReviewClasses(analysis.reviewed);
        setRowsByClassKey(analysis.classRowsMap);
        setExistingRowsByClassId(analysis.existingRowsMap);
        setManualMode(false);
      }

      if (!hasAnalyzed && !manualMode) {
        throw new Error("Debes adjuntar un archivo valido antes de confirmar.");
      }

      const workingConflictClasses = workingReviewClasses.filter((item) => item.conflicts.length > 0);
      const workingPending = workingConflictClasses.filter((item) => item.decision === "pending").length;
      const workingAccepted = workingConflictClasses.filter((item) => item.decision === "accept").length;
      const workingRejected = workingConflictClasses.filter((item) => item.decision === "reject").length;

      const unchangedPairs = workingReviewClasses
        .map((item) => ({
          classKey: item.key,
          existingClassId: findUnchangedExistingClassId(
            workingRowsByClassKey.get(item.key) ?? [],
            workingExistingRowsByClassId
          ),
        }))
        .filter((item) => !!item.existingClassId) as Array<{ classKey: string; existingClassId: string }>;

      const unchangedClassKeys = new Set(unchangedPairs.map((item) => item.classKey));
      const unchangedExistingIds = new Set(unchangedPairs.map((item) => item.existingClassId));

      if (workingPending > 0) {
        throw new Error("Debes revisar todos los conflictos antes de confirmar la importacion.");
      }

      const keptNewClasses = workingReviewClasses.filter(
        (item) => !unchangedClassKeys.has(item.key) && (item.conflicts.length === 0 || item.decision === "accept")
      );
      const rejectedClasses = workingReviewClasses.filter((item) => item.conflicts.length > 0 && item.decision === "reject");

      if (keptNewClasses.length === 0) {
        setImportProgress({ active: false, percent: 0, stage: "", detail: "" });
        throw new Error("No hay clases nuevas o modificadas para importar.");
      }

      const oldIdsOverriddenByAccepted = new Set(
        keptNewClasses.flatMap((item) =>
          item.conflicts
            .filter((conflict) => conflict.type === "existing" && conflict.existingClassId)
            .map((conflict) => conflict.existingClassId as string)
        )
      );

      const oldIdsToKeep = new Set(
        rejectedClasses.flatMap((item) =>
          item.conflicts
            .filter((conflict) => conflict.type === "existing" && conflict.existingClassId)
            .map((conflict) => conflict.existingClassId as string)
        )
      );

      unchangedExistingIds.forEach((id) => oldIdsToKeep.add(id));

      oldIdsOverriddenByAccepted.forEach((id) => oldIdsToKeep.delete(id));

      const newRows = keptNewClasses.flatMap((item) => workingRowsByClassKey.get(item.key) ?? []);
      const oldRows = [...oldIdsToKeep].flatMap((oldClassId) => workingExistingRowsByClassId.get(oldClassId) ?? []);
      const finalRows = dedupeRows([...newRows, ...oldRows]);
      const totalRowsToSend = finalRows.length;

      if (!finalRows.length) {
        setImportProgress({ active: false, percent: 0, stage: "", detail: "" });
        throw new Error("No quedaron filas para importar despues de resolver conflictos.");
      }

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

      const body = await new Promise<ImportResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let processingTicker: ReturnType<typeof setInterval> | null = null;
        let processingStartedAt = 0;

        const stopTicker = () => {
          if (processingTicker) {
            clearInterval(processingTicker);
            processingTicker = null;
          }
        };

        xhr.open("POST", "/api/schedules/import-parsed", true);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) {
            setImportProgress({
              active: true,
              percent: 45,
              stage: "Enviando al servidor",
              detail: `Registros por procesar: ~${totalRowsToSend}`,
            });
            return;
          }

          const uploadRatio = event.total > 0 ? event.loaded / event.total : 0;
          const percent = Math.min(80, 20 + Math.round(uploadRatio * 60));
          const pending = Math.max(0, Math.ceil((1 - uploadRatio) * totalRowsToSend));

          setImportProgress({
            active: true,
            percent,
            stage: "Enviando al servidor",
            detail: `Registros por enviar: ${pending}`,
          });
        };

        xhr.upload.onload = () => {
          processingStartedAt = Date.now();
          setImportProgress({
            active: true,
            percent: 86,
            stage: "Servidor recibio el archivo",
            detail: "Procesando importacion en base de datos. Es normal que esta etapa tarde con archivos grandes.",
          });

          processingTicker = setInterval(() => {
            setImportProgress((current) => {
              if (!current.active) return current;
              const elapsedSeconds = Math.floor((Date.now() - processingStartedAt) / 1000);
              const next =
                elapsedSeconds < 20
                  ? Math.min(95, Math.max(current.percent, 86) + 1)
                  : elapsedSeconds < 60
                    ? Math.min(98, Math.max(current.percent, 95) + 1)
                    : Math.min(99, Math.max(current.percent, 98) + 1);

              const detail =
                elapsedSeconds < 20
                  ? "Insertando eventos y bloques en base de datos..."
                  : elapsedSeconds < 60
                    ? "Aplicando reemplazos y validaciones finales... Es normal que demore unos segundos."
                    : `Finalizando confirmacion del servidor... (${elapsedSeconds}s). Es normal esta demora, por favor espera.`;

              return {
                active: true,
                percent: next,
                stage: "Aplicando cambios en base de datos",
                detail,
              };
            });
          }, 900);
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 2 || xhr.readyState === 3) {
            setImportProgress((current) => ({
              active: true,
              percent: Math.max(current.percent, 85),
              stage: "Aplicando cambios en base de datos",
              detail: "Guardando eventos y horarios. No cierres la pagina: el proceso sigue activo.",
            }));
          }
        };

        xhr.onerror = () => {
          stopTicker();
          reject(new Error("Error de red durante la importacion"));
        };

        xhr.onabort = () => {
          stopTicker();
          reject(new Error("La importacion fue cancelada"));
        };

        xhr.onload = () => {
          stopTicker();
          const text = xhr.responseText ?? "";

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = JSON.parse(text) as ImportResponse;
              resolve(parsed);
            } catch {
              reject(new Error("Respuesta invalida del servidor al importar"));
            }
            return;
          }

          try {
            const parsed = JSON.parse(text) as { error?: string };
            reject(new Error(parsed.error ?? `Error ${xhr.status} al importar`));
          } catch {
            reject(new Error(`Error ${xhr.status} al importar`));
          }
        };

        xhr.send(requestBody);
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
      setExistingRowsByClassId(new Map());
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
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">Import Schedule</h2>
          <p className="text-slate-500 dark:text-slate-400">
            El archivo se transforma en el frontend y el backend solo recibe datos listos para guardar.
          </p>
        </div>

        <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
          <span className="material-symbols-outlined mt-0.5 text-amber-600 dark:text-amber-500">warning</span>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400">Warning: Data Override</h4>
            <p className="mt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-500">
              Este flujo permite revisar conflictos antes de confirmar. Si cancelas, no se sube ningun cambio.
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
              .xlsx con 5 hojas (Lunes-Viernes) en orden fijo. CSV solo para un dia.
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
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Total Classes</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{hasAnalyzed ? reviewClasses.length : "-"}</h4>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-1 text-xs font-bold tracking-widest text-slate-500 uppercase">Clases con conflictos</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white">{hasAnalyzed ? conflictClasses.length : "-"}</h4>
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

            {hasAnalyzed ? (
              manualMode ? (
                <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Complete missing fields
                </div>
              ) :
              conflictClasses.length === 0 ? (
                <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  No conflicts detected
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Conflicts detected
                </div>
              )
            ) : (
              <div className="text-xs text-slate-500">Aun no hay analisis del archivo</div>
            )}
          </div>

          <div className="overflow-x-auto">
            {manualMode ? (
              <div className="p-4">
                {manualNotice ? (
                  <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">{manualNotice}</p>
                ) : null}
                <p className="mb-3 text-sm text-amber-700">
                  Completa las columnas faltantes aqui. Luego presiona "Confirm Schedule Import" para validar conflictos y guardar.
                </p>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-2 py-2">Faculty</th>
                      <th className="px-2 py-2">Code</th>
                      <th className="px-2 py-2">Subject</th>
                      <th className="px-2 py-2">Teacher</th>
                      <th className="px-2 py-2">Start Date</th>
                      <th className="px-2 py-2">End Date</th>
                      <th className="px-2 py-2">Day</th>
                      <th className="px-2 py-2">Room</th>
                      <th className="px-2 py-2">Start</th>
                      <th className="px-2 py-2">End</th>
                      <th className="px-2 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {manualRows.map((row, index) => (
                      <tr key={row.id}>
                        <td className="px-2 py-2"><input className="w-40 rounded border border-slate-300 px-2 py-1" value={row.faculty} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, faculty: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input className="w-28 rounded border border-slate-300 px-2 py-1" value={row.code} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, code: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input className="w-44 rounded border border-slate-300 px-2 py-1" value={row.subject} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, subject: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input className="w-44 rounded border border-slate-300 px-2 py-1" value={row.teacher} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, teacher: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input placeholder="YYYY-MM-DD" className="w-32 rounded border border-slate-300 px-2 py-1" value={row.startDate} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, startDate: e.target.value } : item))} /></td>
                        <td className="px-2 py-2"><input placeholder="YYYY-MM-DD" className="w-32 rounded border border-slate-300 px-2 py-1" value={row.endDate} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, endDate: e.target.value } : item))} /></td>
                        <td className="px-2 py-2">
                          <select className="w-28 rounded border border-slate-300 px-2 py-1" value={row.day} onChange={(e) => setManualRows((all) => all.map((item) => item.id === row.id ? { ...item, day: e.target.value } : item))}>
                            {["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"].map((day) => (
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
                    <th className="px-6 py-3">Class</th>
                    <th className="px-6 py-3">Faculty</th>
                    <th className="px-6 py-3">Slots</th>
                    <th className="px-6 py-3 min-w-[260px]">Rango fechas</th>
                    <th className="px-6 py-3">Conflicts</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orderedPreviewRows.length ? (
                    orderedPreviewRows.map((item) => {
                      const isConflict = item.conflicts.length > 0;
                      return (
                        <tr key={item.key} className={isConflict ? "bg-amber-50/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"}>
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
                            {isConflict ? (
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
                            ) : (
                              "Sin conflicto"
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {!isConflict ? (
                              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 uppercase">Ready</span>
                            ) : item.decision === "pending" ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 uppercase">Pendiente</span>
                            ) : item.decision === "accept" ? (
                              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 uppercase">Aceptado</span>
                            ) : (
                              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700 uppercase">Rechazado</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isConflict ? (
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
                            ? "No hay clases nuevas o modificadas para mostrar."
                            : "Carga un archivo para ver la previsualizacion automaticamente."}
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
                {isImporting ? "Importando..." : "Confirm Schedule Import"}
              </button>

              <button
                type="button"
                onClick={clearImport}
                className="rounded-lg px-8 py-3 font-bold text-slate-600 transition-all hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancel Import
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
                    Esta fase puede tardar. Es normal y no significa que el sistema se haya caido.
                  </p>
                ) : null}
              </div>
            ) : null}

            {hasAnalyzed && conflictClasses.length > 0 ? (
              <p className="max-w-lg text-center text-sm text-amber-700">
                Conflicts detected. Debes aceptar o rechazar los {pendingConflictCount} conflictos pendientes para continuar.
              </p>
            ) : null}

            {hasAnalyzed && conflictClasses.length === 0 ? (
              <p className="max-w-lg text-center text-sm text-green-700">No conflicts detected.</p>
            ) : null}

            {hasAnalyzed && !manualMode && effectiveImportClassCount === 0 ? (
              <p className="max-w-lg text-center text-sm text-slate-600">
                No hay cambios para importar. El archivo coincide con el horario actual.
              </p>
            ) : null}

            {importResult ? (
              <p className="max-w-lg rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-700">
                Importacion exitosa: {importResult.rowsCount} filas procesadas, {importResult.classesCount} clases y {importResult.slotsCount} bloques.
              </p>
            ) : null}

            {pageError ? (
              <p className="max-w-lg rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700">{pageError}</p>
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
                  <th className="px-6 py-3">Source File</th>
                  <th className="px-6 py-3">Classes</th>
                  <th className="px-6 py-3">Conflicts</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {importsHistory.length ? (
                  importsHistory.map((item) => (
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
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No hay historial de imports todavia.
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
