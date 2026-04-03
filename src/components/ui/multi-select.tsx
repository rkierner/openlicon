"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  color?: string;
};

type Props = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
};

export function MultiSelect({ options, value, onChange, placeholder = "All", className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  const buttonLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? (options.find((o) => o.value === value[0])?.label ?? "1 selected")
      : `${value.length} selected`;

  const active = value.length > 0;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 h-8 px-3 rounded-md border text-sm whitespace-nowrap",
          "bg-background transition-colors",
          active
            ? "border-primary text-foreground"
            : "border-input text-muted-foreground hover:bg-muted"
        )}
      >
        <span>{buttonLabel}</span>
        {active && (
          <X
            className="h-3 w-3 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          />
        )}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] max-h-64 overflow-auto rounded-md border bg-background shadow-md py-1">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No options</p>
          ) : (
            options.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                >
                  <div
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center flex-shrink-0",
                      checked ? "bg-primary border-primary" : "border-input"
                    )}
                  >
                    {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                  {opt.color && (
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
