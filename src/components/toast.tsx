"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckIcon } from "./icons";

type Toast = { text: ReactNode; href?: string; action?: string; onAction?: () => void };
const ToastCtx = createContext<(t: Toast) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((t: Toast) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--above-tabs)+10px)] z-50 mx-auto w-full max-w-[480px] px-4 md:left-[var(--rail)] md:bottom-[calc(var(--above-tabs)+76px)]"
      >
        {toast && (
          <div className="pointer-events-auto flex h-14 items-center gap-3 rounded-full bg-ink pl-[18px] pr-2 text-on-ink shadow-[0_10px_30px_rgba(0,0,0,.25)]">
            <CheckIcon size={18} className="shrink-0 text-[#6FD196]" />
            <span className="grow truncate text-[13px]">{toast.text}</span>
            {toast.onAction && (
              <button
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
                className="label flex h-10 items-center rounded-full bg-paper px-3.5 text-[10px] text-ink"
              >
                {toast.action ?? "Undo"}
              </button>
            )}
            {toast.href && (
              <Link
                href={toast.href}
                className="label flex h-10 items-center rounded-full bg-paper px-3.5 text-[10px] text-ink"
              >
                {toast.action ?? "Open"}
              </Link>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
