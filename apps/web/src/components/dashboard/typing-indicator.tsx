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
            opacity: [0.6, 1, 0.6],
            scale: [0.95, 1.05, 0.95],
            boxShadow: [
              "0 0 0px rgba(226,125,96,0)",
              "0 0 20px rgba(226,125,96,0.2)",
              "0 0 0px rgba(226,125,96,0)"
            ]
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-[#e27d60]/20 text-[#e27d60] border border-[#e27d60]/30"
        >
          <Sparkles size={20} />
        </motion.div>

        {/* Shimmering Line */}
        <div className="flex-1 pt-4">
          <div className="relative h-[2px] w-48 bg-white/[0.05] overflow-hidden rounded-full">
            <motion.div 
              animate={{ 
                x: ["-100%", "200%"] 
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-[#e27d60] to-transparent"
            />
          </div>
          <p className="mt-3 text-[10px] tracking-[0.3em] font-bold text-[#e27d60]/60 uppercase animate-pulse">
            Brain is processing...
          </p>
        </div>
      </div>
    </motion.div>
  );
}
