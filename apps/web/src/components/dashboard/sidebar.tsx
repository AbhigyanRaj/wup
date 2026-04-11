"use client";

import React, { useState } from "react";
import { 
  Plus, 
  Search, 
  Database, 
  MessageSquare, 
  Box, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { Chat } from "@/app/dashboard/page";
import { AnimatePresence, motion } from "framer-motion";

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  connections: { _id: string; name: string; type: string }[];
  onDeleteConnection: (id: string) => void;
  onOpenAddDb: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function DashboardSidebar({ 
  chats, 
  activeChatId,
  onNewChat, 
  onSelectChat,
  onDeleteChat, 
  connections,
  onDeleteConnection,
  onOpenAddDb,
  isMobileOpen,
  onCloseMobile
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();

  const sidebarContent = (
    <div className={`h-full bg-[#0f0f0f] border-r border-white/5 flex flex-col transition-all duration-300 relative z-50 shrink-0 ${
      collapsed ? "w-[70px]" : "w-64"
    } ${isMobileOpen ? "w-72 border-r-0" : ""}`}>
      {/* Header / Brand */}
      <div className="p-6 flex items-center justify-between">
        <span className={`text-xl font-bold tracking-tighter text-white ${collapsed && !isMobileOpen ? "hidden" : "block"}`}>WUP</span>
        
        <div className="flex items-center gap-2">
          {isMobileOpen ? (
            <button 
              onClick={onCloseMobile}
              className="p-1 hover:bg-white/5 rounded-md text-white/40 hover:text-white transition-colors lg:hidden"
            >
              <X size={18} />
            </button>
          ) : (
            <button 
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 hover:bg-white/5 rounded-md text-white/40 hover:text-white transition-colors hidden lg:block"
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Primary Actions */}
      <div className="px-4 py-4 space-y-1">
        <button
          onClick={() => {
            onNewChat();
            onCloseMobile?.();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group bg-white/5 text-white/80 hover:bg-white/10 border border-white/5 ${collapsed && !isMobileOpen ? "justify-center" : ""}`}
        >
          <Plus size={18} />
          {(!collapsed || isMobileOpen) && <span className="font-light tracking-tight">New chat</span>}
        </button>
        
        <SidebarItem 
          key="nav-search"
          icon={<Search size={18} />} 
          label="Search" 
          collapsed={collapsed && !isMobileOpen} 
        />
        
        <button
          onClick={() => {
            onOpenAddDb();
            onCloseMobile?.();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all group text-white/40 hover:text-white hover:bg-white/5 ${collapsed && !isMobileOpen ? "justify-center" : ""}`}
        >
          <Database size={18} />
          {(!collapsed || isMobileOpen) && <span className="font-light tracking-tight">Add DB</span>}
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 px-4 py-8 overflow-y-auto overflow-x-hidden space-y-6 scrollbar-hide">
        <div>
          {(!collapsed || isMobileOpen) && (
            <h3 className="px-2 text-[10px] uppercase tracking-widest text-white/20 font-bold mb-3">
              Explore
            </h3>
          )}
          <div className="space-y-1">
            <SidebarItem key="nav-chats" icon={<MessageSquare size={18} />} label="Chats" collapsed={collapsed && !isMobileOpen} />
            <SidebarItem key="nav-projects" icon={<Box size={18} />} label="Projects" collapsed={collapsed && !isMobileOpen} />
            <SidebarItem key="nav-artifacts" icon={<Layers size={18} />} label="Artifacts" collapsed={collapsed && !isMobileOpen} />
          </div>
        </div>

        {chats.length > 0 && (
          <div>
            {(!collapsed || isMobileOpen) && (
              <h3 className="px-2 text-[10px] uppercase tracking-widest text-white/20 font-bold mb-3">
                Recents
              </h3>
            )}
            <div className="space-y-0.5">
              {chats.map((chat) => (
                <div 
                  key={`chat-${chat._id}`} 
                  onClick={() => {
                    onSelectChat(chat._id);
                    onCloseMobile?.();
                  }}
                  className={`group flex items-center gap-2 px-2 py-2 rounded-lg transition-all cursor-pointer ${
                    activeChatId === chat._id ? "bg-white/10" : "hover:bg-white/5"
                  } ${collapsed && !isMobileOpen ? "justify-center" : ""}`}
                >
                  {(!collapsed || isMobileOpen) && (
                    <p className={`flex-1 text-[12px] font-light truncate transition-colors ${
                      activeChatId === chat._id ? "text-white" : "text-white/40 group-hover:text-white/80"
                    }`}>
                      {chat.title}
                    </p>
                  )}
                  {(!collapsed || isMobileOpen) && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat._id);
                      }}
                      className={`p-1 hover:text-red-400 transition-all ${
                        activeChatId === chat._id ? "text-white/40 opacity-100" : "opacity-0 group-hover:opacity-100 text-white/20"
                      }`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                  {collapsed && !isMobileOpen && (
                     <div className={`w-1.5 h-1.5 rounded-full transition-all transform group-hover:scale-125 ${
                       activeChatId === chat._id ? "bg-white" : "bg-white/20 group-hover:bg-white"
                     }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {connections.length > 0 && (
          <div className="pt-2">
            {(!collapsed || isMobileOpen) && (
              <h3 className="px-2 text-[10px] uppercase tracking-widest text-white/20 font-bold mb-3">
                Active Bridges
              </h3>
            )}
            <div className="space-y-1">
              {connections.map((conn) => (
                <div 
                  key={`bridge-${conn._id}`} 
                  className={`group flex items-center gap-2 px-2 py-2 rounded-lg transition-all bg-white/[0.02] border border-white/[0.03] ${collapsed && !isMobileOpen ? "justify-center" : ""}`}
                >
                  {(!collapsed || isMobileOpen) && (
                    <div className="p-1 rounded bg-white/5 text-white/40 group-hover:text-white/60">
                       <Database size={10} />
                    </div>
                  )}
                  {(!collapsed || isMobileOpen) && (
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-white/60 truncate group-hover:text-white/90">
                        {conn.name}
                      </p>
                    </div>
                  )}
                  {(!collapsed || isMobileOpen) && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConnection(conn._id);
                      }}
                      className="p-1 text-white/10 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  )}
                  {collapsed && !isMobileOpen && (
                     <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Profile & Logout */}
      <div className="p-4 border-t border-white/5 shrink-0">
        <button 
          onClick={logout}
          className={`w-full flex items-center gap-3 p-2 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all group mb-2 ${collapsed && !isMobileOpen ? "justify-center" : ""}`}
        >
          <LogOut size={18} className="group-hover:scale-110 transition-transform" />
          {(!collapsed || isMobileOpen) && <span className="text-xs font-light">Logout</span>}
        </button>

        <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group ${collapsed && !isMobileOpen ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white/60 group-hover:bg-white/20 transition-all border border-white/5 shadow-inner">
            {user?.email?.[0].toUpperCase() || "A"}
          </div>
          {(!collapsed || isMobileOpen) && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">{user?.email?.split('@')[0] || "abhigyan"}</p>
              <p className="text-[10px] text-white/20 uppercase tracking-wider">Free plan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute left-0 top-0 bottom-0 w-72"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="hidden lg:block h-full shrink-0">
        {sidebarContent}
      </div>
    </>
  );
}

function SidebarItem({ 
  icon, 
  label, 
  collapsed, 
  active = false,
}: { 
  icon: React.ReactNode; 
  label: string; 
  collapsed: boolean;
  active?: boolean;
}) {
  return (
    <Link 
      href="#" 
      className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm transition-all group ${
        active 
          ? "bg-white/10 text-white shadow-sm" 
          : "text-white/40 hover:text-white hover:bg-white/5"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className="flex-shrink-0 transition-transform group-hover:scale-110">{icon}</span>
      {!collapsed && <span className="font-light tracking-tight truncate">{label}</span>}
    </Link>
  );
}
