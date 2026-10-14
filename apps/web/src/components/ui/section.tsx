import { Fragment, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Small uppercase label above a heading (.eyebrow): 12px / 525 / 0.17em tracking, #666. */
export function Eyebrow({ className, ...rest }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("eyebrow", className)} {...rest} />;
}

/** Turns "Line one\nLine two" into "Line one<br/>Line two". Non-strings pass through. */
export function withLineBreaks(value: ReactNode): ReactNode {
  if (typeof value !== "string" || !value.includes("\n")) return value;
  const parts = value.split("\n");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <br /> : null}
    </Fragment>
  ));
}

export interface SectionHeadProps {
  eyebrow?: ReactNode;
  /** Display-font title. A string may contain "\n" for a manual line break. */
  title: ReactNode;
  /** Intro copy under the title (.intro: 18px / #666, max 672px). */
  intro?: ReactNode;
  /** Default "center". */
  align?: "center" | "left";
  /** Heading element. Default "h2". */
  as?: "h1" | "h2" | "h3";
  className?: string;
  titleClassName?: string;
  /** Optional actions row under the intro. */
  children?: ReactNode;
}

/** Centred section heading block (.section__head + .h-section). */
export function SectionHead({
  eyebrow,
  title,
  intro,
  align = "center",
  as: Heading = "h2",
  className,
  titleClassName,
  children,
}: SectionHeadProps) {
  return (
    <div className={cn("section__head", align === "left" && "section__head--left", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading className={cn("h-section", titleClassName)}>{withLineBreaks(title)}</Heading>
      {intro ? <p className="intro">{intro}</p> : null}
      {children}
    </div>
  );
}

export type SectionProps<T extends ElementType = "section"> = {
  as?: T;
  /** Wrap in the kit container (88% / 83.333% / max 1400px). Default true. */
  container?: boolean;
  /** Use the .section column layout (centred, heading-to-content gap 32 / 48px). Default true. */
  stack?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

/**
 * A page section. Spacing between sections comes from the parent .page-sheet
 * (176 / 96px). For a scroll reveal, wrap it in <Reveal>.
 */
export function Section<T extends ElementType = "section">({
  as,
  container = true,
  stack = true,
  className,
  children,
  ...rest
}: SectionProps<T>) {
  const Comp: ElementType = as ?? "section";
  return (
    <Comp className={cn(container && "container", stack && "section", className)} {...rest}>
      {children}
    </Comp>
  );
}
