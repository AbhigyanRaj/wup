"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";

interface TypingIndicatorProps {
  statuses: string[];
}

export function TypingIndicator({ statuses }: TypingIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);

  // Still keep a simple timer just to show "how long it took" 
  useEffect(() => {
    setElapsed(0);
    elapsedRef.current = setInterval(() => {
      setElapsed(s => s + 1);
    }, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="w-full py-5"
    >
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-start gap-4">

          {/* AI avatar — subtle pulsing orb */}
          <div className="relative w-6 h-6 shrink-0 mt-0.5 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-full h-full rounded-full"
              style={{ background: "var(--orange-glow)" }}
            />
            <div
              className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,95,31,0.5)]"
              style={{ background: "var(--orange)" }}
            />
          </div>

          {/* Thinking content */}
          <div className="flex flex-col gap-3 pt-0.5 flex-1">
            
            {/* Header: Title + Timer */}
            <div className="flex items-center justify-between max-w-sm">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">
                Agentic Process
              </span>
              <motion.span
                key={elapsed}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                className="text-[12px] tabular-nums font-medium"
                style={{ color: "var(--orange)", opacity: 0.8 }}
              >
                {elapsed}s
              </motion.span>
            </div>

            {/* Vertical Steps */}
            <div className="flex flex-col gap-2.5">
              <AnimatePresence>
                {statuses.map((step, index) => {
                  const isCompleted = index < statuses.length - 1;
                  const isActive = index === statuses.length - 1;

                  return (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, height: "auto", scale: 1 }} 
                      exit={{ opacity: 0, height: 0 }}
                      key={`${step}-${index}`} 
                      className="flex items-center gap-3"
                    >
                      {/* Status Icon */}
                      <div className="w-5 h-5 flex items-center justify-center">
                        {isCompleted ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            <Check className="w-4 h-4 text-emerald-500" />
                          </motion.div>
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-700" />
                        )}
                      </div>

                      {/* Step Text */}
                      <span
                        className={`text-[13px] font-medium transition-colors duration-300 ${
                          isActive 
                            ? "text-white" 
                            : "text-zinc-500"
                        }`}
                      >
                        {step}
                      </span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
