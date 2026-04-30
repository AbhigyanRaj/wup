"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Agentic "thinking" phases — rotates while the Brain is working.
 * Mimics the Antigravity-style step display.
 */
const THINKING_STEPS = [
  "Retrieving context",
  "Searching knowledge base",
  "Analyzing your query",
  "Calling data bridges",
  "Synthesizing answer",
  "Generating response",
];

const STEP_INTERVAL_MS = 2200; // Rotate step label every ~2.2s

export function TypingIndicator() {
  const [elapsed, setElapsed]     = useState(0);        // Seconds elapsed
  const [stepIdx, setStepIdx]     = useState(0);        // Current step label index
  const [stepVisible, setStepVisible] = useState(true); // For cross-fade

  const elapsedRef  = useRef<NodeJS.Timeout | null>(null);
  const stepRef     = useRef<NodeJS.Timeout | null>(null);

  // Elapsed second counter
  useEffect(() => {
    setElapsed(0);
    elapsedRef.current = setInterval(() => {
      setElapsed(s => s + 1);
    }, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, []);

  // Step label rotation with cross-fade
  useEffect(() => {
    setStepIdx(0);
    setStepVisible(true);

    const rotate = () => {
      // Fade out
      setStepVisible(false);
      setTimeout(() => {
        setStepIdx(i => (i + 1) % THINKING_STEPS.length);
        setStepVisible(true);
      }, 300); // After fade-out, swap text and fade back in
    };

    stepRef.current = setInterval(rotate, STEP_INTERVAL_MS);
    return () => { if (stepRef.current) clearInterval(stepRef.current); };
  }, []);

  const currentStep = THINKING_STEPS[stepIdx];

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
          <div className="flex flex-col gap-2.5 pt-0.5 flex-1">

            {/* Top row: step label + elapsed timer */}
            <div className="flex items-center gap-3">

              {/* Step label with cross-fade */}
              <div className="relative h-4 flex items-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentStep}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: stepVisible ? 1 : 0, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="text-[13px] font-medium absolute whitespace-nowrap"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {currentStep}
                  </motion.span>
                </AnimatePresence>
                {/* Invisible spacer to hold width */}
                <span className="text-[13px] font-medium invisible">
                  {THINKING_STEPS.reduce((a, b) => a.length > b.length ? a : b)}
                </span>
              </div>

              {/* Separator dot */}
              <div
                className="w-1 h-1 rounded-full shrink-0"
                style={{ background: "rgba(255,255,255,0.15)" }}
              />

              {/* Elapsed timer — ticks up */}
              <motion.span
                key={elapsed}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                className="text-[12px] tabular-nums font-medium"
                style={{ color: "var(--orange)", fontVariantNumeric: "tabular-nums", opacity: 0.8 }}
              >
                {elapsed}s
              </motion.span>
            </div>

            {/* Animated shimmer progress bar */}
            <div
              className="relative h-[2px] w-48 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 w-1/2 rounded-full"
                style={{
                  background: "linear-gradient(90deg, transparent, var(--orange), transparent)",
                  opacity: 0.4
                }}
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
