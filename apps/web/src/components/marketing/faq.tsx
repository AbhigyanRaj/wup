import { FaqAccordion } from "@/components/ui/accordion";
import { SectionHead } from "@/components/ui/section";
import type { Faq } from "@/content/types";

/*
 * Kit FAQ section (pricing.md §2.5): centred two-line heading, then the soft
 * FAQ accordion (max 896px). Answers are in the server HTML. No FAQPage schema.
 */
export function FaqSection({
  title = "Questions,\nanswered",
  intro,
  items,
}: {
  title?: string;
  intro?: string;
  items: Faq[];
}) {
  return (
    <section className="container section" aria-label="Frequently asked questions">
      <SectionHead title={title} intro={intro} />
      <FaqAccordion
        className="w-full"
        items={items.map((f, i) => ({ id: `faq-${i}`, title: f.q, content: <p>{f.a}</p> }))}
      />
    </section>
  );
}
