"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Sparkles, Check, Database, FileText, Globe } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SlideData {
  title: string;
  tagline: string;
  description: string;
  visual: React.ReactNode;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = right, -1 = left

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const slides: SlideData[] = [
    {
      title: "Query Databases in English",
      tagline: "STRUCTURED INTELLIGENCE",
      description: "Connect MongoDB or spreadsheet ledgers. Query data directly using natural language without writing pipelines or exports.",
      visual: (
        <div className="w-full h-32 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] flex flex-col justify-center px-6 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] font-mono text-[#2563eb] bg-[#2563eb]/10 px-2 py-0.5 rounded-full font-bold">PROMPT</span>
            <span className="text-[11px] text-[var(--text-primary)] font-medium">Show me top customers by revenue</span>
          </div>
          <div className="h-px w-full bg-[var(--border)] my-1" />
          <div className="flex items-start gap-2.5 mt-2">
            <Database size={13} className="text-emerald-500 mt-0.5" />
            <div className="font-mono text-[9.5px] text-[var(--text-secondary)] leading-relaxed">
              {"db.transactions.aggregate([{ $group: { _id: '$customer', total: { $sum: '$revenue' } } }])"}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Grounded Citation Engine",
      tagline: "UNSTRUCTURED DOCUMENTS",
      description: "Upload PDF agreements or developer guides. Get exact answers where every assertion highlights its original document source.",
      visual: (
        <div className="w-full h-32 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] flex flex-col justify-center px-6 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={13} className="text-[#2563eb]" />
            <span className="text-[11px] text-[var(--text-primary)] font-bold">Acme_Corp_Addendum_2026.pdf</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed font-light mb-2.5">
            Pricing discount is active at 15% with a 99.9% SLA uptime commitment...
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/10 px-2 py-0.5 rounded-md">
              [Page 3 · Citation 1]
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Hybrid Web Intelligence",
      tagline: "LIVE INTERNET WEB-AGENTS",
      description: "Cross-reference static guides or inventory with live internet searches to verify real-time competitive market pricing instantly.",
      visual: (
        <div className="w-full h-32 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] flex flex-col justify-center px-6 relative overflow-hidden">
          <div className="flex items-center gap-2.5 mb-2.5">
            <Globe size={13} className="text-[#2563eb]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">Web-Agent Dispatcher</span>
          </div>
          <div className="flex flex-col gap-1.5 border-l-2 border-[#2563eb] pl-3.5">
            <div className="text-[10px] font-mono text-emerald-500 font-bold">GET nvidia.com/en-us/rtx5090</div>
            <div className="text-[11px] text-[var(--text-primary)] font-medium">Verified current live pricing matches Sheets ledger.</div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setDirection(1);
      setCurrentSlide(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem("wuup_has_seen_welcome", "true");
    onClose();
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 160 : -160,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 160 : -160,
      opacity: 0
    })
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleFinish}
            className="fixed inset-0 z-[120]"
            style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
          />

          {/* Modal Container */}
          <div className="fixed z-[121] inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="w-full max-w-sm pointer-events-auto rounded-3xl overflow-hidden border relative flex flex-col"
              style={{
                background: "var(--bg-overlay)",
                borderColor: "var(--border)",
                boxShadow: isLight 
                  ? "0 20px 50px -12px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.01)" 
                  : "0 35px 70px -15px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02)",
              }}
            >
              {/* Close Button */}
              <button
                onClick={handleFinish}
                className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-highlight)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer z-20"
              >
                <X size={14} />
              </button>

              {/* Progress Line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--border)] z-10 flex">
                {slides.map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full transition-all duration-300"
                    style={{
                      background: i <= currentSlide ? "#2563eb" : "transparent"
                    }}
                  />
                ))}
              </div>

              {/* Slider Content Wrapper */}
              <div className="relative min-h-[350px] p-6 pt-10 flex flex-col justify-between overflow-hidden">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div
                    key={currentSlide}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ type: "spring", damping: 25, stiffness: 220 }}
                    className="flex flex-col gap-5 flex-1 justify-between"
                  >
                    <div className="space-y-4">
                      {/* Tagline */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[8.5px] uppercase font-bold tracking-[0.2em] text-[#2563eb]">
                          {slides[currentSlide].tagline}
                        </span>
                      </div>

                      {/* Header */}
                      <div className="space-y-2">
                        <h3 
                          className="text-lg font-bold tracking-tight text-[var(--text-primary)]"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {slides[currentSlide].title}
                        </h3>
                        <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed font-light">
                          {slides[currentSlide].description}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Mockup Visual */}
                    <div className="py-2">
                      {slides[currentSlide].visual}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation Bar */}
              <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-highlight)]/15 flex items-center justify-between z-10">
                {/* Back button */}
                <button
                  onClick={handlePrev}
                  disabled={currentSlide === 0}
                  className={`text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    currentSlide === 0 
                      ? "opacity-0 pointer-events-none" 
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <ArrowLeft size={12} />
                  <span>Back</span>
                </button>

                {/* Progress Indicators */}
                <div className="flex items-center gap-1.5">
                  {slides.map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                      style={{
                        background: i === currentSlide ? "#2563eb" : "var(--border)",
                        width: i === currentSlide ? "12px" : "6px",
                      }}
                    />
                  ))}
                </div>

                {/* Next button */}
                <button
                  onClick={handleNext}
                  className="px-4 py-2 rounded-full font-bold text-[11px] text-white bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.98] transition-all flex items-center gap-1 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 cursor-pointer"
                >
                  <span>{currentSlide === slides.length - 1 ? "Let's Go" : "Next"}</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
