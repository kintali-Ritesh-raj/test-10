// Shared constants, date helpers and attendance calculations.

export const TEAMS = [
  { key: "anandapuram", label: "Anandapuram" },
  { key: "slg", label: "SLG" },
  { key: "madam", label: "Madam" },
  { key: "kothavalasa", label: "Kothavalasa" },
  { key: "airport", label: "Airport" },
  { key: "dj", label: "Dj" },
] as const;

export type TeamKey = (typeof TEAMS)[number]["key"];

/** A team value is "Leave" or a whole number 0-100, stored as text. */
export type TeamValue = string;

export type TeamValues = Record<TeamKey, TeamValue>;

export const LEAVE = "Leave";

/** Dropdown options: "0".."100" then "Leave". */
export const TEAM_OPTIONS: string[] = [
  ...Array.from({ length: 101 }, (_, i) => String(i)),
  LEAVE,
];

/** Earliest allowed attendance date (21/10/2026). */
export const MIN_DATE_ISO = "2026-10-21";

// ---- Dates: plain strings only, never shifted through JS Date/timezones ----

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidIsoDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  // Days in month, computed in UTC so local timezone cannot interfere.
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** YYYY-MM-DD -> DD/MM/YYYY. Returns "" if the input is not a valid date. */
export function isoToDisplay(iso: string): string {
  if (!isValidIsoDate(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** DD/MM/YYYY -> YYYY-MM-DD. Returns null if not a valid calendar date. */
export function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** Keeps digits only and inserts slashes as the user types: 01012026 -> 01/01/2026. */
export function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  return parts.filter((p) => p.length > 0).join("/");
}

/** Today in the user's local timezone as YYYY-MM-DD. */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Error message for a bad attendance date, or null if it is allowed. */
export function validateAttendanceDate(iso: string | null): string | null {
  if (iso === null) return "Enter a valid date as DD/MM/YYYY.";
  if (iso < MIN_DATE_ISO) {
    return `Attendance cannot be recorded before ${isoToDisplay(MIN_DATE_ISO)}.`;
  }
  return null;
}

// ---- Calculations ----------------------------------------------------------

/** One saved day: the date (YYYY-MM-DD) plus the six team values. */
export type AttendanceRecord = TeamValues & { attendance_date: string };

/**
 * Workers for one team value. "Leave" counts as 0. Anything that is not a
 * whole number from 0 to 100 also counts as 0 (the database rejects those).
 */
export function teamWorkers(value: TeamValue): number {
  if (!/^(100|[1-9][0-9]|[0-9])$/.test(value)) return 0;
  return Number(value);
}

/** Sum of numeric team values for one day (Leave = 0). */
export function dailyTotal(values: TeamValues): number {
  return TEAMS.reduce((sum, t) => sum + teamWorkers(values[t.key]), 0);
}

/** Number of teams with more than 0 workers. */
export function teamsWorking(values: TeamValues): number {
  return TEAMS.filter((t) => teamWorkers(values[t.key]) > 0).length;
}

/** Number of teams marked "Leave". */
export function teamsOnLeave(values: TeamValues): number {
  return TEAMS.filter((t) => values[t.key] === LEAVE).length;
}

// ---- Months: "YYYY-MM" keys, shown to the user as MM/YYYY ----

/** True for a month key like "2026-10" with a month from 01 to 12. */
export function isValidMonthKey(key: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return false;
  const month = Number(m[2]);
  return month >= 1 && month <= 12;
}

/** YYYY-MM-DD -> YYYY-MM. Returns "" for an invalid date. */
export function isoToMonthKey(iso: string): string {
  return isValidIsoDate(iso) ? iso.slice(0, 7) : "";
}

/** YYYY-MM -> MM/YYYY. Returns "" for an invalid key. */
export function monthKeyToDisplay(key: string): string {
  if (!isValidMonthKey(key)) return "";
  const [y, m] = key.split("-");
  return `${m}/${y}`;
}

/** MM/YYYY -> YYYY-MM. Returns null if invalid. */
export function displayToMonthKey(display: string): string | null {
  const m = /^(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const key = `${m[2]}-${m[1]}`;
  return isValidMonthKey(key) ? key : null;
}

/** Records whose date falls in the month (YYYY-MM). */
export function recordsInMonth(
  records: AttendanceRecord[],
  monthKey: string
): AttendanceRecord[] {
  return records.filter((r) => isoToMonthKey(r.attendance_date) === monthKey);
}

/** Monthly worker-days: the sum of every daily total in the month. */
export function monthlyWorkerDays(
  records: AttendanceRecord[],
  monthKey: string
): number {
  return recordsInMonth(records, monthKey).reduce(
    (sum, r) => sum + dailyTotal(r),
    0
  );
}

/** Worker-days per team for the month (Leave = 0). */
export function monthlyTeamTotals(
  records: AttendanceRecord[],
  monthKey: string
): Record<TeamKey, number> {
  const totals = Object.fromEntries(TEAMS.map((t) => [t.key, 0])) as Record<
    TeamKey,
    number
  >;
  for (const r of recordsInMonth(records, monthKey)) {
    for (const t of TEAMS) totals[t.key] += teamWorkers(r[t.key]);
  }
  return totals;
}

/** Daily totals for the month in date order, for the trend chart. */
export function dailyTrend(
  records: AttendanceRecord[],
  monthKey: string
): { date: string; total: number }[] {
  return recordsInMonth(records, monthKey)
    .map((r) => ({ date: r.attendance_date, total: dailyTotal(r) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ---- Month input helpers (dashboard) ----

/** Earliest month with data (10/2026). */
export const MIN_MONTH_KEY = MIN_DATE_ISO.slice(0, 7);

/** Keeps digits only and inserts a slash as the user types: 102026 -> 10/2026. */
export function formatMonthInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  return [digits.slice(0, 2), digits.slice(2, 6)]
    .filter((p) => p.length > 0)
    .join("/");
}

/** Moves a YYYY-MM key forward or back by whole months. */
export function shiftMonthKey(key: string, delta: number): string {
  if (!isValidMonthKey(key)) return key;
  const [y, m] = key.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}

/** Error message for a bad month, or null if it is allowed. */
export function validateMonth(key: string | null): string | null {
  if (key === null) return "Enter a month as MM/YYYY.";
  if (key < MIN_MONTH_KEY) {
    return `No data before ${monthKeyToDisplay(MIN_MONTH_KEY)}.`;
  }
  return null;
}
