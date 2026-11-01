import { describe, expect, it } from "vitest";
import {
  MIN_DATE_ISO,
  dailyTotal,
  dailyTrend,
  displayToIso,
  displayToMonthKey,
  formatDateInput,
  formatMonthInput,
  MIN_MONTH_KEY,
  shiftMonthKey,
  validateMonth,
  isValidIsoDate,
  isValidMonthKey,
  isoToDisplay,
  isoToMonthKey,
  monthKeyToDisplay,
  monthlyTeamTotals,
  monthlyWorkerDays,
  teamWorkers,
  teamsOnLeave,
  teamsWorking,
  validateAttendanceDate,
  type AttendanceRecord,
  type TeamValues,
} from "./attendance";

const all = (v: string): TeamValues => ({
  anandapuram: v,
  slg: v,
  madam: v,
  kothavalasa: v,
  airport: v,
  dj: v,
});

const mix: TeamValues = {
  anandapuram: "10",
  slg: "20",
  madam: "Leave",
  kothavalasa: "0",
  airport: "5",
  dj: "100",
};

const rec = (date: string, values: TeamValues): AttendanceRecord => ({
  attendance_date: date,
  ...values,
});

describe("teamWorkers", () => {
  it("treats Leave as 0 and parses numbers", () => {
    expect(teamWorkers("Leave")).toBe(0);
    expect(teamWorkers("0")).toBe(0);
    expect(teamWorkers("37")).toBe(37);
    expect(teamWorkers("100")).toBe(100);
  });

  it("treats invalid values as 0", () => {
    for (const bad of ["", "101", "-1", "07", "1.5", "abc", "leave"]) {
      expect(teamWorkers(bad)).toBe(0);
    }
  });
});

describe("daily calculations", () => {
  it("all Leave: total 0, none working, six on leave", () => {
    const v = all("Leave");
    expect(dailyTotal(v)).toBe(0);
    expect(teamsWorking(v)).toBe(0);
    expect(teamsOnLeave(v)).toBe(6);
  });

  it("all 0: total 0, none working, none on leave", () => {
    const v = all("0");
    expect(dailyTotal(v)).toBe(0);
    expect(teamsWorking(v)).toBe(0);
    expect(teamsOnLeave(v)).toBe(0);
  });

  it("mixed day", () => {
    expect(dailyTotal(mix)).toBe(135);
    expect(teamsWorking(mix)).toBe(4); // 10, 20, 5, 100
    expect(teamsOnLeave(mix)).toBe(1);
  });

  it("max of 100 for every team", () => {
    const v = all("100");
    expect(dailyTotal(v)).toBe(600);
    expect(teamsWorking(v)).toBe(6);
    expect(teamsOnLeave(v)).toBe(0);
  });

  it("a team at 0 is neither working nor on leave", () => {
    const v = { ...all("Leave"), slg: "0" };
    expect(teamsWorking(v)).toBe(0);
    expect(teamsOnLeave(v)).toBe(5);
  });
});

describe("monthly calculations", () => {
  const records = [
    rec("2026-09-30", all("1")), // September, last day
    rec("2026-10-01", mix), // October, first day
    rec("2026-10-15", all("Leave")),
    rec("2026-10-31", all("100")), // October, last day
    rec("2026-11-01", all("2")), // November, first day
  ];

  it("empty month returns zeros and no trend points", () => {
    expect(monthlyWorkerDays([], "2026-10")).toBe(0);
    expect(monthlyWorkerDays(records, "2027-01")).toBe(0);
    expect(monthlyTeamTotals(records, "2027-01")).toEqual({
      anandapuram: 0,
      slg: 0,
      madam: 0,
      kothavalasa: 0,
      airport: 0,
      dj: 0,
    });
    expect(dailyTrend(records, "2027-01")).toEqual([]);
  });

  it("includes first and last day of the month, excludes neighbours", () => {
    // 135 + 0 + 600; September (6) and November (12) are excluded.
    expect(monthlyWorkerDays(records, "2026-10")).toBe(735);
    expect(monthlyWorkerDays(records, "2026-09")).toBe(6);
    expect(monthlyWorkerDays(records, "2026-11")).toBe(12);
  });

  it("handles the year boundary", () => {
    const r = [rec("2026-12-31", all("1")), rec("2027-01-01", all("2"))];
    expect(monthlyWorkerDays(r, "2026-12")).toBe(6);
    expect(monthlyWorkerDays(r, "2027-01")).toBe(12);
  });

  it("team-wise totals add up to the monthly worker-days", () => {
    const totals = monthlyTeamTotals(records, "2026-10");
    expect(totals).toEqual({
      anandapuram: 110, // 10 + 0 + 100
      slg: 120, // 20 + 0 + 100
      madam: 100, // Leave + Leave + 100
      kothavalasa: 100, // 0 + 0 + 100
      airport: 105, // 5 + 0 + 100
      dj: 200, // 100 + 0 + 100
    });
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    expect(sum).toBe(monthlyWorkerDays(records, "2026-10"));
  });

  it("daily trend is sorted by date even if records are unordered", () => {
    const shuffled = [records[3], records[1], records[2]];
    expect(dailyTrend(shuffled, "2026-10")).toEqual([
      { date: "2026-10-01", total: 135 },
      { date: "2026-10-15", total: 0 },
      { date: "2026-10-31", total: 600 },
    ]);
  });
});

