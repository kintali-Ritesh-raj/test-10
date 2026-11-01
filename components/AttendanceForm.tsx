"use client";

import { useEffect, useState } from "react";
import DateField from "./DateField";
import {
  MIN_DATE_ISO,
  TEAMS,
  TEAM_OPTIONS,
  displayToIso,
  isoToDisplay,
  todayIso,
  validateAttendanceDate,
  type TeamKey,
  type TeamValues,
} from "@/lib/attendance";
import {
  deleteAttendance,
  fetchAttendance,
  saveAttendance,
} from "@/lib/attendance-db";

type Mode = "idle" | "loading" | "existing" | "new" | "loadError";
type Message = { type: "success" | "error"; text: string } | null;

/** New days start with 0 workers in every team, so only changes need entering. */
const defaultValues = (): TeamValues => ({
  anandapuram: "0",
  slg: "0",
  madam: "0",
  kothavalasa: "0",
  airport: "0",
  dj: "0",
});

const fieldClass =
  "w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-navy";

export default function AttendanceForm() {
  const [dateText, setDateText] = useState("");
  const [values, setValues] = useState<TeamValues>(defaultValues);
  const [mode, setMode] = useState<Mode>("idle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [missing, setMissing] = useState<TeamKey[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Derived from the text the user sees.
  const complete = dateText.length === 10;
  const iso = complete ? displayToIso(dateText) : null;
  const dateError = complete ? validateAttendanceDate(iso) : null;
  const validIso = complete && !dateError ? iso : null;

  // Default to today, but never earlier than the first allowed date.
  useEffect(() => {
    const today = todayIso();
    setDateText(isoToDisplay(today < MIN_DATE_ISO ? MIN_DATE_ISO : today));
  }, []);

  // Whenever the date changes, check for an existing record.
  useEffect(() => {
    setMessage(null);
    setMissing([]);
    setConfirmingDelete(false);
    if (!validIso) {
      setValues(defaultValues());
      setMode("idle");
      return;
    }

    let cancelled = false; // ignore stale responses if the date changed again
    setMode("loading");
    fetchAttendance(validIso)
      .then((record) => {
        if (cancelled) return;
        setValues(record ?? defaultValues());
        setMode(record ? "existing" : "new");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setValues(defaultValues());
        setMode("loadError");
        setMessage({ type: "error", text: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [validIso]);

  function onTeamChange(key: TeamKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setMissing((m) => m.filter((k) => k !== key));
    setMessage(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !validIso) return;

    const unset = TEAMS.filter((t) => values[t.key] === "").map((t) => t.key);
    if (unset.length > 0) {
      setMissing(unset);
      setMessage({
        type: "error",
        text: "Select a value for every team (a number or Leave).",
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await saveAttendance(validIso, values);
      setMode("existing");
      setMessage({
        type: "success",
        text: `Attendance saved for ${isoToDisplay(validIso)}.`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: `Could not save: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (deleting || !validIso) return;
    setDeleting(true);
    setMessage(null);
    try {
      await deleteAttendance(validIso);
      setValues(defaultValues());
      setMode("new");
      setMessage({
        type: "success",
        text: `Attendance deleted for ${isoToDisplay(validIso)}.`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: `Could not delete: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    } finally {
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }

  const status =
    mode === "loading"
      ? "Checking for an existing record…"
      : mode === "existing"
        ? "Updating existing record"
        : mode === "new"
          ? "New record"
          : "";

  const formDisabled = !validIso || mode === "loading" || saving || deleting;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div>
        <DateField
          id="date"
          label="Date"
          value={dateText}
          onChange={setDateText}
          invalid={!!dateError}
          describedBy="date-help"
        />
        <p id="date-help" className="mt-1 text-sm text-slate-600">
          Earliest date: {isoToDisplay(MIN_DATE_ISO)}
        </p>
        {dateError && (
          <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
            {dateError}
          </p>
        )}
        <p
          role="status"
          aria-live="polite"
          className="mt-2 min-h-[1.5rem] text-sm font-semibold text-navy"
        >
          {status}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TEAMS.map((team) => {
          const isMissing = missing.includes(team.key);
          return (
            <div key={team.key}>
              <label htmlFor={team.key} className="mb-1 block font-semibold">
                {team.label}
              </label>
              <select
                id={team.key}
                value={values[team.key]}
                onChange={(e) => onTeamChange(team.key, e.target.value)}
                disabled={formDisabled}
                required
                aria-invalid={isMissing ? true : undefined}
                className={`${fieldClass} ${isMissing ? "border-red-700" : ""} disabled:bg-slate-100`}
              >
                {TEAM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div>
        <button
          type="submit"
          disabled={formDisabled}
          className="w-full rounded-md bg-accent px-5 py-3 text-base font-bold text-navy hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {saving
            ? "Saving…"
            : mode === "existing"
              ? "Update attendance"
              : "Save attendance"}
        </button>
      </div>

      {mode === "existing" && (
        <div className="border-t border-slate-300 pt-4">
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={formDisabled}
              className="rounded-md border border-red-700 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete this record
            </button>
          ) : (
            <div
              role="alertdialog"
              aria-labelledby="delete-title"
              className="rounded-md border border-red-700 bg-red-50 p-4"
            >
              <p id="delete-title" className="font-semibold text-red-900">
                Delete the attendance record for {isoToDisplay(validIso ?? "")}?
                This cannot be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="rounded-md bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="rounded-md border border-navy px-4 py-2 font-semibold text-navy hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            message.type === "success"
              ? "border-green-700 bg-green-50 text-green-900"
              : "border-red-700 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
