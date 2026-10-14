import type { KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { navIcon, navShort } from "./nav-meta";

/*
 * Kit mega dropdown (home.md §1, states/nav-products-open.jpg): a full-width
 * white panel under the header. Left: mono label + 2-column list of items
 * (44px icon tile with a hairline, 18px title, 14px grey description).
 * Right: a featured card (gradient tile + caption). Rendered by HeaderClient.
 */

export interface MegaLink {
  path: string;
  label: string;
  description: string;
}

export interface MegaFeatured {
  href: string;
  title: string;
  caption: string;
  tone: string;
}

export interface MegaMenuProps {
  id: string;
  label: string;
  links: MegaLink[];
  featured?: MegaFeatured;
  onNavigate: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export function MegaMenu({ id, label, links, featured, onNavigate, onKeyDown }: MegaMenuProps) {
  return (
    <div id={id} className="mega" role="region" aria-label={`${label} menu`} onKeyDown={onKeyDown}>
      <div className="container grid gap-12 pt-10 pb-14 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="label-mono text-tx-tertiary">{label}</p>
          <ul className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2" role="list">
            {links.map((l) => {
              const Icon = navIcon(l.path);
              return (
                <li key={l.path}>
                  <Link href={l.path} className="mega-item group" onClick={onNavigate} data-mega-link>
                    <span className="mega-item__icon text-tx-secondary transition-colors duration-200 group-hover:text-indigo-700">
                      <Icon width={20} height={20} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="mega-item__title block">{l.label}</span>
                      <span className="mega-item__desc block truncate">{navShort(l.path, l.description)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        {featured ? (
          <Link href={featured.href} className="mega-feature group block" onClick={onNavigate} data-mega-link>
            <span
              className="relative block aspect-[16/9] overflow-hidden rounded-xl"
              style={{ background: featured.tone }}
              aria-hidden="true"
            >
              <span className="absolute inset-0 bg-[image:var(--noise-url)] bg-[length:256px] opacity-40 mix-blend-soft-light" />
              <span className="absolute -bottom-16 left-1/2 size-56 -translate-x-1/2 rounded-full border border-white/25" />
              <span className="absolute -bottom-24 left-1/2 size-72 -translate-x-1/2 rounded-full border border-white/15" />
              <span className="absolute inset-x-6 top-6 flex flex-col gap-2">
                <span className="w-fit rounded-xl rounded-br-sm bg-white/90 px-3 py-1.5 text-[12px] text-tx shadow-sm">
                  Revenue by month this year?
                </span>
                <span className="flex h-12 items-end gap-1.5 rounded-lg bg-white/15 p-2 backdrop-blur-sm">
                  {[38, 52, 46, 70, 88, 64].map((h, i) => (
                    <span key={i} className="flex-1 rounded-t-[3px] bg-white/85" style={{ height: `${h}%` }} />
                  ))}
                </span>
              </span>
            </span>
            <span className="mega-feature__caption flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium text-tx">{featured.title}</span>
                <span className="mt-1 block text-[14px] leading-[1.5] text-tx-tertiary">{featured.caption}</span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-tx-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-tx-tertiary"
                aria-hidden="true"
              />
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
