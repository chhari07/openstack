"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

// Bottom sheet built on <dialog>, so focus trapping and Esc come for free.
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mx-auto mt-auto w-full max-w-[480px] rounded-t-[26px] md:mb-auto md:max-w-[540px] md:rounded-[26px] bg-paper p-0 text-ink backdrop:bg-black/35"
    >
      <div className="flex flex-col gap-4 px-5 pt-5 pb-[calc(max(env(safe-area-inset-bottom),20px)+20px)]">
        <div className="flex items-center justify-between">
          <h2 className="text-[19px] font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="-mr-2 flex size-11 items-center justify-center">
            <CloseIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto overscroll-x-contain px-5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`label flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10px] ${
              on ? "bg-ink text-on-ink" : "border border-ink/20"
            } ${o.icon ? "pl-2.5" : ""}`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
