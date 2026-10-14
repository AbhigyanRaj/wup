import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Kit stat rows (.stat-row): label left (16px #666), value right
 * (20px / 525, tabular numbers), hairline divider between rows.
 */

export interface StatRowProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  label: ReactNode;
  value: ReactNode;
}

export function StatRow({ label, value, className, ...rest }: StatRowProps) {
  return (
    <div className={cn("stat-row", className)} {...rest}>
      <span className="stat-row__label">{label}</span>
      <span className="stat-row__value">{value}</span>
    </div>
  );
}

/** Groups StatRows. Pass `items` or StatRow children. */
export function StatRows({
  items,
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { items?: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <div className={cn("flex flex-col", className)} {...rest}>
      {items?.map((item, i) => <StatRow key={i} label={item.label} value={item.value} />)}
      {children}
    </div>
  );
}
