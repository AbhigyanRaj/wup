"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-3xl mx-auto py-10"
    >
      <div className="flex gap-6 items-start">
        {/* Pulsing Icon */}
        <motion.div 
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            scale: [0.98, 1, 0.98]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-[#e27d60]/5 text-[#e27d60]/40"
        >
          <Sparkles size={20} />
        </motion.div>

        {/* Shimmering Line */}
        <div className="flex-1 pt-4">
          <div className="relative h-[1px] w-32 bg-white/[0.03] overflow-hidden rounded-full">
            <motion.div 
              animate={{ 
                x: ["-100%", "200%"] 
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-[#e27d60]/20 to-transparent"
            />
          </div>
          <p className="mt-2 text-[10px] tracking-[0.2em] font-medium text-white/5 uppercase italic">
            Processing...
          </p>
        </div>
      </div>
    </motion.div>
  );
}
