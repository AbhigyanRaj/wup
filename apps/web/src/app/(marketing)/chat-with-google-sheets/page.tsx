import { notFound } from "next/navigation";
import { ConnectorTemplate } from "@/components/marketing/templates/connector-template";
import { getConnector } from "@/content/data/connectors";
import { pageMetadata } from "@/lib/seo";

const PATH = "/chat-with-google-sheets";
export const metadata = pageMetadata(PATH);

export default function Page() {
  const page = getConnector(PATH);
  if (!page) notFound();
  return <ConnectorTemplate page={page} />;
}
