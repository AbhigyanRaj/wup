import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHead } from "@/components/ui/section";

/*
 * Kit "option cards" (home.md §10): three white 26px-radius cards with an
 * 80px soft-3D icon tile, an 18px title and a 16px grey description.
 * Each card is a link here, with a quiet arrow that nudges on hover.
 */

export interface OptionItem {
  href: string;
  title: string;
  description: string;
  tile: string;
}

export function OptionCards({ title, items }: { title: string; items: OptionItem[] }) {
  return (
    <section className="container section" aria-label={title.replace(/\n/g, " ")}>
      <SectionHead title={title} />
      <ul role="list" className="grid w-full grid-cols-1 gap-2 md:gap-6 lg:grid-cols-3">
        {items.map((o) => (
          <li key={o.title}>
            <Link
              href={o.href}
              className="option-card group h-full transition-[border-color,box-shadow] duration-200 hover:border-st hover:shadow-card"
            >
              <span className="option-card__tile relative overflow-hidden" aria-hidden="true">
                <Image src={o.tile} alt="" width={80} height={80} quality={90} className="size-20 scale-[1.18] object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="option-card__title flex items-center justify-between gap-2">
                  {o.title}
                  <ArrowRight
                    className="size-4 shrink-0 text-tx-muted transition-transform duration-200 ease-standard group-hover:translate-x-0.5 group-hover:text-tx-tertiary"
                    aria-hidden="true"
                  />
                </span>
                <span className="option-card__desc block">{o.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
