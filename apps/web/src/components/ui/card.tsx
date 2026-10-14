import Link from "next/link";
import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
 * Card (.card): white, 1px #f0f0f0 border, radius 12px, padding 32 / 40px.
 * size="lg" (.card--lg): radius 32px, #e6e6e6 border, padding 24 / 32px.
 * ------------------------------------------------------------------------- */

export type CardProps<T extends ElementType = "div"> = {
  as?: T;
  /** Default "md". */
  size?: "md" | "lg";
  /** Soft elevated shadow on hover (.card--hover). */
  hover?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "size" | "className" | "children">;

export function Card<T extends ElementType = "div">({
  as,
  size = "md",
  hover = false,
  className,
  children,
  ...rest
}: CardProps<T>) {
  const Comp: ElementType = as ?? "div";
  return (
    <Comp className={cn("card", size === "lg" && "card--lg", hover && "card--hover", className)} {...rest}>
      {children}
    </Comp>
  );
}

/* ---------------------------------------------------------------------------
 * MiniCard (.mini-card): icon top, 18px title + 14px description bottom,
 * min-height 208px, indigo-200 border on hover / active. The featured card
 * shows the decorative blue blob in the top-right corner.
 * ------------------------------------------------------------------------- */

export interface MiniCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** 24px icon. Tinted indigo-400 via .mini-card__icon; pass a lucide icon. */
  icon?: ReactNode;
  /** Featured / selected: indigo border. */
  active?: boolean;
  /** Decorative gradient blob in the corner. Defaults to `active`. */
  blob?: boolean;
  /** Renders a next/link when set. */
  href?: string;
  className?: string;
}

export function MiniCard({ title, description, icon, active = false, blob, href, className }: MiniCardProps) {
  const body = (
    <>
      {(blob ?? active) ? <span className="mini-card__blob" aria-hidden="true" /> : null}
      {icon ? (
        <span className="mini-card__icon relative" aria-hidden="true">
          {icon}
        </span>
      ) : (
        <span />
      )}
      <div className="relative">
        <p className="mini-card__title">{title}</p>
        {description ? <p className="mini-card__desc">{description}</p> : null}
      </div>
    </>
  );
  const cls = cn("mini-card", active && "is-active", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ---------------------------------------------------------------------------
 * OptionCard (.option-card): 80px soft gradient tile + title / description,
 * radius 26px. `tile` takes a CSS background (e.g. "var(--gradient-blue-soft)")
 * or any node (an icon tile image).
 * ------------------------------------------------------------------------- */

export interface OptionCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** CSS background string for the tile, or a custom node rendered inside it. */
  tile?: string | ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}

export function OptionCard({ title, description, tile, className, as: Comp = "div" }: OptionCardProps) {
  const tileStyle: CSSProperties | undefined =
    typeof tile === "string" ? { background: tile } : { background: "var(--gradient-blue-pale)" };
  return (
    <Comp className={cn("option-card", className)}>
      <div className="option-card__tile grid place-items-center overflow-hidden" style={tileStyle} aria-hidden="true">
        {typeof tile === "string" ? null : tile}
      </div>
      <div>
        <h3 className="option-card__title">{title}</h3>
        {description ? <p className="option-card__desc">{description}</p> : null}
      </div>
    </Comp>
  );
}
