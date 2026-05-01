"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageItem, MessageProps } from "./message-item";
import { TypingIndicator } from "./typing-indicator";

interface MessageListProps {
  messages: MessageProps[];
  isTyping: boolean;
  onFollowUpSelect: (prompt: string) => void;
}

export function MessageList({ messages, isTyping, onFollowUpSelect }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Find the index of the last assistant message to show follow-up chips only there
  const lastAssistantIndex = messages.reduce(
    (lastIdx, msg, idx) => (msg.role === "assistant" ? idx : lastIdx),
    -1
  );

  return (
    <div className="w-full h-full">
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => (
          <MessageItem
            key={`msg-${index}`}
            role={msg.role}
            content={msg.content}
            ragSources={msg.ragSources}
            // Only show follow-ups on the last assistant message and not while typing
            followUps={
              index === lastAssistantIndex && !isTyping ? msg.followUps : undefined
            }
            onFollowUpSelect={onFollowUpSelect}
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
