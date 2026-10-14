import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { StarList, type StarListItem } from "@/components/ui/checklist";
import { SectionHead } from "@/components/ui/section";

/*
 * Kit "illustration + star list" (home.md §7): centred H2, then an
 * illustration card on the left and three gradient-star items on the right
 * with a full-width ink button. Falls back to a blue gradient card when the
 * illustration file is missing.
 */

export interface StarListSplitProps {
  title: string;
  items: StarListItem[];
  image?: { src: string; alt: string; width: number; height: number };
  cta: { label: string; href: string };
}

function exists(src: string) {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", src));
  } catch {
    return false;
  }
}

export function StarListSplit({ title, items, image, cta }: StarListSplitProps) {
  const showImage = image && exists(image.src);
  return (
    <section className="container section" aria-label={title.replace(/\n/g, " ")}>
      <SectionHead title={title} />
      <div className="split">
        <div className="relative aspect-[540/408] overflow-hidden rounded-xl border border-st-secondary bg-[image:var(--gradient-blue-light)]">
          {showImage ? (
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 1440px) 568px, (min-width: 768px) 40vw, 88vw"
              quality={80}
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-col">
          <StarList items={items} />
          <ButtonLink href={cta.href} variant="ink" block className="mt-10 md:mt-14">
            {cta.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
