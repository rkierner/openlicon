"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

type HourCellProps = {
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
};

export function HourCell({ value, disabled, onChange }: HourCellProps) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (disabled) return;
    setInput(value != null ? String(value) : "");
    setEditing(true);
    setTimeout(() => ref.current?.select(), 0);
  }

  function commit() {
    const num = parseFloat(input);
    if (input === "" || isNaN(num)) {
      onChange(null);
    } else {
      const clamped = Math.max(0.25, Math.min(24, Math.round(num * 4) / 4));
      onChange(clamped);
    }
    setEditing(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === "Tab") commit();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        step="0.25"
        min="0"
        max="24"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        className="w-full h-full text-center text-sm bg-primary/10 border border-primary rounded outline-none focus:ring-1 focus:ring-primary py-1"
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className={cn(
        "text-center text-sm py-1 rounded transition-colors select-none",
        !disabled && "cursor-pointer hover:bg-muted",
        disabled && "opacity-50 cursor-not-allowed",
        value != null && value > 0
          ? "text-foreground font-medium"
          : "text-muted-foreground"
      )}
    >
      {value != null && value > 0 ? value : "—"}
    </div>
  );
}
