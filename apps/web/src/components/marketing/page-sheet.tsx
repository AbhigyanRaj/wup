import { cn } from "@/lib/cn";

/*
 * The page sheet's closing edge (.page-sheet__end): a 64 / 112px spacer with a
 * 32px rounded bottom and hairline, so the sheet lifts off the footer.
 * Put it as the last child of every marketing page.
 */
export function PageSheetEnd({ className }: { className?: string }) {
  return <div className={cn("page-sheet__end -mt-24 md:-mt-[176px]", className)} aria-hidden="true" />;
}

/**
 * Inner-page rhythm: the marketing <main> spaces home sections 96 / 176px apart.
 * Inner pages use 96 / 128px; wrap their sections in this.
 */
export function InnerSheet({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col gap-24 md:gap-32", className)}>{children}</div>;
}
