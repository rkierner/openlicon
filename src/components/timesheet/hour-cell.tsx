"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type HourCellProps = {
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
};

export function HourCell({ value, disabled, onChange }: HourCellProps) {
  const [input, setInput] = useState(value != null && value > 0 ? String(value) : "");
  const committed = useRef(value);

  // Sync display when value is updated from outside (after a save)
  useEffect(() => {
    committed.current = value;
    setInput(value != null && value > 0 ? String(value) : "");
  }, [value]);

  function commit() {
    const num = parseFloat(input);
    const next =
      input === "" || isNaN(num) || num <= 0
        ? null
        : Math.max(0.25, Math.min(24, Math.round(num * 4) / 4));
    if (next !== committed.current) {
      committed.current = next;
      onChange(next);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      // Move focus to the next focusable cell
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>("input[data-hour-cell]")
      );
      const idx = inputs.indexOf(e.currentTarget);
      inputs[idx + 1]?.focus();
    }
    if (e.key === "Escape") {
      setInput(committed.current != null && committed.current > 0 ? String(committed.current) : "");
    }
  }

  if (disabled) {
    return (
      <div className="text-center text-sm py-1 text-muted-foreground opacity-60 select-none">
        {value != null && value > 0 ? value : "—"}
      </div>
    );
  }

  const hasValue = input !== "" && parseFloat(input) > 0;

  return (
    <input
      data-hour-cell
      type="number"
      step="0.25"
      min="0"
      max="24"
      value={input}
      placeholder="—"
      onChange={(e) => setInput(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKey}
      className={cn(
        "w-full text-center text-sm rounded py-1 outline-none border border-transparent",
        "bg-transparent placeholder:text-muted-foreground",
        "hover:border-input hover:bg-muted/40",
        "focus:border-primary focus:bg-primary/5 focus:ring-1 focus:ring-primary",
        hasValue ? "font-medium text-foreground" : "text-muted-foreground"
      )}
    />
  );
}
