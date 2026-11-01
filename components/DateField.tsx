"use client";

import { useRef } from "react";
import {
  MIN_DATE_ISO,
  displayToIso,
  formatDateInput,
  isoToDisplay,
} from "@/lib/attendance";

type Props = {
  id: string;
  label: string;
  /** Date as the user sees it: DD/MM/YYYY (possibly partial while typing). */
  value: string;
  onChange: (display: string) => void;
  invalid?: boolean;
  describedBy?: string;
};

/** DD/MM/YYYY text input with a Calendar button that opens the native picker. */
export default function DateField({
  id,
  label,
  value,
  onChange,
  invalid,
  describedBy,
}: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const iso = value.length === 10 ? displayToIso(value) : null;

  function openCalendar() {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-semibold">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/YYYY"
          maxLength={10}
          value={value}
          onChange={(e) => onChange(formatDateInput(e.target.value))}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={describedBy}
          className="w-full max-w-[12rem] rounded-md border border-slate-400 bg-white px-3 py-2 text-base text-navy"
        />
        <button
          type="button"
          onClick={openCalendar}
          className="rounded-md border border-navy px-3 py-2 font-semibold text-navy hover:bg-slate-100"
        >
          Calendar
        </button>
        {/* Native picker only supplies the calendar; the visible date stays DD/MM/YYYY. */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          min={MIN_DATE_ISO}
          value={iso ?? ""}
          onChange={(e) => {
            if (e.target.value) onChange(isoToDisplay(e.target.value));
          }}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </div>
    </div>
  );
}
