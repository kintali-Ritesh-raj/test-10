import { getSupabase } from "./supabase";
import { TEAMS, type TeamValues } from "./attendance";

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
