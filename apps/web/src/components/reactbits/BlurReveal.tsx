"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";

interface BlurRevealProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  highlightWords?: { word: string; className?: string; style?: React.CSSProperties }[];
}

export default function BlurReveal({
  text,
  className = "",
  delay = 0,
  duration = 0.8,
  highlightWords = [],
}: BlurRevealProps) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-10%" });
  const [words, setWords] = useState<string[]>([]);

  useEffect(() => {
    setWords(text.split(" "));
  }, [text]);

  return (
    <div ref={containerRef} className={`flex flex-wrap ${className}`}>
      {words.map((word, index) => {
        const highlight = highlightWords.find(h => h.word.toLowerCase() === word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase());
        return (
          <motion.span
            key={index}
            initial={{ filter: "blur(4px)", opacity: 0, y: 10 }}
            animate={isInView ? { filter: "blur(0px)", opacity: 1, y: 0 } : {}}
            transition={{
              duration: duration,
              delay: delay + index * 0.1,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className={`mr-[0.25em] ${highlight?.className || ""}`}
            style={highlight?.style}
          >
            {word}
          </motion.span>
        );
      })}
    </div>
  );
}
