import Link from "next/link";
import { cn } from "@/lib/cn";
import type { DocsNavGroup } from "./docs-nav";

/*
 * Docs nav tree (docs.md 2.2): group headings 14px / 600, links 34px tall,
 * 8px padding, radius 8, 14px #666; hover #f5f5f5; active #f0f0f0 with
 * #1f1f1f text and no left bar.
 */
export function DocsNavTree({ groups, currentPath }: { groups: DocsNavGroup[]; currentPath?: string }) {
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-8">
      <div>
        <Link
          href="/docs"
          aria-current={currentPath === "/docs" ? "page" : undefined}
          className={cn(
            "flex min-h-[34px] items-center rounded-lg px-2 text-caption transition-colors duration-150 ease-standard",
            currentPath === "/docs" ? "bg-sf-tertiary font-medium text-tx" : "text-tx-tertiary hover:bg-sf-secondary hover:text-tx",
          )}
        >
          Overview
        </Link>
      </div>
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 px-2 text-caption font-semibold text-tx">{g.label}</p>
          <ul className="flex flex-col">
            {g.items.map((item) => {
              const active = item.path === currentPath;
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[34px] items-center rounded-lg px-2 py-1.5 text-caption leading-[1.25] transition-colors duration-150 ease-standard",
                      active ? "bg-sf-tertiary font-medium text-tx" : "text-tx-tertiary hover:bg-sf-secondary hover:text-tx",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
