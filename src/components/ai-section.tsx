"use client";

import { useEffect, useState } from "react";
import { useToast } from "./toast";
import { AI_ENGINE, aiSetUp, aiTurnedOn, setAiTurnedOn } from "@/lib/ai";

const SWITCH =
  "h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-rule transition-colors before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-music checked:before:translate-x-[22px] disabled:cursor-not-allowed disabled:opacity-50";

// Settings → Stack AI: one switch for every AI feature.
export function AiSection() {
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(null);
  const [setUp, setSetUp] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(aiTurnedOn());
    setSetUp(aiSetUp());
  }, []);

  if (on === null) return null;
  return (
    <>
      <label className="flex items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold">Stack AI</span>
          <span className="text-[13px] text-muted">
            {on
              ? "Summaries, PDF questions, Ask your Stack and Tidy note. Asks before sending anything."
              : "Off: no AI buttons anywhere, and nothing is sent."}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Stack AI"
          checked={on}
          disabled={!setUp}
          onChange={(e) => {
            setAiTurnedOn(e.target.checked);
            setOn(e.target.checked);
            toast({ text: e.target.checked ? "Stack AI is on" : "Stack AI is off" });
          }}
          className={SWITCH}
        />
      </label>
      <p className="text-[12px] leading-relaxed text-muted">
        {setUp
          ? `Runs on ${AI_ENGINE} through Stack’s server, only when you tap an AI button.`
          : "Stack AI isn’t set up in this build (it needs an account server and an AI key)."}
      </p>
    </>
  );
}
