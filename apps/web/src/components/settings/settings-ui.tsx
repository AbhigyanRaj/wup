"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";

export const SETTINGS_SECTIONS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/personalization", label: "Personalization" },
  { href: "/settings/models", label: "Models and keys" },
  { href: "/settings/usage", label: "Usage and plan" },
  { href: "/settings/privacy", label: "Privacy and data" },
] as const;

/** Docs-style secondary nav (desktop) and a scrollable segmented control (mobile). */
export function SettingsNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const active = SETTINGS_SECTIONS.find((s) => pathname.startsWith(s.href))?.href ?? SETTINGS_SECTIONS[0].href;
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the active section visible in the mobile scroller.
  useEffect(() => {
    const el = scroller.current;
    const on = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !on) return;
    el.scrollTo({ left: on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2, behavior: "instant" as ScrollBehavior });
  }, [active]);

  return (
    <>
      <nav aria-label="Settings" className="hidden md:block">
        <ul className="sticky top-6 flex flex-col gap-0.5">
          {SETTINGS_SECTIONS.map((s) => {
            const on = s.href === active;
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-[34px] items-center rounded-lg px-3 text-[15px] transition-colors duration-150 ease-standard",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400",
                    on ? "bg-sf-secondary font-medium text-tx" : "text-tx-tertiary hover:bg-sf-secondary/60 hover:text-tx",
                  )}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div ref={scroller} className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        <SegmentedControl
          aria-label="Settings section"
          size="sm"
          value={active}
          onChange={(v) => router.push(v)}
          options={SETTINGS_SECTIONS.map((s) => ({ value: s.href, label: s.label }))}
        />
      </div>
    </>
  );
}

/** Page heading inside the settings content column. */
export function SettingsHeader({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[24px] font-medium leading-[1.3] tracking-[-0.02em] text-tx">{title}</h2>
      {description ? <p className="mt-1.5 text-[15px] leading-[1.6] text-tx-tertiary">{description}</p> : null}
    </div>
  );
}

/** White settings card: title + description, body, optional footer with actions on the right. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  footerNote,
  className,
  tone = "default",
  id,
  as: Comp = "section",
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  footerNote?: React.ReactNode;
  className?: string;
  tone?: "default" | "danger";
  id?: string;
  as?: "section" | "form" | "div";
}) {
  return (
    <Comp
      id={id}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className={cn(
        "overflow-hidden rounded-2xl border bg-sf-white",
        tone === "danger" ? "border-red-100" : "border-st-secondary",
        className,
      )}
    >
      {title || description ? (
        <div className={cn("px-5 pt-5 sm:px-7 sm:pt-6", !children && "pb-5 sm:pb-6")}>
          {title ? (
            <h3 id={id ? `${id}-title` : undefined} className="text-[18px] font-medium leading-[1.35] tracking-[-0.015em] text-tx">
              {title}
            </h3>
          ) : null}
          {description ? <p className="mt-1 text-[14px] leading-[1.6] text-tx-tertiary">{description}</p> : null}
        </div>
      ) : null}
      {children ? <div className="px-5 py-5 sm:px-7 sm:py-6">{children}</div> : null}
      {footer ? (
        <div
          className={cn(
            "flex flex-col-reverse gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7",
            tone === "danger" ? "border-red-100 bg-red-50/40" : "border-st-secondary bg-sf-secondary/40",
          )}
        >
          {footerNote ? <p className="text-[13px] leading-5 text-tx-tertiary sm:mr-auto">{footerNote}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">{footer}</div>
        </div>
      ) : null}
    </Comp>
  );
}

/** A label/description row with a control on the right (switches, buttons). */
export function SettingRow({
  title,
  description,
  control,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0", className)}>
      <div className="min-w-0">
        <div className="text-[15px] font-medium text-tx">{title}</div>
        {description ? <p className="mt-0.5 text-[14px] leading-[1.55] text-tx-tertiary">{description}</p> : null}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
