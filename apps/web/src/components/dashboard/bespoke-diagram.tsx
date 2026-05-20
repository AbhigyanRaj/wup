"use client";

import React, { useMemo } from "react";
import { useTheme } from "@/components/theme-provider";

interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  type?: string; // "start" | "action" | "decision" | "success" | "error"
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export function BespokeDiagram({ data }: { data: DiagramData }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  
  const { nodes, edges } = data;

  const width = 480;
  const nodeWidth = 240;
  const nodeHeight = 60;
  const verticalGap = 45;
  const paddingTop = 25;
  const paddingBottom = 25;

  // 1. Simple vertical layout positioning
  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node, i) => {
      pos[node.id] = {
        x: width / 2,
        y: paddingTop + i * (nodeHeight + verticalGap),
      };
    });
    return pos;
  }, [nodes]);

  const svgHeight = useMemo(() => {
    if (nodes.length === 0) return 100;
    return paddingTop + paddingBottom + nodes.length * (nodeHeight + verticalGap) - verticalGap;
  }, [nodes]);

  // Color theme mapper based on node types and current theme mode
  const getNodeTheme = (type?: string) => {
    if (isLight) {
      switch (type) {
        case "start":
        case "end":
          return {
            bg: "rgba(244, 244, 245, 0.8)",
            border: "rgba(161, 161, 170, 0.4)",
            text: "#27272a",
            glow: "rgba(161, 161, 170, 0.04)",
          };
        case "decision":
          return {
            bg: "rgba(139, 92, 246, 0.08)",
            border: "rgba(109, 40, 217, 0.35)",
            text: "#6d28d9",
            glow: "rgba(109, 40, 217, 0.05)",
          };
        case "success":
          return {
            bg: "rgba(34, 197, 94, 0.08)",
            border: "rgba(21, 128, 61, 0.35)",
            text: "#15803d",
            glow: "rgba(21, 128, 61, 0.05)",
          };
        case "error":
          return {
            bg: "rgba(239, 68, 68, 0.08)",
            border: "rgba(185, 28, 28, 0.35)",
            text: "#b91c1c",
            glow: "rgba(185, 28, 28, 0.05)",
          };
        case "action":
        default:
          return {
            bg: "rgba(59, 130, 246, 0.08)",
            border: "rgba(29, 78, 216, 0.35)",
            text: "#1d4ed8",
            glow: "rgba(29, 78, 216, 0.06)",
          };
      }
    } else {
      switch (type) {
        case "start":
        case "end":
          return {
            bg: "rgba(63, 63, 70, 0.4)",
            border: "rgba(113, 113, 122, 0.5)",
            text: "#f4f4f5",
            glow: "rgba(113, 113, 122, 0.2)",
          };
        case "decision":
          return {
            bg: "rgba(109, 40, 217, 0.2)",
            border: "rgba(139, 92, 246, 0.5)",
            text: "#c084fc",
            glow: "rgba(139, 92, 246, 0.25)",
          };
        case "success":
          return {
            bg: "rgba(21, 128, 61, 0.2)",
            border: "rgba(34, 197, 94, 0.5)",
            text: "#4ade80",
            glow: "rgba(34, 197, 94, 0.25)",
          };
        case "error":
          return {
            bg: "rgba(185, 28, 28, 0.2)",
            border: "rgba(239, 68, 68, 0.5)",
            text: "#fca5a5",
            glow: "rgba(239, 68, 68, 0.25)",
          };
        case "action":
        default:
          return {
            bg: "rgba(29, 78, 216, 0.25)",
            border: "rgba(59, 130, 246, 0.5)",
            text: "#60a5fa",
            glow: "rgba(59, 130, 246, 0.35)",
          };
      }
    }
  };

  if (!nodes || nodes.length === 0) {
    return (
      <div 
        className="w-full h-32 rounded-2xl flex items-center justify-center border text-xs opacity-40"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-overlay)"
        }}
      >
        No diagram data available
      </div>
    );
  }

  return (
    <div
      className="w-full my-6 p-6 rounded-2xl shadow-xl flex justify-center overflow-auto custom-scrollbar select-none"
      style={{
        background: isLight ? "rgba(245, 246, 248, 0.65)" : "rgba(12, 13, 18, 0.6)",
        backdropFilter: "blur(12px)",
        border: isLight ? "1px solid rgba(0, 0, 0, 0.06)" : "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div className="w-full max-w-[480px]">
        <svg
          viewBox={`0 0 ${width} ${svgHeight}`}
          className="w-full overflow-visible"
          style={{ height: svgHeight }}
        >
          <defs>
            {/* Arrow Marker */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path 
                d="M 0 1.5 L 7 5 L 0 8.5 z" 
                fill={isLight ? "#a1a1aa" : "#3f3f46"} 
                className="opacity-60" 
              />
            </marker>
          </defs>

          {/* Edges / Connections */}
          {edges.map((edge, i) => {
            const fromPos = nodePositions[edge.from];
            const toPos = nodePositions[edge.to];

            if (!fromPos || !toPos) return null;

            // Connection points (Bottom Center of 'From' -> Top Center of 'To')
            const startX = fromPos.x;
            const startY = fromPos.y + nodeHeight / 2;
            const endX = toPos.x;
            const endY = toPos.y - nodeHeight / 2;

            const midY = (startY + endY) / 2;

            return (
              <g key={i}>
                <path
                  d={`M ${startX} ${startY} L ${endX} ${endY}`}
                  fill="none"
                  stroke={isLight ? "#a1a1aa" : "#3f3f46"}
                  strokeWidth={1.5}
                  className={isLight ? "opacity-60" : "opacity-35"}
                  markerEnd="url(#arrow)"
                />

                {/* Optional branch label on the arrow */}
                {edge.label && (
                  <g transform={`translate(${startX}, ${midY})`}>
                    <rect
                      x={-20}
                      y={-8}
                      width={40}
                      height={16}
                      rx={4}
                      fill={isLight ? "#ffffff" : "#0c0d12"}
                      stroke={isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"}
                      strokeWidth={1}
                    />
                    <text
                      fill={isLight ? "#71717a" : "#ffffff"}
                      fontSize={8}
                      textAnchor="middle"
                      y={3}
                      className="font-bold opacity-75 uppercase tracking-wider"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node, i) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;

            const theme = getNodeTheme(node.type);

            return (
              <g
                key={node.id}
                className="cursor-pointer group"
                transform={`translate(${pos.x - nodeWidth / 2}, ${pos.y - nodeHeight / 2})`}
              >
                {/* Node Box */}
                <rect
                  x={0}
                  y={0}
                  width={nodeWidth}
                  height={nodeHeight}
                  rx={14}
                  fill={theme.bg}
                  stroke={theme.border}
                  strokeWidth={1.5}
                  className="transition-all"
                  style={{
                    filter: `drop-shadow(0 0 6px ${theme.glow})`,
                  }}
                />

                {/* Title */}
                <text
                  x={nodeWidth / 2}
                  y={node.sublabel ? 25 : 34}
                  fill={theme.text}
                  fontSize={11.5}
                  fontWeight="bold"
                  textAnchor="middle"
                  className="tracking-wide"
                >
                  {node.label}
                </text>

                {/* Subtitle */}
                {node.sublabel && (
                  <text
                    x={nodeWidth / 2}
                    y={42}
                    fill={isLight ? "#71717a" : "#a1a1aa"}
                    fontSize={8.5}
                    textAnchor="middle"
                    className="tracking-wide opacity-80"
                  >
                    {node.sublabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
