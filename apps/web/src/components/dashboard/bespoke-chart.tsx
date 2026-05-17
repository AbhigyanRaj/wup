"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ChartData {
  type: "bar" | "line" | "pie";
  xAxisKey: string;
  yAxisKey: string;
  title?: string;
  series: Array<Record<string, string | number>>;
}

export function BespokeChart({ data }: { data: ChartData }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { title, type, xAxisKey, yAxisKey, series } = data;

  // 1. Process Values
  const numericValues = useMemo(() => {
    return series.map((item) => Number(item[yAxisKey] || 0));
  }, [series, yAxisKey]);

  const maxVal = useMemo(() => {
    const rawMax = Math.max(...numericValues, 1);
    // Give 15% headroom above the max value for better look
    return rawMax * 1.15;
  }, [numericValues]);

  const minVal = 0;

  // 2. Render SVG elements based on chart types
  if (!series || series.length === 0) {
    return (
      <div className="w-full h-48 rounded-2xl flex items-center justify-center border border-white/[0.08] bg-white/[0.01] text-xs opacity-40">
        No chart data available
      </div>
    );
  }

  return (
    <div
      className="w-full my-6 p-6 rounded-2xl shadow-xl select-none"
      style={{
        background: "rgba(12, 13, 18, 0.6)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {title && (
        <h4 className="text-xs font-bold uppercase tracking-widest mb-6 opacity-60 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          {title}
        </h4>
      )}

      <div className="relative w-full h-64">
        {type === "pie" ? (
          <PieChartRender
            series={series}
            xAxisKey={xAxisKey}
            yAxisKey={yAxisKey}
            numericValues={numericValues}
          />
        ) : (
          <CartesianChartRender
            type={type}
            series={series}
            xAxisKey={xAxisKey}
            yAxisKey={yAxisKey}
            numericValues={numericValues}
            maxVal={maxVal}
            hoveredIndex={hoveredIndex}
            setHoveredIndex={setHoveredIndex}
          />
        )}
      </div>
    </div>
  );
}

// ─── Cartesian Engine (Bar & Line) ───────────────────────────────────────────

interface CartesianProps {
  type: "bar" | "line";
  series: Array<Record<string, string | number>>;
  xAxisKey: string;
  yAxisKey: string;
  numericValues: number[];
  maxVal: number;
  hoveredIndex: number | null;
  setHoveredIndex: (idx: number | null) => void;
}

