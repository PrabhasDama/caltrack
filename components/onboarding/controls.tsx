"use client";
import { Check } from "lucide-react";
export function Choices({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <div className="choices">
      {options.map(([id, title, detail]) => (
        <button
          type="button"
          aria-pressed={value === id}
          className={`choice ${value === id ? "selected" : ""}`}
          key={id}
          onClick={() => onChange(id)}
        >
          <span className="choice-radio">{value === id && <span />}</span>
          <span>
            <strong>{title}</strong>
            {detail && <small>{detail}</small>}
          </span>
          {value === id && <Check size={16} />}
        </button>
      ))}
    </div>
  );
}
export function Multi({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="chip-grid">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={values.includes(option)}
          className={`chip ${values.includes(option) ? "selected" : ""}`}
          onClick={() =>
            onChange(
              values.includes(option)
                ? values.filter((v) => v !== option)
                : [...values, option],
            )
          }
        >
          {values.includes(option) && <Check size={12} />} {option}
        </button>
      ))}
    </div>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  note,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  note?: string;
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) =>
          onChange(e.target.value === "" ? NaN : Number(e.target.value))
        }
        min={min}
        max={max}
        step={step}
        required
      />
      {note && <small>{note}</small>}
    </label>
  );
}
