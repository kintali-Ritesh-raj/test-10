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
const GRID = "#E2E8F0";

type Load<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: T };

const messageClass = "rounded-lg border px-4 py-3 text-sm font-semibold";
const errorClass = `${messageClass} border-red-300 bg-red-50 text-red-900`;
const emptyClass = `${messageClass} border-slate-200 bg-slate-50 font-normal text-slate-600`;
const th =
  "whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600";
const td = "px-4 py-2.5";
const num = "text-right tabular-nums";
const headRow = "border-b border-slate-200 bg-slate-50";
const bodyRow = "border-b border-slate-100 even:bg-slate-50/60 hover:bg-orange-50/60";
const totalRow = "border-t-2 border-slate-300 bg-orange-50 font-bold";

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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const monthRecords =
    month.state === "ready" && validMonth ? month.data : null;
  const hasMonthData =
    !!monthRecords && !!validMonth && dailyRows(monthRecords, validMonth).length > 0;

  async function onDownload() {
    if (exporting || !monthRecords || !validMonth) return;
    setExporting(true);
    setExportError(null);
    try {
      await downloadMonthExcel(monthRecords, validMonth);
    } catch (err) {
      setExportError(
        `Could not create the Excel file: ${err instanceof Error ? err.message : "unknown error"}`
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {deleteNote && (
        <p
          role={deleteNote.type === "error" ? "alert" : "status"}
          className={`${messageClass} ${
            deleteNote.type === "success"
              ? "border-green-300 bg-green-50 text-green-900"
              : "border-red-300 bg-red-50 text-red-900"
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
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="delete-title" className="text-lg font-bold text-red-900">
              Delete attendance for {isoToDisplay(pendingDelete)}?
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              This removes that day&apos;s record from the database. It cannot be
              undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-navy hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Filters ---------- */}
      <section
        aria-label="Filters"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
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
                className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-navy hover:bg-slate-100 disabled:opacity-40"
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
                className="w-28 rounded-md border border-slate-400 bg-white px-3 py-2 text-center text-base text-navy"
              />
              <button
                type="button"
                onClick={() => stepMonth(1)}
                disabled={!validMonth}
                aria-label="Next month"
                className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-navy hover:bg-slate-100 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>

          <DateField
            id="day"
            label="Day"
            value={dayText}
            onChange={setDayText}
            invalid={!!dayError}
            describedBy="day-error"
          />

          <div className="sm:ml-auto">
            <button
              type="button"
              onClick={onDownload}
              disabled={exporting || !hasMonthData}
              className="rounded-lg bg-accent px-5 py-2.5 font-bold text-navy shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Preparing…" : "Download Excel (.xlsx)"}
            </button>
          </div>
        </div>

        <div id="month-error" aria-live="polite">
          {monthError && (
            <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
              {monthError}
            </p>
          )}
        </div>
        <div id="day-error" aria-live="polite">
          {dayError && (
            <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
              {dayError}
            </p>
          )}
        </div>
        {exportError && (
          <p role="alert" className={`mt-3 ${errorClass}`}>
            {exportError}
          </p>
        )}
      </section>

      {/* ---------- Month ---------- */}
      {month.state === "loading" && (
        <p role="status" className="text-slate-600">
          Loading month…
        </p>
      )}
      {month.state === "error" && (
        <p role="alert" className={errorClass}>
          {month.message}
        </p>
      )}
      {month.state === "ready" && validMonth && !hasMonthData && (
        <p role="status" className={emptyClass}>
          No attendance recorded for {monthKeyToDisplay(validMonth)}.
        </p>
      )}

      {hasMonthData && monthRecords && validMonth && (
        <MonthKpis records={monthRecords} monthKey={validMonth} />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ---------- Selected day ---------- */}
        <Card
          id="day-heading"
          title="Day details"
          subtitle={validDay ? isoToDisplay(validDay) : undefined}
          className="lg:col-span-2"
        >
          {!validDay && (
            <p className="px-5 pb-5 text-sm text-slate-600">
              Enter a day to see its attendance.
            </p>
          )}
          {day.state === "loading" && (
            <p role="status" className="px-5 pb-5 text-slate-600">
              Loading…
            </p>
          )}
          {day.state === "error" && (
            <div className="px-5 pb-5">
              <p role="alert" className={errorClass}>
                {day.message}
              </p>
            </div>
          )}
          {day.state === "ready" && day.data === null && (
            <div className="px-5 pb-5">
              <p role="status" className={emptyClass}>
                No attendance recorded for {isoToDisplay(validDay ?? "")}.
              </p>
            </div>
          )}
          {day.state === "ready" && day.data && validDay && (
            <DayTable
              values={day.data}
              display={isoToDisplay(validDay)}
              onDelete={() => setPendingDelete(validDay)}
            />
          )}
        </Card>

        {/* ---------- Team summary ---------- */}
        {hasMonthData && monthRecords && validMonth && (
          <TeamSummaryCard
            records={monthRecords}
            monthKey={validMonth}
            className="lg:col-span-3"
          />
        )}
      </div>

      {hasMonthData && monthRecords && validMonth && (
        <>
          <MonthCharts records={monthRecords} monthKey={validMonth} />
          <DayByDayCard
            records={monthRecords}
            monthKey={validMonth}
            selectedDay={validDay}
            onSelectDay={(iso) => setDayText(isoToDisplay(iso))}
            onDelete={setPendingDelete}
          />
        </>
      )}
    </div>
  );
}

/** White panel with a heading, used for every dashboard section. */
function Card({
  id,
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div>
          <h2 id={id} className="text-base font-bold text-navy">
            {title}
          </h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Headline figures for the selected month. */
function MonthKpis({
  records,
  monthKey,
}: {
  records: AttendanceRecord[];
  monthKey: string;
}) {
  const s = monthSummary(records, monthKey);
  const label = monthKeyToDisplay(monthKey);
  const items = [
    {
      label: "Total workers (worker-days)",
      value: String(s.totalWorkerDays),
      note: `in ${label}`,
      highlight: true,
    },
    { label: "Days recorded", value: String(s.daysRecorded), note: label },
    { label: "Average per day", value: String(s.averagePerDay), note: "workers" },
    {
      label: "Highest day",
      value: s.highest ? String(s.highest.total) : "-",
      note: s.highest?.display ?? "",
    },
    {
      label: "Lowest day",
      value: s.lowest ? String(s.lowest.total) : "-",
      note: s.lowest?.display ?? "",
    },
  ];

  return (
    <section aria-label={`Month summary for ${label}`}>
      <h2 className="sr-only">Month summary: {label}</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border bg-white p-4 shadow-sm ${
              k.highlight
                ? "col-span-2 border-accent/40 border-l-4 border-l-accent sm:col-span-1"
                : "border-slate-200"
            }`}
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {k.label}
            </dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums text-navy">
              {k.value}
            </dd>
            <dd className="text-sm text-slate-500">{k.note}</dd>
          </div>
        ))}
      </dl>
    </section>
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
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[16rem] border-collapse text-left">
          <caption className="sr-only">Attendance on {display}</caption>
          <thead>
            <tr className={headRow}>
              <th scope="col" className={th}>
                Team
              </th>
              <th scope="col" className={`${th} ${num}`}>
                Workers
              </th>
            </tr>
          </thead>
          <tbody>
            {TEAMS.map((t) => (
              <tr key={t.key} className={bodyRow}>
                <th scope="row" className={`${td} font-normal`}>
                  {t.label}
                </th>
                <td className={`${td} ${num}`}>
                  <TeamValue value={values[t.key]} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={totalRow}>
              <th scope="row" className={td}>
                Total workers present
              </th>
              <td className={`${td} ${num}`}>{dailyTotal(values)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm">
        <span className="text-slate-600">
          {teamsWorking(values)} teams working · {teamsOnLeave(values)} on Leave
        </span>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50"
        >
          Delete this day&apos;s record
        </button>
      </div>
    </>
  );
}

/** A team's value; Leave is shown as a small badge so it stands out from numbers. */
function TeamValue({ value }: { value: string }) {
  if (value === "Leave") {
    return (
      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
        Leave
      </span>
    );
  }
  return <>{value}</>;
}

function TeamSummaryCard({
  records,
  monthKey,
  className,
}: {
  records: AttendanceRecord[];
  monthKey: string;
  className?: string;
}) {
  const label = monthKeyToDisplay(monthKey);
  const summary = monthSummary(records, monthKey);
  const teams = teamSummaries(records, monthKey);

  return (
    <Card
      id="team-heading"
      title="Team-wise summary"
      subtitle={label}
      className={className}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[24rem] border-collapse text-left">
          <caption className="sr-only">Worker-days per team for {label}</caption>
          <thead>
            <tr className={headRow}>
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
              <tr key={t.key} className={bodyRow}>
                <th scope="row" className={`${td} font-normal`}>
                  {t.label}
                </th>
                <td className={`${td} ${num} font-semibold`}>{t.workerDays}</td>
                <td className={`${td} ${num}`}>{t.daysWorked}</td>
                <td className={`${td} ${num}`}>{t.daysOnLeave}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={totalRow}>
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
    </Card>
  );
}

function MonthCharts({
  records,
  monthKey,
}: {
  records: AttendanceRecord[];
  monthKey: string;
}) {
  const label = monthKeyToDisplay(monthKey);
  const teamData = teamSummaries(records, monthKey).map((t) => ({
    team: t.label,
    workerDays: t.workerDays,
  }));
  const trend = dailyRows(records, monthKey).map((d) => ({
    label: d.display,
    day: d.date.slice(8),
    total: d.total,
  }));
  const axisTick = { fill: "#475569", fontSize: 12 };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card id="trend-heading" title="Daily trend" subtitle={`Total workers per day, ${label}`}>
        <div
          role="img"
          aria-label={`Line chart of daily total workers for ${label}: ${trend
            .map((p) => `${p.label} ${p.total}`)
            .join(", ")}`}
          className="h-72 w-full px-2 pb-4"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="day"
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: GRID }}
                label={{ value: "Day of month", position: "insideBottom", offset: -4, fill: "#475569", fontSize: 12 }}
                height={40}
              />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={36} />
              <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} />
              <Line
                type="monotone"
                dataKey="total"
                name="Total workers"
                stroke={ORANGE}
                strokeWidth={2.5}
                dot={{ r: 3, fill: ORANGE }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card id="bar-heading" title="Worker-days by team" subtitle={label}>
        <div
          role="img"
          aria-label={`Bar chart of worker-days by team: ${teamData
            .map((d) => `${d.team} ${d.workerDays}`)
            .join(", ")}`}
          className="h-72 w-full px-2 pb-4"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={teamData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="team" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={36} />
              <Tooltip cursor={{ fill: "#F1F5F9" }} />
              <Bar dataKey="workerDays" name="Worker-days" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function DayByDayCard({
  records,
  monthKey,
  selectedDay,
  onSelectDay,
  onDelete,
}: {
  records: AttendanceRecord[];
  monthKey: string;
  selectedDay: string | null;
  onSelectDay: (isoDate: string) => void;
  onDelete: (isoDate: string) => void;
}) {
  const label = monthKeyToDisplay(monthKey);
  const days = dailyRows(records, monthKey);
  const summary = monthSummary(records, monthKey);
  const teams = teamSummaries(records, monthKey);

  return (
    <Card
      id="days-heading"
      title="Day-by-day attendance"
      subtitle={`Workers present each day, ${label}. Select a date to see its details.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            Workers per team for each recorded day in {label}
          </caption>
          <thead>
            <tr className={headRow}>
              <th scope="col" className={`${th} sticky left-0 bg-slate-50`}>
                Date
              </th>
              {TEAMS.map((t) => (
                <th key={t.key} scope="col" className={`${th} ${num}`}>
                  {t.label}
                </th>
              ))}
              <th scope="col" className={`${th} ${num}`}>
                Total
              </th>
              <th scope="col" className={`${th} ${num}`}>
                Working
              </th>
              <th scope="col" className={`${th} ${num}`}>
                On Leave
              </th>
              <th scope="col" className={`${th} text-center`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const selected = d.date === selectedDay;
              return (
                <tr
                  key={d.date}
                  className={`${bodyRow} ${selected ? "!bg-orange-100/70" : ""}`}
                >
                  <th
                    scope="row"
                    className={`${td} sticky left-0 font-normal ${
                      selected ? "bg-orange-100" : "bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectDay(d.date)}
                      aria-current={selected ? "date" : undefined}
                      className="font-semibold text-navy underline-offset-2 hover:underline"
                    >
                      {d.display}
                    </button>
                  </th>
                  {TEAMS.map((t) => (
                    <td key={t.key} className={`${td} ${num}`}>
                      <TeamValue value={d.values[t.key]} />
                    </td>
                  ))}
                  <td className={`${td} ${num} font-bold`}>{d.total}</td>
                  <td className={`${td} ${num} text-slate-600`}>{d.working}</td>
                  <td className={`${td} ${num} text-slate-600`}>{d.onLeave}</td>
                  <td className={`${td} text-center`}>
                    <button
                      type="button"
                      onClick={() => onDelete(d.date)}
                      aria-label={`Delete record for ${d.display}`}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className={totalRow}>
              <th scope="row" className={`${td} sticky left-0 bg-orange-50`}>
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
    </Card>
  );
}
