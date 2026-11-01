"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MIN_DATE_ISO,
  MIN_MONTH_KEY,
  TEAMS,
  dailyRows,
  dailyTotal,
  displayToIso,
  displayToMonthKey,
  formatMonthInput,
  isoToDisplay,
  isoToMonthKey,
  monthKeyToDisplay,
  monthSummary,
  shiftMonthKey,
  teamSummaries,
  teamsOnLeave,
  teamsWorking,
  todayIso,
  validateAttendanceDate,
  validateMonth,
  type AttendanceRecord,
  type TeamValues,
} from "@/lib/attendance";
import {
  deleteAttendance,
  fetchAttendance,
  fetchLatestDate,
  fetchMonth,
} from "@/lib/attendance-db";
import { downloadMonthExcel } from "@/lib/excel";
import DateField from "./DateField";

const NAVY = "#1F2A44";
const ORANGE = "#F97316";

type Load<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: T };

const messageClass = "rounded-md border px-3 py-2 text-sm font-semibold";
const th = "px-3 py-2 font-semibold";
const td = "px-3 py-2";
const num = "text-right tabular-nums";

export default function Dashboard() {
  const [dayText, setDayText] = useState("");
  const [monthText, setMonthText] = useState("");
  const [day, setDay] = useState<Load<TeamValues | null>>({ state: "idle" });
  const [month, setMonth] = useState<Load<AttendanceRecord[]>>({
    state: "idle",
  });
  const [refresh, setRefresh] = useState(0); // bump to reload after a delete
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteNote, setDeleteNote] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Day derived from the text the user sees.
  const dayIso = dayText.length === 10 ? displayToIso(dayText) : null;
  const dayError = dayText.length === 10 ? validateAttendanceDate(dayIso) : null;
  const validDay = dayText.length === 10 && !dayError ? dayIso : null;

  // Month derived the same way.
  const monthKey = monthText.length === 7 ? displayToMonthKey(monthText) : null;
  const monthError = monthText.length === 7 ? validateMonth(monthKey) : null;
  const validMonth = monthText.length === 7 && !monthError ? monthKey : null;

  // Open on the latest recorded day and its month so data shows straight away.
  // With no records (or no connection) fall back to today, never before the start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let iso = todayIso();
      if (iso < MIN_DATE_ISO) iso = MIN_DATE_ISO;
      try {
        const latest = await fetchLatestDate();
        if (latest) iso = latest;
      } catch {
        // The day and month loaders below show the real error.
      }
      if (cancelled) return;
      setDayText(isoToDisplay(iso));
      setMonthText(monthKeyToDisplay(isoToMonthKey(iso)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!validDay) {
      setDay({ state: "idle" });
      return;
    }
    let cancelled = false; // ignore stale responses if the date changed again
    setDay({ state: "loading" });
    fetchAttendance(validDay)
      .then((data) => !cancelled && setDay({ state: "ready", data }))
      .catch(
        (err: Error) =>
          !cancelled && setDay({ state: "error", message: err.message })
      );
    return () => {
      cancelled = true;
    };
  }, [validDay, refresh]);

  useEffect(() => {
    if (!validMonth) {
      setMonth({ state: "idle" });
      return;
    }
    let cancelled = false;
    setMonth({ state: "loading" });
    fetchMonth(validMonth)
      .then((data) => !cancelled && setMonth({ state: "ready", data }))
      .catch(
        (err: Error) =>
          !cancelled && setMonth({ state: "error", message: err.message })
      );
    return () => {
      cancelled = true;
    };
  }, [validMonth, refresh]);

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    const date = pendingDelete;
    setDeleting(true);
    setDeleteNote(null);
    try {
      await deleteAttendance(date);
      setDeleteNote({
        type: "success",
        text: `Attendance deleted for ${isoToDisplay(date)}.`,
      });
      setRefresh((n) => n + 1);
    } catch (err) {
      setDeleteNote({
        type: "error",
        text: `Could not delete ${isoToDisplay(date)}: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    } finally {
      setPendingDelete(null);
      setDeleting(false);
    }
  }

  function stepMonth(delta: number) {
    if (!validMonth) return;
    const next = shiftMonthKey(validMonth, delta);
    if (next < MIN_MONTH_KEY) return;
    setMonthText(monthKeyToDisplay(next));
  }

  return (
    <div className="space-y-10">
      {deleteNote && (
        <p
          role={deleteNote.type === "error" ? "alert" : "status"}
          className={`${messageClass} ${
            deleteNote.type === "success"
              ? "border-green-700 bg-green-50 text-green-900"
              : "border-red-700 bg-red-50 text-red-900"
          }`}
        >
          {deleteNote.text}
        </p>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onKeyDown={(e) => e.key === "Escape" && !deleting && setPendingDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 id="delete-title" className="text-lg font-bold text-red-900">
              Delete attendance for {isoToDisplay(pendingDelete)}?
            </h2>
            <p className="mt-2 text-sm">
              This removes that day&apos;s record from the database. It cannot be
              undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-md bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-md border border-navy px-4 py-2 font-semibold text-navy hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Selected day ---------- */}
      <section aria-labelledby="day-heading" className="space-y-4">
        <h2 id="day-heading" className="text-xl font-bold text-navy">
          Day details
        </h2>
        <DateField
          id="day"
          label="Day"
          value={dayText}
          onChange={setDayText}
          invalid={!!dayError}
          describedBy="day-error"
        />
        <div id="day-error" aria-live="polite">
          {dayError && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {dayError}
            </p>
          )}
        </div>

        {day.state === "loading" && <p role="status">Loading…</p>}
        {day.state === "error" && (
          <p
            role="alert"
            className={`${messageClass} border-red-700 bg-red-50 text-red-900`}
          >
            {day.message}
          </p>
        )}
        {day.state === "ready" && day.data === null && (
          <p
            role="status"
            className={`${messageClass} border-slate-300 bg-slate-50`}
          >
            No attendance recorded for {isoToDisplay(validDay ?? "")}.
          </p>
        )}
        {day.state === "ready" && day.data && validDay && (
          <DayTable
            values={day.data}
            display={isoToDisplay(validDay)}
            onDelete={() => setPendingDelete(validDay)}
          />
        )}
      </section>

      {/* ---------- Selected month ---------- */}
      <section aria-labelledby="month-heading" className="space-y-4">
        <h2 id="month-heading" className="text-xl font-bold text-navy">
          Monthly details
        </h2>

        <div>
          <label htmlFor="month" className="mb-1 block font-semibold">
            Month
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              disabled={!validMonth || validMonth <= MIN_MONTH_KEY}
              aria-label="Previous month"
              className="rounded-md border border-navy px-3 py-2 font-semibold text-navy hover:bg-slate-100 disabled:opacity-40"
            >
              ‹
            </button>
            <input
              id="month"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/YYYY"
              maxLength={7}
              value={monthText}
              onChange={(e) => setMonthText(formatMonthInput(e.target.value))}
              aria-invalid={monthError ? true : undefined}
              aria-describedby="month-error"
              className="w-full max-w-[9rem] rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-navy"
            />
            <button
              type="button"
              onClick={() => stepMonth(1)}
              disabled={!validMonth}
              aria-label="Next month"
              className="rounded-md border border-navy px-3 py-2 font-semibold text-navy hover:bg-slate-100 disabled:opacity-40"
            >
              ›
            </button>
          </div>
          <div id="month-error" aria-live="polite">
            {monthError && (
              <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                {monthError}
              </p>
            )}
          </div>
        </div>

        {month.state === "loading" && <p role="status">Loading…</p>}
        {month.state === "error" && (
          <p
            role="alert"
            className={`${messageClass} border-red-700 bg-red-50 text-red-900`}
          >
            {month.message}
          </p>
        )}
        {month.state === "ready" && validMonth && (
          <MonthView
            records={month.data}
            monthKey={validMonth}
            onDelete={setPendingDelete}
          />
        )}
      </section>
    </div>
  );
}

/** The selected day: workers per team, then the day's totals. */
function DayTable({
  values,
  display,
  onDelete,
}: {
  values: TeamValues;
  display: string;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[18rem] border-collapse text-left">
        <caption className="sr-only">Attendance on {display}</caption>
        <thead>
          <tr className="bg-navy text-white">
            <th scope="col" className={th}>
              Team
            </th>
            <th scope="col" className={`${th} ${num}`}>
              Workers on {display}
            </th>
          </tr>
        </thead>
        <tbody>
          {TEAMS.map((t) => (
            <tr key={t.key} className="border-b border-slate-300">
              <th scope="row" className={`${td} font-normal`}>
                {t.label}
              </th>
              <td className={`${td} ${num}`}>{values[t.key]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-orange-100 font-bold">
            <th scope="row" className={td}>
              Total workers present
            </th>
            <td className={`${td} ${num}`}>{dailyTotal(values)}</td>
          </tr>
          <tr className="bg-slate-100">
            <th scope="row" className={`${td} font-semibold`}>
              Teams working
            </th>
            <td className={`${td} ${num}`}>{teamsWorking(values)}</td>
          </tr>
          <tr className="bg-slate-100">
            <th scope="row" className={`${td} font-semibold`}>
              Teams on Leave
            </th>
            <td className={`${td} ${num}`}>{teamsOnLeave(values)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <button
      type="button"
      onClick={onDelete}
      className="rounded-md border border-red-700 px-4 py-2 font-semibold text-red-700 hover:bg-red-50"
    >
      Delete this day&apos;s record
    </button>
    </div>
  );
}

function MonthView({
  records,
  monthKey,
  onDelete,
}: {
  records: AttendanceRecord[];
  monthKey: string;
  onDelete: (isoDate: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const label = monthKeyToDisplay(monthKey);
  const days = dailyRows(records, monthKey);

  if (days.length === 0) {
    return (
      <p
        role="status"
        className={`${messageClass} border-slate-300 bg-slate-50`}
      >
        No attendance recorded for {label}.
      </p>
    );
  }

  const summary = monthSummary(records, monthKey);
  const teams = teamSummaries(records, monthKey);
  const teamData = teams.map((t) => ({ team: t.label, workerDays: t.workerDays }));
  const trend = days.map((d) => ({
    label: d.display,
    day: d.date.slice(8),
    total: d.total,
  }));

  async function onDownload() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadMonthExcel(records, monthKey);
    } catch (err) {
      setExportError(
        `Could not create the Excel file: ${err instanceof Error ? err.message : "unknown error"}`
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={exporting}
          className="rounded-md bg-accent px-4 py-2 font-bold text-navy hover:brightness-95 disabled:opacity-60"
        >
          {exporting ? "Preparing…" : "Download Excel (.xlsx)"}
        </button>
        <span className="text-sm text-slate-600">
          Includes all tables for {label}.
        </span>
      </div>
      {exportError && (
        <p
          role="alert"
          className={`${messageClass} border-red-700 bg-red-50 text-red-900`}
        >
          {exportError}
        </p>
      )}

      {/* Month summary */}
      <div>
        <h3 className="mb-2 text-lg font-bold text-navy">
          Month summary: {label}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-left">
            <caption className="sr-only">Summary for {label}</caption>
            <thead>
              <tr className="bg-navy text-white">
                <th scope="col" className={th}>
                  Item
                </th>
                <th scope="col" className={`${th} ${num}`}>
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300">
                <th scope="row" className={`${td} font-normal`}>
                  Days recorded
                </th>
                <td className={`${td} ${num}`}>{summary.daysRecorded}</td>
              </tr>
              <tr className="border-b border-slate-300 bg-orange-100 font-bold">
                <th scope="row" className={td}>
                  Total workers in the month (worker-days)
                </th>
                <td className={`${td} ${num}`}>{summary.totalWorkerDays}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <th scope="row" className={`${td} font-normal`}>
                  Average workers per day
                </th>
                <td className={`${td} ${num}`}>{summary.averagePerDay}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <th scope="row" className={`${td} font-normal`}>
                  Highest day
                </th>
                <td className={`${td} ${num}`}>
                  {summary.highest
                    ? `${summary.highest.display} (${summary.highest.total})`
                    : "-"}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <th scope="row" className={`${td} font-normal`}>
                  Lowest day
                </th>
                <td className={`${td} ${num}`}>
                  {summary.lowest
                    ? `${summary.lowest.display} (${summary.lowest.total})`
                    : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Team summary */}
      <div>
        <h3 className="mb-2 text-lg font-bold text-navy">Team-wise summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-left">
            <caption className="sr-only">
              Worker-days per team for {label}
            </caption>
            <thead>
              <tr className="bg-navy text-white">
                <th scope="col" className={th}>
                  Team
                </th>
                <th scope="col" className={`${th} ${num}`}>
                  Worker-days
                </th>
                <th scope="col" className={`${th} ${num}`}>
                  Days worked
                </th>
                <th scope="col" className={`${th} ${num}`}>
                  Days on Leave
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.key} className="border-b border-slate-300">
                  <th scope="row" className={`${td} font-normal`}>
                    {t.label}
                  </th>
                  <td className={`${td} ${num}`}>{t.workerDays}</td>
                  <td className={`${td} ${num}`}>{t.daysWorked}</td>
                  <td className={`${td} ${num}`}>{t.daysOnLeave}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-orange-100 font-bold">
                <th scope="row" className={td}>
                  Overall monthly total
                </th>
                <td className={`${td} ${num}`}>{summary.totalWorkerDays}</td>
                <td className={td} />
                <td className={td} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Day-by-day table */}
      <div>
        <h3 className="mb-2 text-lg font-bold text-navy">
          Day-by-day: workers present each day
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left">
            <caption className="sr-only">
              Workers per team for each recorded day in {label}
            </caption>
            <thead>
              <tr className="bg-navy text-white">
                <th scope="col" className={`${th} sticky left-0 bg-navy`}>
                  Date
                </th>
                {TEAMS.map((t) => (
                  <th key={t.key} scope="col" className={`${th} ${num}`}>
                    {t.label}
                  </th>
                ))}
                <th scope="col" className={`${th} ${num}`}>
                  Total workers
                </th>
                <th scope="col" className={`${th} ${num}`}>
                  Teams working
                </th>
                <th scope="col" className={`${th} ${num}`}>
                  Teams on Leave
                </th>
                <th scope="col" className={`${th} text-center`}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-b border-slate-300">
                  <th
                    scope="row"
                    className={`${td} sticky left-0 bg-white font-normal`}
                  >
                    {d.display}
                  </th>
                  {TEAMS.map((t) => (
                    <td key={t.key} className={`${td} ${num}`}>
                      {d.values[t.key]}
                    </td>
                  ))}
                  <td className={`${td} ${num} font-bold`}>{d.total}</td>
                  <td className={`${td} ${num}`}>{d.working}</td>
                  <td className={`${td} ${num}`}>{d.onLeave}</td>
                  <td className={`${td} text-center`}>
                    <button
                      type="button"
                      onClick={() => onDelete(d.date)}
                      aria-label={`Delete record for ${d.display}`}
                      className="rounded-md border border-red-700 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-orange-100 font-bold">
                <th scope="row" className={`${td} sticky left-0 bg-orange-100`}>
                  Month total
                </th>
                {teams.map((t) => (
                  <td key={t.key} className={`${td} ${num}`}>
                    {t.workerDays}
                  </td>
                ))}
                <td className={`${td} ${num}`}>{summary.totalWorkerDays}</td>
                <td className={td} />
                <td className={td} />
                <td className={td} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div>
        <h3 className="mb-2 text-lg font-bold text-navy">
          Worker-days by team
        </h3>
        <div
          role="img"
          aria-label={`Bar chart of worker-days by team: ${teamData
            .map((d) => `${d.team} ${d.workerDays}`)
            .join(", ")}`}
          className="h-72 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teamData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis dataKey="team" tick={{ fill: NAVY, fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: NAVY, fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="workerDays" name="Worker-days" fill={NAVY} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-lg font-bold text-navy">Daily trend</h3>
        <div
          role="img"
          aria-label={`Line chart of daily total workers for ${label}: ${trend
            .map((p) => `${p.label} ${p.total}`)
            .join(", ")}`}
          className="h-72 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" />
              <XAxis
                dataKey="day"
                tick={{ fill: NAVY, fontSize: 12 }}
                label={{ value: "Day of month", position: "insideBottom", offset: -4, fill: NAVY }}
                height={40}
              />
              <YAxis allowDecimals={false} tick={{ fill: NAVY, fontSize: 12 }} />
              <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total workers"
                stroke={ORANGE}
                strokeWidth={3}
                dot={{ r: 4, fill: ORANGE }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
