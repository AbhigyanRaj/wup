import { ChatScreen } from "@/components/chat/chat-screen";

/*
 * Persistent chat layout. ChatScreen reads the chat id from the URL, so
 * /chat -> /chat/:id (after the first message) keeps the same screen mounted:
 * the composer keeps focus and the stream keeps rendering.
 * The pages themselves render nothing.
 */
export default function ChatLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ChatScreen />
      {children}
    </>
  );
}
