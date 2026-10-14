import type { Metadata } from "next";
import { noindexMetadata } from "@/lib/seo";

export const metadata: Metadata = { ...noindexMetadata, title: "New chat" };

/** Rendered by the chat layout (ChatScreen). */
export default function NewChatPage() {
  return null;
}
