"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function DashboardHero({ userName }: { userName: string }) {
  const [greeting, setGreeting] = useState("Good afternoon");

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5)       setGreeting("Rest well");
    else if (h < 12) setGreeting("Good morning");
    else if (h < 17) setGreeting("Good afternoon");
    else             setGreeting("Good evening");
  }, []);

  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center mb-10 pt-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mb-4 px-3 py-1 rounded-full border border-white/[0.05] bg-white/[0.02] text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2"
      >
        <div className="w-1 h-1 rounded-full bg-[var(--orange)] shadow-[0_0_8px_rgba(255,95,31,0.5)]" />
        Intelligence Engine
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-[36px] sm:text-[42px] tracking-[-0.03em] font-medium text-white/90 leading-tight mb-3"
      >
        {greeting}, <span className="gradient-text font-bold" style={{ fontFamily: "var(--font-display)" }}>{displayName}</span>.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="text-[16px] font-light tracking-wide max-w-[340px] leading-relaxed"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        Ready to explore your data. What would you like to know?
      </motion.p>
    </motion.div>
  );
}
