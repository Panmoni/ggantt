import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  onChange: (next: Set<string>) => void;
  options: string[];
  selected: Set<string>;
}

export function MultiSelect({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  }

  const count = selected.size;
  const summary = count === 0 ? "All" : `${count} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-slate-700 text-sm hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="text-slate-500">{label}:</span>
        <span className="font-medium">{summary}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-64 overflow-auto rounded border border-slate-200 bg-white p-1 shadow-lg">
          {count > 0 && (
            <button
              className="mb-1 w-full rounded px-2 py-1 text-left text-slate-500 text-xs hover:bg-slate-100"
              onClick={() => onChange(new Set())}
              type="button"
            >
              Clear
            </button>
          )}
          {options.map((opt) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-slate-700 text-sm hover:bg-slate-100"
              key={opt}
            >
              <input
                checked={selected.has(opt)}
                className="accent-slate-900"
                onChange={() => toggle(opt)}
                type="checkbox"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
