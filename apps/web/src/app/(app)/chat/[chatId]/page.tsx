import type { Metadata } from "next";
import { noindexMetadata } from "@/lib/seo";

export const metadata: Metadata = { ...noindexMetadata, title: "Chat" };

/** Rendered by the chat layout (ChatScreen), which reads the id from the URL. */
export default function ChatPage() {
  return null;
}