describe("date validation", () => {
  it("accepts real dates, including leap days", () => {
    expect(isValidIsoDate("2026-09-21")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-12-31")).toBe(true);
  });

  it("rejects invalid dates", () => {
    for (const bad of [
      "",
      "abc",
      "2026-13-01",
      "2026-00-10",
      "2026-02-30",
      "2027-02-29", // not a leap year
      "2026-04-31",
      "2026-10-00",
      "2026-1-1",
      "26-10-01",
    ]) {
      expect(isValidIsoDate(bad)).toBe(false);
    }
  });

  it("converts between ISO and DD/MM/YYYY without shifting the day", () => {
    expect(isoToDisplay("2026-09-21")).toBe("21/09/2026");
    expect(isoToDisplay("2026-12-31")).toBe("31/12/2026");
    expect(isoToDisplay("2026-02-30")).toBe("");
    expect(displayToIso("21/09/2026")).toBe("2026-09-21");
    expect(displayToIso("01/01/2027")).toBe("2027-01-01");
    expect(displayToIso("31/02/2026")).toBeNull();
    expect(displayToIso("2026-09-21")).toBeNull();
    expect(displayToIso("1/9/2026")).toBeNull();
    expect(displayToIso("")).toBeNull();
  });

  it("formats typed input as DD/MM/YYYY", () => {
    expect(formatDateInput("")).toBe("");
    expect(formatDateInput("2")).toBe("2");
    expect(formatDateInput("210")).toBe("21/0");
    expect(formatDateInput("21092026")).toBe("21/09/2026");
    expect(formatDateInput("21/09/2026")).toBe("21/09/2026");
    expect(formatDateInput("21-09-2026 extra 99")).toBe("21/09/2026");
    expect(formatDateInput("12/")).toBe("12");
  });

  it("rejects dates before 21/10/2026 and invalid input", () => {
    expect(MIN_DATE_ISO).toBe("2026-10-21");
    expect(validateAttendanceDate("2026-10-21")).toBeNull();
    expect(validateAttendanceDate("2026-10-22")).toBeNull();
    expect(validateAttendanceDate("2030-12-31")).toBeNull();
    expect(validateAttendanceDate("2026-10-20")).toBe(
      "Attendance cannot be recorded before 21/10/2026."
    );
    expect(validateAttendanceDate("2025-01-01")).toContain("21/10/2026");
    expect(validateAttendanceDate(null)).toBe(
      "Enter a valid date as DD/MM/YYYY."
    );
  });
});

describe("month helpers", () => {
  it("validates month keys", () => {
    expect(isValidMonthKey("2026-10")).toBe(true);
    expect(isValidMonthKey("2026-12")).toBe(true);
    expect(isValidMonthKey("2026-00")).toBe(false);
    expect(isValidMonthKey("2026-13")).toBe(false);
    expect(isValidMonthKey("2026-1")).toBe(false);
    expect(isValidMonthKey("")).toBe(false);
  });

  it("converts between YYYY-MM and MM/YYYY", () => {
    expect(monthKeyToDisplay("2026-10")).toBe("10/2026");
    expect(monthKeyToDisplay("bad")).toBe("");
    expect(displayToMonthKey("10/2026")).toBe("2026-10");
    expect(displayToMonthKey("13/2026")).toBeNull();
    expect(displayToMonthKey("1/2026")).toBeNull();
    expect(isoToMonthKey("2026-10-31")).toBe("2026-10");
    expect(isoToMonthKey("2026-02-30")).toBe("");
  });
});

describe("month input helpers", () => {
  it("formats typed input as MM/YYYY", () => {
    expect(formatMonthInput("")).toBe("");
    expect(formatMonthInput("1")).toBe("1");
    expect(formatMonthInput("102026")).toBe("10/2026");
    expect(formatMonthInput("10/2026")).toBe("10/2026");
    expect(formatMonthInput("10/20269999")).toBe("10/2026");
    expect(formatMonthInput("10/")).toBe("10");
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonthKey("2026-10", 1)).toBe("2026-11");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2027-01", -1)).toBe("2026-12");
    expect(shiftMonthKey("2026-09", -9)).toBe("2025-12");
    expect(shiftMonthKey("bad", 1)).toBe("bad");
  });

  it("rejects months before 10/2026", () => {
    expect(MIN_MONTH_KEY).toBe("2026-10");
    expect(validateMonth("2026-10")).toBeNull();
    expect(validateMonth("2027-01")).toBeNull();
    expect(validateMonth("2026-09")).toBe("No data before 10/2026.");
    expect(validateMonth(null)).toBe("Enter a month as MM/YYYY.");
  });
});
