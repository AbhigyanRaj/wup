import Link from "next/link";
import { cn } from "@/lib/cn";

/*
 * Kit breadcrumb (blog-post 2.1): 14px Figtree 425, #666, "/" separators,
 * links darken on hover. The last item is the current page (not a link).
 */
export interface BreadcrumbItem {
  name: string;
  path?: string;
}

export function Breadcrumbs({
  items,
  className,
  includeCurrent = false,
}: {
  items: BreadcrumbItem[];
  className?: string;
  /** Show the current (last) item. Articles hide it, like the kit. */
  includeCurrent?: boolean;
}) {
  const shown = includeCurrent ? items : items.slice(0, -1);
  if (!shown.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-2 text-caption text-tx-tertiary">
        {shown.map((item, i) => {
          const last = i === shown.length - 1;
          return (
            <li key={`${item.path ?? item.name}-${i}`} className="flex items-center gap-2">
              {item.path && !(includeCurrent && last) ? (
                <Link href={item.path} className={cn("rounded-sm transition-colors duration-150 hover:text-tx")}>
                  {item.name}
                </Link>
              ) : (
                <span aria-current={last && includeCurrent ? "page" : undefined}>{item.name}</span>
              )}
              {!last ? (
                <span aria-hidden="true" className="text-tx-muted">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
