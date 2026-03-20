import * as XLSX from "xlsx";

export type ParsedScheduleRowPayload = {
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

const REQUIRED_FIELDS = [
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
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

const COLUMN_ALIASES: Record<RequiredField, string[]> = {
  faculty: ["facultad", "faculty"],
  code: ["codigo", "code", "codigo materia", "nrc"],
  subject: ["materia", "asignatura", "subject", "nombre materia"],
  teacher: ["docente", "profesor", "teacher"],
  startDate: ["fecha inicio", "inicio", "start date"],
  endDate: ["fecha fin", "fin", "end date"],
  day: ["dia", "dia semana", "day"],
  room: ["salon", "aula", "room", "espacio"],
  startTime: ["hora inicio", "inicio hora", "start time"],
  endTime: ["hora fin", "fin hora", "end time"],
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const pad2 = (value: number) => String(value).padStart(2, "0");

const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const excelSerialToDate = (serial: number) => {
  const date = new Date(Date.UTC(1899, 11, 30));
  date.setUTCDate(date.getUTCDate() + serial);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const parseDateIso = (value: unknown): string => {
  if (value instanceof Date) {
    return toIsoDate(new Date(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  if (typeof value === "number") {
    return toIsoDate(excelSerialToDate(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return trimmed;

    const latin = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (latin) {
      const [, d, m, y] = latin;
      return `${y}-${m}-${d}`;
    }

    const parts = trimmed.split(/[\/-]/).map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      const [a, b, c] = parts as [number, number, number];
      if (a > 1900) return `${a}-${pad2(b)}-${pad2(c)}`;
      return `${c}-${pad2(b)}-${pad2(a)}`;
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return toIsoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    }
  }

  throw new Error(`No se pudo interpretar la fecha: ${String(value)}`);
};

const toHHMM = (value: unknown): string => {
  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${pad2(hours)}:${pad2(minutes)}`;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      return `${pad2(Number(match[1]))}:${match[2]}`;
    }
  }

  throw new Error(`No se pudo interpretar la hora: ${String(value)}`);
};

const toRangeStartHHMM = (value: unknown): string => {
  if (typeof value === "string" && value.includes("-")) {
    const [start] = value.split("-");
    return toHHMM((start ?? "").trim());
  }

  return toHHMM(value);
};

const normalizeDay = (value: string): string => {
  const day = normalize(value);
  if (day.startsWith("lun")) return "Lunes";
  if (day.startsWith("mar")) return "Martes";
  if (day.startsWith("mie")) return "Miercoles";
  if (day.startsWith("jue")) return "Jueves";
  if (day.startsWith("vie")) return "Viernes";
  if (day.startsWith("sab")) return "Sabado";
  if (day.startsWith("dom")) return "Domingo";
  return value.trim();
};

const validDay = (value: string) =>
  ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"].includes(value);

const normalizeSheetDay = (sheetName: string, fallbackDay?: string) => {
  const fromSheet = normalizeDay(sheetName);
  if (validDay(fromSheet)) return fromSheet;

  if (fallbackDay) {
    const fallback = normalizeDay(fallbackDay);
    if (validDay(fallback)) return fallback;
  }

  throw new Error(
    `No se pudo determinar el dia para la hoja '${sheetName}'. Usa nombres de hoja Lunes..Viernes o selecciona el dia para CSV.`
  );
};

const findColumnMap = (headers: string[]) => {
  const normalizedHeaders = headers.map((h) => normalize(h));
  const map = new Map<RequiredField, string>();

  REQUIRED_FIELDS.forEach((field) => {
    const aliases = COLUMN_ALIASES[field].map(normalize);
    const idx = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (idx >= 0) {
      const headerName = headers[idx];
      if (headerName) map.set(field, headerName);
    }
  });

  const missing = REQUIRED_FIELDS.filter((field) => !map.has(field));
  if (missing.length) {
    throw new Error(`Faltan columnas requeridas: ${missing.join(", ")}`);
  }

  return map;
};

const parseNormalizedSheet = (sheet: XLSX.WorkSheet, sheetName: string): ParsedScheduleRowPayload[] => {
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  if (!rawRows.length) return [];
  const headers = Object.keys(rawRows[0] ?? {});
  const columnMap = findColumnMap(headers);

  return rawRows.map((row, idx) => {
    const parsed: ParsedScheduleRowPayload = {
      faculty: String(row[columnMap.get("faculty")!] ?? "").trim(),
      code: String(row[columnMap.get("code")!] ?? "").trim(),
      subject: String(row[columnMap.get("subject")!] ?? "").trim(),
      teacher: String(row[columnMap.get("teacher")!] ?? "").trim(),
      startDate: parseDateIso(row[columnMap.get("startDate")!]),
      endDate: parseDateIso(row[columnMap.get("endDate")!]),
      day: normalizeDay(String(row[columnMap.get("day")!] ?? "")),
      room: String(row[columnMap.get("room")!] ?? "").trim(),
      startTime: toHHMM(row[columnMap.get("startTime")!]),
      endTime: toHHMM(row[columnMap.get("endTime")!]),
    };

    if (!parsed.faculty || !parsed.code || !parsed.subject || !parsed.teacher || !parsed.room) {
      throw new Error(`Fila ${idx + 2} invalida en hoja '${sheetName}'`);
    }

    if (!validDay(parsed.day)) {
      throw new Error(`Fila ${idx + 2} invalida en hoja '${sheetName}': dia no reconocido (${parsed.day})`);
    }

    return parsed;
  });
};

const parseCellClassValue = (value: string) => {
  const parts = value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 5) return null;

  const head = parts[0] ?? "";
  const separatorIdx = head.indexOf(":");
  if (separatorIdx < 0) return null;

  const faculty = head.slice(0, separatorIdx).trim();
  const code = head.slice(separatorIdx + 1).trim();
  const subject = (parts[1] ?? "").trim();
  const teacher = (parts[2] ?? "").trim();
  const startDate = parts[3];
  const endDate = parts[4];

  if (!faculty || !code || !subject || !teacher || !startDate || !endDate) return null;

  return {
    faculty,
    code,
    subject,
    teacher,
    startDate: parseDateIso(startDate),
    endDate: parseDateIso(endDate),
  };
};

const detectMatrixFormat = (sheet: XLSX.WorkSheet) => {
  const grid = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    range: 0,
  });

  const headerRow = grid[0] ?? [];
  const normalizedHeaders = headerRow.map((cell) => normalize(String(cell ?? "")));
  return normalizedHeaders.includes("hora");
};

const parseMatrixSheet = (
  sheet: XLSX.WorkSheet,
  sheetName: string,
  fallbackDay?: string
): ParsedScheduleRowPayload[] => {
  const grid = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (grid.length < 2) return [];

  const headerRow = grid[0] ?? [];
  const normalizedHeaders = headerRow.map((cell) => normalize(String(cell ?? "")));
  const hourColIndex = normalizedHeaders.findIndex((h) => h === "hora");
  if (hourColIndex < 0) throw new Error(`La hoja '${sheetName}' no tiene columna HORA`);

  const day = normalizeSheetDay(sheetName, fallbackDay);
  const rows: ParsedScheduleRowPayload[] = [];

  for (let rowIndex = 1; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex] ?? [];
    const startTimeRaw = row[hourColIndex];
    if (!String(startTimeRaw ?? "").trim()) continue;

    let startTime: string;
    try {
      startTime = toRangeStartHHMM(startTimeRaw);
    } catch {
      continue;
    }

    const [h = 0, m = 0] = startTime.split(":").map(Number);
    const endMinutes = h * 60 + m + 30;
    const endTime = `${pad2(Math.floor(endMinutes / 60))}:${pad2(endMinutes % 60)}`;

    for (let col = hourColIndex + 1; col < headerRow.length; col++) {
      const room = String(headerRow[col] ?? "").trim();
      if (!room) continue;

      const cellValue = String(row[col] ?? "").trim();
      if (!cellValue || !cellValue.includes("|")) continue;

      const parsedClass = parseCellClassValue(cellValue);
      if (!parsedClass) continue;

      rows.push({
        ...parsedClass,
        day,
        room,
        startTime,
        endTime,
      });
    }
  }

  return rows;
};

export async function parseScheduleWorkbookClient(file: File, options?: { fallbackDay?: string }) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  if (!workbook.SheetNames.length) {
    throw new Error("El archivo no contiene hojas");
  }

  const allRows: ParsedScheduleRowPayload[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = detectMatrixFormat(sheet)
      ? parseMatrixSheet(sheet, sheetName, options?.fallbackDay)
      : parseNormalizedSheet(sheet, sheetName);

    allRows.push(...rows);
  });

  if (!allRows.length) {
    throw new Error("No se encontraron clases validas para importar");
  }

  return allRows;
}
