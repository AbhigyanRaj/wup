import { getRelated } from "@/lib/registry";
import { GuideCard } from "./guide-card";

/*
 * "Related" block at the end of an article: three post cards from
 * getRelated(path), 3-up from 768px, inside the article's wide (1100px) frame.
 */
export function RelatedLinks({ path, title = "Keep reading", n = 3 }: { path: string; title?: string; n?: number }) {
  const related = getRelated(path, n);
  if (!related.length) return null;
  return (
    <section aria-labelledby="related-heading" className="mx-auto w-10/12 max-w-[1100px] pt-8 pb-8 md:w-full md:px-10 lg:px-0">
      <div className="mb-8 flex items-end justify-between gap-4 border-t border-st-secondary pt-12">
        <h2 id="related-heading" className="font-display text-heading-sub font-medium tracking-heading text-tx md:text-[32px]">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:gap-10 lg:grid-cols-3">
        {related.map((page) => (
          <GuideCard key={page.path} page={page} sizes="(min-width: 1024px) 340px, (min-width: 640px) 44vw, 88vw" />
        ))}
      </div>
    </section>
  );
}
