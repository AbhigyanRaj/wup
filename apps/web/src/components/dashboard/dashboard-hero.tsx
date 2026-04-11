"use client";

import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export function DashboardHero({ userName }: { userName: string }) {
  const [greeting, setGreeting] = useState("Good evening");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  return (
    <div className="flex flex-col items-center justify-center mb-10 pt-20 animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
      <div className="flex items-center gap-4 mb-2 group">
        <div className="text-[#e27d60] animate-pulse-slow">
          <Sparkles size={32} fill="currentColor" className="opacity-80" />
        </div>
        <h1 className="text-[52px] font-serif italic text-[#c9c9c9] tracking-tight leading-none selection:text-white">
          {greeting}, {userName}
        </h1>
      </div>
    </div>
  );
}
