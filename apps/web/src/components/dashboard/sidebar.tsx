"use client";

import React, { useState } from "react";
import {
  Plus, Search, Database, Upload,
  LogOut, Trash2, X, MessageSquare,
  ChevronRight, ChevronLeft, Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { Chat } from "@/app/dashboard/page";
import { AnimatePresence, motion } from "framer-motion";
import { KnowledgeSource } from "./upload-modal";

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  connections: { _id: string; name: string; type: string }[];
  onDeleteConnection: (id: string) => void;
  onOpenAddDb: () => void;
  onOpenUpload: () => void;
  knowledgeSources: KnowledgeSource[];
  onDeleteSource: (id: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

function StatusDot({ status }: { status: KnowledgeSource["status"] }) {
  if (status === "indexing" || status === "pending")
    return <Loader2 size={10} className="animate-spin shrink-0" style={{ color: "var(--amber)" }} />;
  if (status === "indexed")
    return <div className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_8px_rgba(74,222,128,0.4)]" style={{ background: "var(--green)" }} />;
  return <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--red)" }} />;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] opacity-30 select-none">
      {label}
    </p>
  );
}

export function DashboardSidebar({
  chats, activeChatId, onNewChat, onSelectChat, onDeleteChat,
  connections, onDeleteConnection, onOpenAddDb, onOpenUpload,
  knowledgeSources, onDeleteSource, isMobileOpen, onCloseMobile,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const expanded = !collapsed || !!isMobileOpen;

  const sidebarContent = (
    <div
      className={`h-full flex flex-col transition-all duration-300 shrink-0 ${
        isMobileOpen ? "w-[240px]" : collapsed ? "w-[64px]" : "w-[240px]"
      }`}
      style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo bar */}
      <div className="flex items-center justify-between px-5 h-14 shrink-0">
        {expanded && (
          <div className="flex items-center gap-2.5">
            <div
              className="w-2 h-2 rounded-full shadow-[0_0_10px_rgba(255,95,31,0.3)]"
              style={{ background: "var(--orange)" }}
            />
            <span className="text-[14px] tracking-[0.2em] font-bold uppercase text-white/90" style={{ fontFamily: "var(--font-display)" }}>WUP</span>
          </div>
        )}

        {!isMobileOpen && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hidden lg:flex items-center justify-center transition-all hover:bg-white/5"
            style={{ color: "var(--text-muted)", marginLeft: expanded ? 0 : "auto", marginRight: expanded ? 0 : "auto" }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}

        {isMobileOpen && (
          <button onClick={onCloseMobile} className="p-1.5 rounded-lg lg:hidden" style={{ color: "var(--text-muted)" }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 pt-2 pb-4 space-y-1 shrink-0">
        {/* New Chat — accent colored */}
        <button
          onClick={() => { onNewChat(); onCloseMobile?.(); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group ${!expanded ? "justify-center" : ""}`}
          style={{
            background: "rgba(255, 95, 31, 0.04)",
            border: "1px solid rgba(255, 95, 31, 0.15)",
            color: "var(--text-primary)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255, 95, 31, 0.08)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 95, 31, 0.3)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255, 95, 31, 0.04)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 95, 31, 0.15)";
          }}
        >
          <Plus size={16} strokeWidth={2.5} className="transition-transform group-hover:scale-110" style={{ color: "var(--orange)" }} />
          {expanded && <span>New chat</span>}
        </button>

        <div className="pt-2 space-y-0.5">
          {[
            { icon: <Search size={15} />, label: "Search", onClick: undefined },
            { icon: <Database size={15} />, label: "Add Bridge", onClick: () => { onOpenAddDb(); onCloseMobile?.(); } },
            { icon: <Upload size={15} />, label: "Import", onClick: () => { onOpenUpload(); onCloseMobile?.(); } },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all hover:bg-white/[0.04] ${!expanded ? "justify-center" : ""}`}
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              }}
            >
              <span className="opacity-70 group-hover:opacity-100">{item.icon}</span>
              {expanded && <span className="font-light tracking-wide">{item.label}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-2 space-y-6">

        {/* Chats */}
        {chats.length > 0 && (
          <div>
            {expanded && <SectionLabel label="Recents" />}
            <div className="space-y-0.5">
              {chats.map((chat) => {
                const isActive = activeChatId === chat._id;
                return (
                  <div
                    key={`c-${chat._id}`}
                    onClick={() => { onSelectChat(chat._id); onCloseMobile?.(); }}
                    className="group relative flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-chat"
                        className="absolute left-0 w-0.5 h-4 bg-[var(--orange)] rounded-full shadow-[0_0_8px_rgba(255,95,31,0.4)]"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    
                    {expanded ? (
                      <>
                        <MessageSquare
                          size={14}
                          className="shrink-0"
                          style={{ color: isActive ? "var(--text-primary)" : "var(--text-muted)" }}
                        />
                        <span
                          className="flex-1 text-[13px] truncate font-light tracking-wide"
                          style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
                        >
                          {chat.title}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); onDeleteChat(chat._id); }}
                          className="opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-white/10"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--red)"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    ) : (
                      <div
                        className="w-1.5 h-1.5 rounded-full mx-auto"
                        style={{ background: isActive ? "var(--text-primary)" : "var(--text-muted)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DB Bridges */}
        {connections.length > 0 && (
          <div>
            {expanded && <SectionLabel label="Bridges" />}
            <div className="space-y-0.5">
              {connections.map((conn) => (
                <div
                  key={`b-${conn._id}`}
                  className="group flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-white/[0.03]"
                >
                  {expanded ? (
                    <>
                      <div className="w-1 h-1 rounded-full shrink-0 opacity-40" style={{ background: "var(--text-primary)" }} />
                      <span className="flex-1 text-[13px] font-light truncate tracking-wide" style={{ color: "var(--text-secondary)" }}>{conn.name}</span>
                      <button
                        onClick={() => onDeleteConnection(conn._id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all hover:bg-white/10"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--red)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <div className="w-1 h-1 rounded-full mx-auto opacity-40" style={{ background: "var(--text-primary)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Knowledge sources */}
        {knowledgeSources.length > 0 && (
          <div>
            {expanded && <SectionLabel label="Knowledge" />}
            <div className="space-y-0.5">
              {knowledgeSources.map((src) => (
                <div
                  key={`s-${src._id}`}
                  className="group flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:bg-white/[0.03]"
                >
                  {expanded ? (
                    <>
                      <StatusDot status={src.status} />
                      <span className="flex-1 text-[13px] font-light truncate tracking-wide" style={{ color: "var(--text-secondary)" }}>
                        {src.name}
                      </span>
                      <button
                        onClick={() => onDeleteSource(src._id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all hover:bg-white/10"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--red)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"}
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <div className="mx-auto"><StatusDot status={src.status} /></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-4 shrink-0 space-y-2">
        {expanded && (
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0 shadow-inner"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {user?.email?.[0].toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate leading-none mb-1" style={{ color: "var(--text-primary)" }}>
                {user?.email?.split("@")[0] ?? "User"}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">Pro Plan</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 hover:text-red-400 opacity-40 hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        {!expanded && (
          <button
            onClick={logout}
            className="w-full flex justify-center p-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-all opacity-40 hover:opacity-100"
            style={{ color: "var(--text-muted)" }}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="absolute left-0 top-0 bottom-0"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="hidden lg:block h-full shrink-0">{sidebarContent}</div>
    </>
  );
}
