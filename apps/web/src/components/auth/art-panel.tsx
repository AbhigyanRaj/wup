"use client";

import { useSyncExternalStore } from "react";
import { PixelField } from "./pixel-field";

/*
 * The auth art panel (kit login.md 6, brief 1 and 4): the woven PixelField on
 * a pale #eef2fb backing that shows through where the weave parts, a 3-stop
 * scrim over the bottom half and the brand block. The canvas only mounts at
 * 900px and up (the panel is hidden below that), so phones never run the loop.
 * Both overlays are pointer-events: none, or the cursor effect dies.
 */

const QUERY = "(min-width: 900px)";

function subscribe(cb: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

export function AuthArtPanel() {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );

  return (
    <div className="auth__art relative overflow-hidden rounded-l-[8px] bg-[#eef2fb]" aria-hidden="true">
      {wide ? <PixelField className="absolute inset-0 touch-pan-y" /> : null}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.25) 45%, transparent)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-10">
        <span className="font-sans text-[18px] font-bold tracking-[-0.035em] text-white/85">wuup</span>
        <p className="mt-3 font-display text-[44px] font-normal leading-[1.02] tracking-[-0.015em] text-white">
          Your data,
          <br />
          in plain English
        </p>
        <p className="mt-3 max-w-[330px] text-[13px] leading-relaxed text-white/65">
          Connect MongoDB, Google Sheets or PDFs, ask a question, and get a chart built from the rows your query returned.
        </p>
      </div>
    </div>
  );
}
