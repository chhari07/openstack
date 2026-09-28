"use client";

import { useEffect, useState } from "react";
import { subscribe } from "./db";

// Runs an async loader now and again after every local write.
export function useStore<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = () =>
      load().then((d) => {
        if (alive) {
          setData(d);
          setReady(true);
        }
      });
    run();
    const off = subscribe(run);
    return () => {
      alive = false;
      off();
    };
    // The loader is expected to be a stable module function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [data, ready] as const;
}
