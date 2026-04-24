"use client";

import { useEffect, useRef, useState } from "react";

export type Vendor = {
  id: string;
  company_name: string;
  status: string;
};

type Props = {
  vendors: Vendor[];
  selectedId: string | null;
  onChange: (id: string) => void;
};

export function VendorSwitcher({ vendors, selectedId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = vendors.find((v) => v.id === selectedId);

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div className="label-mono mb-1.5">Logged in as</div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="brand-focus flex items-center justify-between gap-3 w-[260px] px-3 py-2 bg-bg-surface border border-border-hairline rounded-brand hover:border-brand-primary/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-brand-primary text-white flex items-center justify-center text-small font-semibold shrink-0">
            {selected?.company_name?.slice(0, 1) ?? "?"}
          </div>
          <div className="truncate text-left">
            <div className="text-body font-medium text-text-primary truncate leading-tight">
              {selected?.company_name || "—"}
            </div>
            <div className="text-[11px] text-text-muted leading-tight">Vendor</div>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 w-[260px] bg-bg-surface border border-border-hairline rounded-brand shadow-brand-sm overflow-hidden"
        >
          {vendors.map((v) => {
            const isSelected = v.id === selectedId;
            return (
              <button
                key={v.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(v.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-bg-app transition-colors ${
                  isSelected ? "bg-bg-app" : ""
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-brand-primary text-white flex items-center justify-center text-small font-semibold shrink-0">
                  {v.company_name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-medium text-text-primary truncate leading-tight">
                    {v.company_name}
                  </div>
                  <div className="text-[11px] text-text-muted leading-tight">{v.status}</div>
                </div>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}