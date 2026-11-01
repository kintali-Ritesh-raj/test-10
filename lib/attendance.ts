// Shared constants and date helpers.
// Calculation helpers (daily/monthly totals) are added in Phase 3.

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

/** Earliest allowed attendance date (21/09/2026). */
export const MIN_DATE_ISO = "2026-09-21";

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
