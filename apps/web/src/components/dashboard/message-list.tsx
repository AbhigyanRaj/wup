"use client";

import React, { useEffect, useRef } from "react";
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
      {messages.map((msg, index) => (
        <MessageItem key={index} role={msg.role} content={msg.content} />
      ))}
      
      {isTyping && <TypingIndicator />}
      
      <div ref={bottomRef} className="h-40" />
    </div>
  );
}
