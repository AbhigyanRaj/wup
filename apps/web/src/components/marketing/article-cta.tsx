import { CtaBand } from "@/components/marketing/cta-band";
import { SIGNUP } from "@/lib/site";
import { cn } from "@/lib/cn";

/*
 * Closing dusk CTA for articles, indexes and the changelog (blog-post 2.8).
 * Reuses the shared CtaBand so every page ends on the same band.
 */
export function ArticleCta({
  title = "Ask your data a question.\nSee the query behind the answer.",
  className,
}: {
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn("py-16", className)}>
      <CtaBand
        title={title}
        primary={{ label: "Try wuup free", href: SIGNUP }}
        secondary={{ label: "Read the docs", href: "/docs" }}
      />
    </div>
  );
}
