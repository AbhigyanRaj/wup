import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { crumbsFor } from "@/components/marketing/article-utils";
import { LegalLayout } from "@/components/marketing/legal-layout";
import TermsContent from "@/content/legal/terms.mdx";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { getMdx } from "@/lib/mdx";
import { pageMetadata } from "@/lib/seo";

const PATH = "/terms";

export const metadata = pageMetadata(PATH);

export default function TermsPage() {
  const doc = getMdx("legal", "terms")!;
  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(PATH)))} />
      <LegalLayout doc={doc}>
        <TermsContent />
      </LegalLayout>
      <PageSheetEnd />
    </>
  );
}
