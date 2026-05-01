"use client";

import React, { useEffect, useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Maximize2, X, Code2 } from "lucide-react";

interface MermaidDiagramProps {
  code: string;
}

function sanitizeMermaid(code: string): string {
  return code
    .replace(/\[([^\]"]*[()\/\\&|<>][^\]"]*)\]/g, '["$1"]')
    .replace(/\{([^}"]*[()\/\\&|<>][^}"]*)\}/g, '{"$1"}');
}

/**
 * Post-processes the Mermaid SVG output to apply premium visual styling:
 * - Rounded corners on all rect elements
 * - Responsive width
 * - Subtle drop-shadow filter for depth
 */
function postProcessSvg(svgHtml: string): string {
  let result = svgHtml;

  // Make responsive
  result = result
    .replace(/width="[\d.]+(?:px)?"/, 'width="100%"')
    .replace(/height="[\d.]+(?:px)?"/, 'height="auto"');

  // Inject a premium drop-shadow filter definition after <defs> or at start of <svg>
  const filterDef = `
    <defs>
      <filter id="wup-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.35)" flood-opacity="1"/>
      </filter>
    </defs>`;

  if (result.includes('<defs>')) {
    result = result.replace('<defs>', filterDef.trim().replace('<defs>', '<defs>'));
  } else {
    result = result.replace('<svg ', `<svg `);
    result = result.replace(/(<svg[^>]*>)/, `$1${filterDef}`);
  }

  // Round all rect corners that don't already have rx
  result = result.replace(/<rect(?![^>]*\brx=)([^>]*?)(\/>|>)/g, '<rect rx="10" ry="10"$1$2');

  // Add drop-shadow filter to node rects (those with fill colors, not transparent background)
  result = result.replace(/<rect rx="10" ry="10"([^>]*?)fill="(?!none|transparent|rgba\(0,0,0,0\))([^"]+)"([^>]*?)(\/>|>)/g,
    '<rect rx="10" ry="10"$1fill="$2"$3 filter="url(#wup-shadow)"$4>');

  // Set overall SVG display style
  result = result.replace('<svg ', '<svg style="max-width:100%;display:block;overflow:visible;" ');

  return result;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            primaryColor: "#1e293b",
            primaryTextColor: "#e2e8f0",
            primaryBorderColor: "rgba(255,255,255,0.12)",
            lineColor: "rgba(255,255,255,0.3)",
            secondaryColor: "#0f172a",
            tertiaryColor: "#1e293b",
            background: "transparent",
            nodeBorder: "rgba(255,255,255,0.1)",
            clusterBkg: "rgba(255,255,255,0.02)",
            edgeLabelBackground: "transparent",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            fontSize: "13px",
          },
          flowchart: { curve: "basis", padding: 32 },
          securityLevel: "sandbox",
        });

        const id = `mermaid-${uid}`;
        const { svg: rendered } = await mermaid.render(id, sanitizeMermaid(code));
        if (!cancelled) {
          setSvg(postProcessSvg(rendered));
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Diagram rendering failed.");
      }
    };
    render();
    return () => { cancelled = true; };
  }, [code, uid]);

  const handleDownload = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wup-diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div
        className="rounded-xl px-4 py-3 text-[12px] font-mono mt-4"
        style={{
          background: "rgba(248,113,113,0.04)",
          border: "1px solid rgba(248,113,113,0.12)",
          color: "rgba(248,113,113,0.6)",
        }}
      >
        Diagram error: {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex items-center gap-2 mt-4 py-3 text-[12px]" style={{ color: "rgba(255,255,255,0.15)" }}>
        <div className="w-1.5 h-1.5 rounded-full bg-[#ff5f1f] animate-pulse" />
        Rendering diagram...
      </div>
    );
  }

  return (
    <>
      {/* ── Inline diagram — no box, flows naturally in chat ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-5 group"
      >
        {/* Action row — appears on hover, sits above diagram */}
        <div
          className="flex items-center justify-between mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <span
            className="text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{ color: "rgba(255,255,255,0.15)" }}
          >
            Diagram
          </span>
          <div className="flex items-center gap-1">
            <ActionBtn onClick={() => setShowCode(s => !s)} active={showCode} title="View source">
              <Code2 size={12} />
            </ActionBtn>
            <ActionBtn onClick={handleDownload} title="Export SVG">
              <Download size={12} />
            </ActionBtn>
            <ActionBtn onClick={() => setIsExpanded(true)} title="Expand">
              <Maximize2 size={12} />
            </ActionBtn>
          </div>
        </div>

        {/* Source code toggle */}
        <AnimatePresence>
          {showCode && (
            <motion.pre
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-[11px] font-mono mb-4 p-4 rounded-xl overflow-x-auto"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.4)",
                lineHeight: "1.6",
              }}
            >
              {code.trim()}
            </motion.pre>
          )}
        </AnimatePresence>

        {/* The diagram — full natural width, no fixed height, scrolls with page */}
        <div
          className="w-full"
          style={{ lineHeight: 0 }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </motion.div>

      {/* ── Expanded side panel (Claude-style artifact view) ── */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100]"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
              onClick={() => setIsExpanded(false)}
            />

            {/* Slide-in panel from right */}
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-0 top-0 bottom-0 z-[101] flex flex-col"
              style={{
                width: "min(680px, 90vw)",
                background: "#0e0e0e",
                borderLeft: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-6 py-4 shrink-0"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.25em]"
                  style={{ color: "rgba(255,255,255,0.25)" }}
                >
                  Diagram
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-colors hover:bg-white/5"
                    style={{
                      color: "rgba(255,255,255,0.35)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <Download size={11} /> Export SVG
                  </button>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Panel body — scrollable, diagram at natural size */}
              <div
                className="flex-1 overflow-y-auto overflow-x-hidden px-8 py-8"
              >
                <div dangerouslySetInnerHTML={{ __html: svg }} />
              </div>

              {/* Source code section */}
              <div
                className="shrink-0 px-6 py-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
              >
                <button
                  onClick={() => setShowCode(s => !s)}
                  className="flex items-center gap-2 text-[11px] transition-colors hover:text-white/60"
                  style={{ color: "rgba(255,255,255,0.2)" }}
                >
                  <Code2 size={12} />
                  {showCode ? "Hide" : "View"} source
                </button>
                <AnimatePresence>
                  {showCode && (
                    <motion.pre
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[11px] font-mono mt-3 overflow-x-auto"
                      style={{ color: "rgba(255,255,255,0.3)", lineHeight: "1.6" }}
                    >
                      {code.trim()}
                    </motion.pre>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Small reusable action button
function ActionBtn({
  onClick,
  children,
  title,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg transition-all duration-150 hover:bg-white/8 active:scale-95"
      style={{
        color: active ? "#ff5f1f" : "rgba(255,255,255,0.3)",
        background: active ? "rgba(255,95,31,0.08)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}
