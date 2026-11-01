import { getSupabase } from "./supabase";
import {
  TEAMS,
  shiftMonthKey,
  type AttendanceRecord,
  type TeamValues,
} from "./attendance";

const TABLE = "daily_attendance";
const TEAM_COLUMNS = TEAMS.map((t) => t.key).join(",");

/** Returns the saved team values for a date, or null if no record exists. */
export async function fetchAttendance(
  isoDate: string
): Promise<TeamValues | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select(TEAM_COLUMNS)
    .eq("attendance_date", isoDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as TeamValues | null) ?? null;
}

/**
 * Inserts a new record, or updates the existing one for that date.
 * Never deletes: the database has no delete policy.
 */
export async function saveAttendance(
  isoDate: string,
  values: TeamValues
): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .upsert(
      { attendance_date: isoDate, ...values },
      { onConflict: "attendance_date" }
    );

  if (error) throw new Error(error.message);
}

/** All records for a month (YYYY-MM), oldest first. */
export async function fetchMonth(monthKey: string): Promise<AttendanceRecord[]> {
  const start = `${monthKey}-01`;
  const end = `${shiftMonthKey(monthKey, 1)}-01`;
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select(`attendance_date,${TEAM_COLUMNS}`)
    .gte("attendance_date", start)
    .lt("attendance_date", end)
    .order("attendance_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as unknown as AttendanceRecord[] | null) ?? [];
}

/**
 * Deletes the record for a date. Requires the "anon can delete attendance"
 * policy from supabase/schema.sql. Row Level Security hides rows without a
 * policy, so a 0-row result means the delete was not allowed (or no record).
 */
export async function deleteAttendance(isoDate: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq("attendance_date", isoDate)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Nothing was deleted. Deleting may not be allowed in the database yet.");
  }
}
