// src/components/shared/DoctorSearchSelect.tsx
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { Doctor } from "@/types";

type Props = {
  doctors: Doctor[];
  value: string;           // doctorId
  onChange: (id: string) => void;
};

export default function DoctorSearchSelect({ doctors, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = doctors.find((d) => d.id === value) ?? null;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? doctors.filter(
        (d) =>
          d.name.toLowerCase().includes(query.toLowerCase()) ||
          d.specialization?.toLowerCase().includes(query.toLowerCase()) ||
          d.qualification?.toLowerCase().includes(query.toLowerCase()),
      )
    : doctors;

  function select(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
  }

  return (
    <div ref={ref} className="relative">
      {/* Selected pill OR search input */}
      {selected && !open ? (
        <div className="form-input flex items-center justify-between gap-2 cursor-pointer" onClick={() => setOpen(true)}>
          <span className="text-sm text-slate-800">
            {selected.name}
            {selected.qualification ? `, ${selected.qualification}` : ""}
            {selected.specialization ? ` (${selected.specialization})` : ""}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="text-slate-400 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="form-input pl-9"
            placeholder="Search doctor by name or specialization..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {/* Walk-in option */}
          <button
            type="button"
            onClick={() => select("")}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 border-b border-slate-100"
          >
            <span className="text-slate-400 italic">— Self / Walk-in —</span>
          </button>

          <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400">No doctors found</div>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => select(d.id)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-teal-50"
                >
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                    {d.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {d.name}
                      {d.qualification ? `, ${d.qualification}` : ""}
                    </div>
                    {d.specialization && (
                      <div className="text-xs text-slate-400">{d.specialization}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}