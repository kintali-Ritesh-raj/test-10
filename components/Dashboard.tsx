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
  dailyTotal,
  dailyTrend,
  displayToIso,
  displayToMonthKey,
  formatMonthInput,
  isoToDisplay,
  isoToMonthKey,
  monthKeyToDisplay,
  monthlyTeamTotals,
  monthlyWorkerDays,
  recordsInMonth,
  shiftMonthKey,
  teamsOnLeave,
  teamsWorking,
  todayIso,
  validateAttendanceDate,
  validateMonth,
  type AttendanceRecord,
  type TeamValues,
} from "@/lib/attendance";
import { fetchAttendance, fetchMonth } from "@/lib/attendance-db";
import DateField from "./DateField";

const NAVY = "#1F2A44";
const ORANGE = "#F97316";

type Load<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; data: T };

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-bold text-navy">{value}</p>
    </div>
  );
}

const messageClass = "rounded-md border px-3 py-2 text-sm font-semibold";

export default function Dashboard() {
  const [dayText, setDayText] = useState("");
  const [monthText, setMonthText] = useState("");
  const [day, setDay] = useState<Load<TeamValues | null>>({ state: "idle" });
  const [month, setMonth] = useState<Load<AttendanceRecord[]>>({
    state: "idle",
  });

  // Day derived from the text the user sees.
  const dayIso = dayText.length === 10 ? displayToIso(dayText) : null;
  const dayError = dayText.length === 10 ? validateAttendanceDate(dayIso) : null;
  const validDay = dayText.length === 10 && !dayError ? dayIso : null;

  // Month derived the same way.
  const monthKey = monthText.length === 7 ? displayToMonthKey(monthText) : null;
  const monthError = monthText.length === 7 ? validateMonth(monthKey) : null;
  const validMonth = monthText.length === 7 && !monthError ? monthKey : null;

  // Default to today and the current month, but never before the start.
  useEffect(() => {
    const today = todayIso();
    const clamped = today < MIN_DATE_ISO ? MIN_DATE_ISO : today;
    setDayText(isoToDisplay(clamped));
    setMonthText(monthKeyToDisplay(isoToMonthKey(clamped)));
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
  }, [validDay]);

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
  }, [validMonth]);

  function stepMonth(delta: number) {
    if (!validMonth) return;
    const next = shiftMonthKey(validMonth, delta);
    if (next < MIN_MONTH_KEY) return;
    setMonthText(monthKeyToDisplay(next));
  }

  return (
    <div className="space-y-10">
      {/* ---------- Selected day ---------- */}
      <section aria-labelledby="day-heading" className="space-y-4">
        <h2 id="day-heading" className="text-xl font-bold text-navy">
          Day summary
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
        {day.state === "ready" && day.data && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total workers" value={dailyTotal(day.data)} />
            <StatCard label="Teams working" value={teamsWorking(day.data)} />
            <StatCard label="Teams on Leave" value={teamsOnLeave(day.data)} />
          </div>
        )}
      </section>

      {/* ---------- Selected month ---------- */}
      <section aria-labelledby="month-heading" className="space-y-4">
        <h2 id="month-heading" className="text-xl font-bold text-navy">
          Monthly summary
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
          <MonthView records={month.data} monthKey={validMonth} />
        )}
      </section>
    </div>
  );
}

function MonthView({
  records,
  monthKey,
}: {
  records: AttendanceRecord[];
  monthKey: string;
}) {
  const days = recordsInMonth(records, monthKey).length;
  if (days === 0) {
    return (
      <p
        role="status"
        className={`${messageClass} border-slate-300 bg-slate-50`}
      >
        No attendance recorded for {monthKeyToDisplay(monthKey)}.
      </p>
    );
  }

  const total = monthlyWorkerDays(records, monthKey);
  const totals = monthlyTeamTotals(records, monthKey);
  const teamData = TEAMS.map((t) => ({ team: t.label, workerDays: totals[t.key] }));
  const trend = dailyTrend(records, monthKey).map((p) => ({
    ...p,
    label: isoToDisplay(p.date),
    day: p.date.slice(8),
  }));

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Monthly worker-days" value={total} />
        <StatCard label="Days recorded" value={days} />
      </div>

      <div>
        <h3 className="mb-2 text-lg font-bold text-navy">
          Team-wise worker-days
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-left">
            <caption className="sr-only">
              Worker-days per team for {monthKeyToDisplay(monthKey)}
            </caption>
            <thead>
              <tr className="bg-navy text-white">
                <th scope="col" className="px-3 py-2">
                  Team
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Worker-days
                </th>
              </tr>
            </thead>
            <tbody>
              {teamData.map((row) => (
                <tr key={row.team} className="border-b border-slate-300">
                  <th scope="row" className="px-3 py-2 font-normal">
                    {row.team}
                  </th>
                  <td className="px-3 py-2 text-right">{row.workerDays}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <th scope="row" className="px-3 py-2">
                  Overall monthly total
                </th>
                <td className="px-3 py-2 text-right">{total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

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
          aria-label={`Line chart of daily total workers for ${monthKeyToDisplay(
            monthKey
          )}: ${trend.map((p) => `${p.label} ${p.total}`).join(", ")}`}
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
