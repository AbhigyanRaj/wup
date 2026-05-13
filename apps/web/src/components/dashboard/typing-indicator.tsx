"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";

/**
 * Agentic "thinking" phases — simulates a step-by-step check.
 */
const THINKING_STEPS = [
  "Retrieving context",
  "Searching knowledge base",
  "Analyzing your query",
  "Calling data bridges",
  "Synthesizing answer",
  "Generating response",
];

const STEP_INTERVAL_MS = 1500; // Move to next step every 1.5s for a snappier feel

export function TypingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  const elapsedRef = useRef<NodeJS.Timeout | null>(null);
  const stepRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed second counter
  useEffect(() => {
    setElapsed(0);
    elapsedRef.current = setInterval(() => {
      setElapsed(s => s + 1);
    }, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, []);

  // Step progression
  useEffect(() => {
    setStepIdx(0);
    stepRef.current = setInterval(() => {
      setStepIdx(i => {
        if (i < THINKING_STEPS.length - 1) {
          return i + 1;
        }
        return i; // Stop at the last step instead of looping
      });
    }, STEP_INTERVAL_MS);
    return () => { if (stepRef.current) clearInterval(stepRef.current); };
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
              {THINKING_STEPS.map((step, index) => {
                const isCompleted = index < stepIdx;
                const isActive = index === stepIdx;
                const isPending = index > stepIdx;

                return (
                  <div key={step} className="flex items-center gap-3">
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
                          : isCompleted 
                          ? "text-zinc-500" 
                          : "text-zinc-700"
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
