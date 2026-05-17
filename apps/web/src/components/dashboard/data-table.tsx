"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpDown, Search, ArrowUp, ArrowDown } from "lucide-react";

interface TableData {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export function DataTable({ data }: { data: TableData }) {
  const { columns, rows } = data;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc" | null;
  }>({ key: "", direction: null });

  // 1. Filtering Logic
  const filteredRows = useMemo(() => {
    if (!searchQuery) return rows;
    const lowerQuery = searchQuery.toLowerCase();

    return rows.filter((row) => {
      return Object.values(row).some((val) =>
        String(val).toLowerCase().includes(lowerQuery)
      );
    });
  }, [rows, searchQuery]);

  // 2. Sorting Logic
  const sortedRows = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      // Handle Numeric Sorting
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Handle String Sorting
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key) {
      if (sortConfig.direction === "asc") {
        direction = "desc";
      } else if (sortConfig.direction === "desc") {
        direction = null; // reset
      }
    }
    setSortConfig({ key, direction });
  };

  if (!rows || rows.length === 0) {
    return (
      <div className="w-full h-32 rounded-2xl flex items-center justify-center border border-white/[0.08] bg-white/[0.01] text-xs opacity-40">
        Empty data table
      </div>
    );
  }

  return (
    <div
      className="w-full my-6 overflow-hidden rounded-2xl shadow-xl border border-white/[0.08]"
      style={{
        background: "rgba(12, 13, 18, 0.4)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Search Filtering Bar */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.05]"
        style={{ background: "rgba(255, 255, 255, 0.01)" }}
      >
        <Search size={14} className="opacity-35" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter rows..."
          className="bg-transparent border-none text-xs w-full text-white placeholder-white/30 focus:outline-none"
        />
        {filteredRows.length !== rows.length && (
          <span className="text-[9px] font-bold uppercase tracking-wider opacity-30 select-none">
            {filteredRows.length} of {rows.length} rows
          </span>
        )}
      </div>

      {/* Grid Container */}
      <div className="w-full overflow-x-auto custom-scrollbar max-h-96">
        <table className="w-full text-left border-collapse text-xs select-text">
          <thead>
            <tr
              className="border-b border-white/[0.06] select-none"
              style={{ background: "rgba(255,255,255,0.015)" }}
            >
              {columns.map((col) => {
                const isSorted = sortConfig.key === col;
                const dir = sortConfig.direction;

                return (
                  <th
                    key={col}
                    onClick={() => requestSort(col)}
                    className="px-5 py-3 font-semibold tracking-wider opacity-60 hover:opacity-100 cursor-pointer transition-all uppercase text-[10px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col}</span>
                      {isSorted ? (
                        dir === "asc" ? (
                          <ArrowUp size={10} className="text-blue-400" />
                        ) : (
                          <ArrowDown size={10} className="text-blue-400" />
                        )
                      ) : (
                        <ArrowUpDown size={10} className="opacity-20" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-white/[0.03] transition-all hover:bg-white/[0.03]"
                style={{
                  background: idx % 2 === 0 ? "rgba(255,255,255,0.005)" : "transparent",
                }}
              >
                {columns.map((col) => {
                  const val = row[col];
                  return (
                    <td
                      key={col}
                      className="px-5 py-3 font-mono text-[11px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {val !== null && val !== undefined ? String(val) : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
