"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";

export interface MessageProps {
  role: "user" | "assistant";
  content: string;
}

export function MessageItem({ role, content }: MessageProps) {
  const isAssistant = role === "assistant";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1] // Custom easeOutExpo
      }}
      className="w-full max-w-3xl mx-auto py-10 border-b border-white/[0.02]"
    >
      <div className="flex gap-6 items-start">
        {/* Avatar Area */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-500
          ${isAssistant ? "bg-[#e27d60]/5 text-[#e27d60]/60" : "bg-white/[0.03] text-white/20"}
        `}>
          {isAssistant ? <Sparkles size={18} /> : <User size={18} />}
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-2 pt-1">
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-white/[0.08] lg:text-white/[0.05]">
            {isAssistant ? "WUP" : "You"}
          </p>
          <div className="text-white/80 leading-relaxed font-light text-[15px] selection:bg-white/10 whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
