import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
 * Checklist (.checklist): 16px #3d3d3d items with an indigo-600 check badge.
 * The kit adds 28px of top margin (it sits under card copy); override with mt-0.
 * ------------------------------------------------------------------------- */

export function CheckBadgeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1-3-1-3 2.8-1.6.9-3.1 3.2.3z"
      />
      <path d="M8.2 12.3l2.5 2.4 5-5.2" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface ChecklistProps extends Omit<ComponentPropsWithoutRef<"ul">, "children"> {
  items: ReactNode[];
  /** Replace the default check badge. */
  icon?: ReactNode;
}

export function Checklist({ items, icon, className, ...rest }: ChecklistProps) {
  return (
    <ul className={cn("checklist", className)} {...rest}>
      {items.map((item, i) => (
        <li key={i}>
          {icon ?? <CheckBadgeIcon />}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
 * StarList (.star-list): feature list with gradient star bullets,
 * 21px / 525 title and 16px #666 description, 32px apart.
 * ------------------------------------------------------------------------- */

export interface StarListItem {
  title: ReactNode;
  description?: ReactNode;
  /** Replace the gradient star for this item. */
  icon?: ReactNode;
}

export interface StarListProps extends Omit<ComponentPropsWithoutRef<"ul">, "children"> {
  items: StarListItem[];
  /** Heading level for item titles. Default "h3". */
  titleAs?: "h3" | "h4" | "p";
}

export function StarList({ items, titleAs: Title = "h3", className, ...rest }: StarListProps) {
  return (
    <ul className={cn("star-list m-0 list-none p-0", className)} {...rest}>
      {items.map((item, i) => (
        <li key={i} className="star-item">
          {item.icon ?? <span className="star-bullet" aria-hidden="true" />}
          <div>
            <Title className="star-item__title">{item.title}</Title>
            {item.description ? <p className="star-item__desc">{item.description}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
