import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { crumbsFor } from "@/components/marketing/article-utils";
import { LegalLayout } from "@/components/marketing/legal-layout";
import PrivacyContent from "@/content/legal/privacy.mdx";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { getMdx } from "@/lib/mdx";
import { pageMetadata } from "@/lib/seo";

const PATH = "/privacy";

export const metadata = pageMetadata(PATH);

export default function PrivacyPage() {
  const doc = getMdx("legal", "privacy")!;
  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(PATH)))} />
      <LegalLayout doc={doc}>
        <PrivacyContent />
      </LegalLayout>
      <PageSheetEnd />
    </>
  );
}
