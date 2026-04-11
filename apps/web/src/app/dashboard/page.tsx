"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/components/auth-context";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { AskBar } from "@/components/dashboard/ask-bar";
import { CategoryPills } from "@/components/dashboard/category-pills";
import { MessageList } from "@/components/dashboard/message-list";
import { Menu, AlertCircle } from "lucide-react";
import { ConnectDbModal } from "@/components/dashboard/connect-db-modal";
import { MessageProps } from "@/components/dashboard/message-item";

export interface Chat {
  _id: string;
  title: string;
}

export interface ConnectionItem {
  _id: string;
  name: string;
  type: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function DashboardPage() {
  const { user } = useAuth();
  const userName = user?.email?.split("@")[0] || "abhigyan";
  
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // State
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<MessageProps[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Load
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("wup_token");
      if (!token) return;

      try {
        const [chatRes, connRes] = await Promise.all([
          fetch(`${API_URL}/chats`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/connections`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        if (chatRes.ok) setChats(await chatRes.json());
        if (connRes.ok) setConnections(await connRes.json());
      } catch (err) {
        console.error("Dashboard mount fetch failed:", err);
        setError("Connection failed. Is the backend running?");
      }
    };
    fetchData();
  }, []);

  // 2. Fetch messages for active chat
  useEffect(() => {
    if (!activeChatId) {
      setActiveMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const token = localStorage.getItem("wup_token");
      try {
        const res = await fetch(`${API_URL}/chats/${activeChatId}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setActiveMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    };
    fetchMessages();
  }, [activeChatId]);

  const handleSendMessage = async (content: string) => {
    const token = localStorage.getItem("wup_token");
    let currentChatId = activeChatId;
    setError(null);

    // Optimistic Update
    const userMsg: MessageProps = { role: "user", content };
    setActiveMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      // Create chat session if starting fresh
      if (!currentChatId) {
        const chatRes = await fetch(`${API_URL}/chats`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ 
            title: content.length > 25 ? content.substring(0, 25) + "..." : content 
          })
        });
        
        if (!chatRes.ok) throw new Error("Could not initialize chat session.");
        
        const newChat = await chatRes.json();
        currentChatId = newChat._id;
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(currentChatId);
      }

      // Send to Brain Orchestrator
      const msgRes = await fetch(`${API_URL}/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: "user", content })
      });

      if (!msgRes.ok) {
        const errData = await msgRes.json().catch(() => ({}));
        throw new Error(errData.error || "The Brain is currently unresponsive.");
      }

      const data = await msgRes.json();
      setActiveMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.assistantMessage.content 
      }]);

    } catch (err: any) {
      console.error("Chat Error:", err);
      setError(err.message || "An unexpected error occurred.");
      // Remove optimistic message or add error state? For simplicity, we just show alert.
    } finally {
      setIsTyping(false);
    }
  };

  const handleDeleteChat = async (id: string) => {
    const token = localStorage.getItem("wup_token");
    try {
      await fetch(`${API_URL}/chats/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setChats(prev => prev.filter(c => c._id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        setActiveMessages([]);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    const token = localStorage.getItem("wup_token");
    try {
      await fetch(`${API_URL}/connections/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      setConnections(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      console.error("Bridge removal failed:", err);
    }
  };

  const handleConnectionAdded = async () => {
    const token = localStorage.getItem("wup_token");
    const connRes = await fetch(`${API_URL}/connections`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (connRes.ok) setConnections(await connRes.json());
  };

  return (
    <div className="h-screen bg-[#0a0a0a] flex text-white font-sans selection:bg-white/10 overflow-hidden">
      <DashboardSidebar 
        chats={chats} 
        activeChatId={activeChatId}
        onNewChat={() => { setActiveChatId(null); setActiveMessages([]); }} 
        onSelectChat={(id) => setActiveChatId(id)}
        onDeleteChat={handleDeleteChat}
        connections={connections || []}
        onDeleteConnection={handleDeleteConnection}
        onOpenAddDb={() => setIsDbModalOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Nav */}
        <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-6 z-10 shrink-0">
          <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2 -ml-2 text-white/40 hover:text-white lg:hidden">
            <Menu size={20} />
          </button>
          <div className="hidden sm:block text-[10px] text-white/10 uppercase tracking-[0.2em] font-medium">WUP Dashboard</div>
          <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/20 hover:text-white cursor-pointer transition-all">?</div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 lg:px-8 pb-32">
          <div className="max-w-4xl mx-auto w-full flex flex-col min-h-full">
            
            {error && (
              <div className="mt-4 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-3 text-red-400 text-xs animate-in slide-in-from-top-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {!activeChatId || activeMessages.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center py-12">
                <DashboardHero userName={userName} />
                <div className="w-full max-w-2xl">
                  <AskBar onSubmit={handleSendMessage} />
                  <CategoryPills />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col py-10">
                <MessageList messages={activeMessages} isTyping={isTyping} />
              </div>
            )}
          </div>
        </div>

        {/* Input Bar for Active Chat */}
        {activeChatId && activeMessages.length > 0 && (
          <div className="absolute bottom-6 lg:bottom-10 left-0 right-0 z-20 px-4 lg:px-8">
            <div className="max-w-2xl mx-auto">
              <AskBar onSubmit={handleSendMessage} />
            </div>
          </div>
        )}
      </main>

      <ConnectDbModal 
        isOpen={isDbModalOpen} 
        onClose={() => {
          setIsDbModalOpen(false);
          handleConnectionAdded();
        }} 
      />
    </div>
  );
}
