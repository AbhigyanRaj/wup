import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/*
 * Public marketing shell (kit home.md "Global page structure"):
 * fixed header, the page sheet (#fcfcfc, rounded bottom edge over the footer),
 * and the column footer with the giant wordmark.
 * Pages render their sections and end with <PageSheetEnd /> (or CtaBand + PageSheetEnd).
 */
export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const analytics = process.env.NEXT_PUBLIC_ANALYTICS !== "off";
  return (
    <>
      <SiteHeader />
      <main id="main" className="page-sheet overflow-x-clip">
        {children}
      </main>
      <SiteFooter />
      {analytics ? (
        <>
          <Analytics />
          <SpeedInsights />
        </>
      ) : null}
    </>
  );
}
