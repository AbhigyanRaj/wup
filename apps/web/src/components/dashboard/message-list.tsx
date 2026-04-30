"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageItem, MessageProps } from "./message-item";
import { TypingIndicator } from "./typing-indicator";

interface MessageListProps {
  messages: MessageProps[];
  isTyping: boolean;
}

export function MessageList({ messages, isTyping }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="w-full h-full">
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => (
          <MessageItem
            key={`msg-${index}`}
            role={msg.role}
            content={msg.content}
            ragSources={msg.ragSources}
          />
        ))}
      </AnimatePresence>

      {/* Typing indicator — wrapped in AnimatePresence so it animates in/out */}
      <AnimatePresence>
        {isTyping && <TypingIndicator key="typing" />}
      </AnimatePresence>

      <div ref={bottomRef} className="h-36" />
    </div>
  );
}
