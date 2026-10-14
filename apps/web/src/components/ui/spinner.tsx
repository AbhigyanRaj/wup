import * as React from "react";
import { cn } from "@/lib/cn";

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg";
  /** Accessible label; pass null when the spinner sits inside a labelled busy button. */
  label?: string | null;
}

const px = { sm: 16, md: 20, lg: 28 } as const;

/** Thin ring spinner. Colour follows currentColor (default blue-600). */
export function Spinner({ size = "md", label = "Loading", className, ...props }: SpinnerProps) {
  const s = px[size];
  const svg = (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 animate-spin text-blue-600 [animation-duration:900ms]", className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9.25" stroke="#e6e6e6" strokeWidth="2" />
      <path
        d="M21.25 12A9.25 9.25 0 0 0 12 2.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
  if (label === null) return svg;
  return (
    <span role="status" className="inline-flex items-center">
      {svg}
      <span className="sr-only">{label}</span>
    </span>
  );
}
