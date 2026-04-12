"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MessageProps {
  role: "user" | "assistant";
  content: string;
}

export function MessageItem({ role, content }: MessageProps) {
  const isAssistant = role === "assistant";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ 
        duration: 0.6, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      className="w-full py-8 border-b border-white/[0.01]"
    >
      <div className={`
        flex gap-4 lg:gap-8 max-w-4xl mx-auto px-6
        ${isAssistant ? "flex-row items-start" : "flex-row-reverse items-start"}
      `}>
        {/* Avatar Area */}
        <div className={`
          flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-500
          ${isAssistant 
            ? "bg-[#e27d60]/10 border-[#e27d60]/20 text-[#e27d60] shadow-[0_0_20px_rgba(226,125,96,0.1)]" 
            : "bg-white/[0.05] border-white/10 text-white/40 shadow-sm"}
        `}>
          {isAssistant ? <Sparkles size={18} /> : <User size={18} />}
        </div>

        {/* Content Area */}
        <div className={`flex-1 flex flex-col ${isAssistant ? "items-start" : "items-end"}`}>
          <div className={`
            prose prose-invert max-w-none text-[15px] leading-[1.7] font-light selection:bg-[#e27d60]/20
            ${isAssistant ? "text-white/80" : "text-white/90 bg-[#111] p-5 rounded-2xl border border-white/[0.05] shadow-2xl"}
          `}>
             <ReactMarkdown 
               remarkPlugins={[remarkGfm]}
               components={{
                 table: ({node, ...props}) => (
                   <div className="overflow-x-auto my-6 rounded-xl border border-white/10 bg-white/[0.02]">
                     <table className="w-full text-sm text-left border-collapse" {...props} />
                   </div>
                 ),
                 thead: ({node, ...props}) => <thead className="bg-white/5 text-white/40 uppercase tracking-widest text-[10px] font-bold" {...props} />,
                 th: ({node, ...props}) => <th className="px-5 py-3 border-b border-white/10 font-bold" {...props} />,
                 td: ({node, ...props}) => <td className="px-5 py-4 border-b border-white/[0.05] font-light text-white/60" {...props} />,
                 code: ({node, ...props}) => (
                   <code className="bg-white/10 px-1.5 py-0.5 rounded text-[#e27d60] font-mono text-sm" {...props} />
                 ),
                 pre: ({node, ...props}) => (
                   <pre className="p-5 rounded-2xl bg-[#0d0d0d] border border-white/5 my-6 overflow-x-auto shadow-2xl" {...props} />
                 ),
                 p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                 a: ({node, ...props}) => <a className="text-[#e27d60] underline underline-offset-4 hover:text-[#e27d60]/80 transition-colors" {...props} />,
               }}
             >
               {content}
             </ReactMarkdown>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
