import { PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { crumbsFor } from "@/components/marketing/article-utils";
import { LegalLayout } from "@/components/marketing/legal-layout";
import AcceptableUseContent from "@/content/legal/acceptable-use.mdx";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { getMdx } from "@/lib/mdx";
import { pageMetadata } from "@/lib/seo";

const PATH = "/acceptable-use";

export const metadata = pageMetadata(PATH);

export default function AcceptableUsePage() {
  const doc = getMdx("legal", "acceptable-use")!;
  return (
    <>
      <JsonLd data={graph(breadcrumbList(crumbsFor(PATH)))} />
      <LegalLayout doc={doc}>
        <AcceptableUseContent />
      </LegalLayout>
      <PageSheetEnd />
    </>
  );
}