function CartesianChartRender({
  type,
  series,
  xAxisKey,
  yAxisKey,
  numericValues,
  maxVal,
  hoveredIndex,
  setHoveredIndex,
}: CartesianProps) {
  const width = 500;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Scales
  const getX = (index: number) => {
    if (series.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (series.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return paddingTop + chartHeight - (val / maxVal) * chartHeight;
  };

  // Generate grid values (4 intervals)
  const gridTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push((i / 4) * maxVal);
    }
    return ticks;
  }, [maxVal]);

  // Line Path generation (using simple linear connections first)
  const linePath = useMemo(() => {
    if (series.length === 0) return "";
    return series
      .map((_, i) => {
        const x = getX(i);
        const y = getY(numericValues[i]);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [series, numericValues, maxVal]);

  const areaPath = useMemo(() => {
    if (series.length === 0) return "";
    const points = series.map((_, i) => `${getX(i)} ${getY(numericValues[i])}`);
    const startX = getX(0);
    const endX = getX(series.length - 1);
    const bottomY = getY(0);
    return `M ${startX} ${bottomY} L ${points.join(" L ")} L ${endX} ${bottomY} Z`;
  }, [series, numericValues, maxVal]);

  return (
    <div className="w-full h-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Glowing Gradients */}
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {gridTicks.map((tick, i) => {
          const y = getY(tick);
          return (
            <g key={i} className="opacity-10">
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#ffffff"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <text
                x={paddingLeft - 10}
                y={y + 4}
                fill="#ffffff"
                fontSize={8}
                textAnchor="end"
                className="font-mono"
              >
                {Math.round(tick)}
              </text>
            </g>
          );
        })}

        {/* X Axis Labels */}
        {series.map((item, i) => {
          const x = getX(i);
          return (
            <text
              key={i}
              x={x}
              y={height - 10}
              fill="#ffffff"
              fontSize={8}
              textAnchor="middle"
              className="opacity-30 tracking-wider"
            >
              {String(item[xAxisKey])}
            </text>
          );
        })}

        {/* Area Flow (Line chart bottom shadow) */}
        {type === "line" && (
          <path d={areaPath} fill="url(#lineGrad)" className="transition-all" />
        )}

        {/* Chart Primary Line */}
        {type === "line" && (
          <path
            d={linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          />
        )}

        {/* Dynamic Bars (Bar chart) */}
        {type === "bar" &&
          series.map((_, i) => {
            const x = getX(i);
            const y = getY(numericValues[i]);
            const barWidth = Math.max(16, chartWidth / series.length * 0.5);
            const barHeight = height - paddingBottom - y;
            const isHovered = hoveredIndex === i;

            return (
              <rect
                key={i}
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                fill="url(#barGrad)"
                rx={4}
                className="transition-all cursor-pointer hover:fill-blue-400"
                style={{
                  opacity: hoveredIndex === null || isHovered ? 1 : 0.4,
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}

        {/* Line dots on hover */}
        {type === "line" &&
          series.map((_, i) => {
            const x = getX(i);
            const y = getY(numericValues[i]);
            const isHovered = hoveredIndex === i;

            return (
              <g key={i}>
                {/* Transparent hover capture zone */}
                <circle
                  cx={x}
                  cy={y}
                  r={12}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3.5}
                  fill={isHovered ? "#3b82f6" : "#0c0d12"}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  className="pointer-events-none transition-all"
                  style={{
                    filter: isHovered ? "drop-shadow(0 0 6px rgba(59,130,246,0.8))" : "none",
                  }}
                />
              </g>
            );
          })}
      </svg>

      {/* Floating Tooltip HTML Overlay */}
      <AnimatePresence>
        {hoveredIndex !== null && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute p-3 rounded-xl pointer-events-none z-20 shadow-2xl text-[11px]"
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              left: `${(getX(hoveredIndex) / width) * 100}%`,
              top: `${(getY(numericValues[hoveredIndex]) / height) * 100 - 15}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="font-bold opacity-45 uppercase tracking-wider mb-0.5">
              {String(series[hoveredIndex][xAxisKey])}
            </div>
            <div className="font-mono text-blue-400 font-bold text-xs">
              {numericValues[hoveredIndex].toLocaleString()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Pie Chart Engine ────────────────────────────────────────────────────────

interface PieProps {
  series: Array<Record<string, string | number>>;
  xAxisKey: string;
  yAxisKey: string;
  numericValues: number[];
}

function PieChartRender({ series, xAxisKey, yAxisKey, numericValues }: PieProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = useMemo(() => {
    return numericValues.reduce((sum, val) => sum + val, 0);
  }, [numericValues]);

  // Generate pie slices coordinates
  const slices = useMemo(() => {
    let accumulatedAngle = 0;

    return series.map((item, i) => {
      const value = numericValues[i];
      const percentage = total > 0 ? value / total : 0;
      const angle = percentage * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle = endAngle;

      // Coordinate helper
      const getCoords = (ang: number, radius: number) => {
        const rad = ((ang - 90) * Math.PI) / 180;
        return {
          x: 100 + radius * Math.cos(rad),
          y: 100 + radius * Math.sin(rad),
        };
      };

      const startInner = getCoords(startAngle, 50);
      const startOuter = getCoords(startAngle, 85);
      const endInner = getCoords(endAngle, 50);
      const endOuter = getCoords(endAngle, 85);

      const largeArc = angle > 180 ? 1 : 0;

      // SVG path for a donut segment
      const pathData = `
        M ${startOuter.x} ${startOuter.y}
        A 85 85 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}
        L ${endInner.x} ${endInner.y}
        A 50 50 0 ${largeArc} 0 ${startInner.x} ${startInner.y}
        Z
      `;

      return {
        pathData,
        label: String(item[xAxisKey]),
        value,
        percentage,
        color: `hsl(${(i * 360) / series.length}, 70%, 55%)`,
      };
    });
  }, [series, numericValues, total]);

  return (
    <div className="flex flex-col md:flex-row items-center justify-around h-full gap-4">
      {/* SVG Donut */}
      <div className="relative w-48 h-48 flex-shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
          {slices.map((slice, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <path
                key={i}
                d={slice.pathData}
                fill={slice.color}
                opacity={hoveredIdx === null || isHovered ? 1 : 0.3}
                className="transition-all cursor-pointer"
                style={{
                  filter: isHovered ? "drop-shadow(0 0 8px var(--blue))" : "none",
                  transform: isHovered ? "scale(1.03)" : "scale(1)",
                  transformOrigin: "100px 100px",
                }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center label inside donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
          <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">
            {hoveredIdx !== null ? slices[hoveredIdx].label : "Total"}
          </span>
          <span className="text-sm font-mono font-bold mt-0.5 text-blue-400">
            {hoveredIdx !== null
              ? slices[hoveredIdx].value.toLocaleString()
              : total.toLocaleString()}
          </span>
          {hoveredIdx !== null && (
            <span className="text-[9px] font-mono opacity-50">
              {Math.round(slices[hoveredIdx].percentage * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Legend list */}
      <div className="flex flex-col gap-2 max-h-48 overflow-auto custom-scrollbar pr-4 text-xs">
        {slices.map((slice, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-1.5 px-3 rounded-xl transition-all cursor-pointer hover:bg-white/[0.04]"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              background: hoveredIdx === i ? "rgba(255,255,255,0.03)" : "transparent",
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: slice.color,
                boxShadow: `0 0 6px ${slice.color}`,
              }}
            />
            <span className="truncate max-w-[120px] font-medium tracking-wide">
              {slice.label}
            </span>
            <span className="font-mono text-[10px] ml-auto font-bold opacity-60">
              {Math.round(slice.percentage * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
