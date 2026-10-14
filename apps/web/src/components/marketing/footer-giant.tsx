"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/*
 * Giant footer wordmark (.footer-giant): gradient-filled by default. When a
 * texture image exists it is swapped in through background-clip once the
 * wordmark approaches the viewport, so the image never loads above the fold.
 */
export function FooterGiant({ texture }: { texture?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !texture) return;
    const apply = () => {
      el.style.setProperty(
        "--footer-art",
        `linear-gradient(180deg, rgb(37 99 235 / 0.18), rgb(17 17 91 / 0.12)), url("${texture}")`,
      );
    };
    if (typeof IntersectionObserver === "undefined") return apply();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          apply();
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [texture]);

  return (
    <div
      ref={ref}
      className="footer-giant select-none"
      aria-hidden="true"
      style={{ backgroundImage: "var(--footer-art, var(--gradient-wordmark))" } as CSSProperties}
    >
      wuup
    </div>
  );
}
