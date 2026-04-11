"use client";

import React, { useState, useMemo } from "react";
import { useAuth } from "@/components/auth-context";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { AskBar } from "@/components/dashboard/ask-bar";
import { CategoryPills } from "@/components/dashboard/category-pills";
import { MessageList } from "@/components/dashboard/message-list";
import { Menu } from "lucide-react";
import { ConnectDbModal } from "@/components/dashboard/connect-db-modal";
import { MessageProps } from "@/components/dashboard/message-item";

export interface Chat {
  id: string;
  title: string;
  messages: MessageProps[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userName = user?.email?.split("@")[0] || "abhigyan";
  
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Derived state for the active chat
  const activeChat = useMemo(() => {
    return chats.find((c) => c.id === activeChatId) || null;
  }, [chats, activeChatId]);

  const activeMessages = activeChat?.messages || [];

  const handleSendMessage = (content: string) => {
    let currentChatId = activeChatId;

    if (!currentChatId) {
      currentChatId = Date.now().toString();
      const newChat: Chat = {
        id: currentChatId,
        title: content.length > 30 ? content.substring(0, 30) + "..." : content,
        messages: []
      };
      setChats([newChat, ...chats]);
      setActiveChatId(currentChatId);
    }

    const userMsg: MessageProps = { role: "user", content };
    setChats(prev => prev.map(chat => 
      chat.id === currentChatId 
        ? { ...chat, messages: [...chat.messages, userMsg] }
        : chat
    ));

    setIsTyping(true);
    setTimeout(() => {
      const responses = [
        "I've analyzed the connection metadata. Everything looks ready for your data queries.",
        "Based on your current bridge configurations, I can start processing your sales trends now.",
        "Ready to assist. Would you like me to query the latest MongoDB collections first?",
        "Connected to your data stack. I'm standing by for your complex requests."
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const assistantMsg: MessageProps = { role: "assistant", content: randomResponse };

      setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: [...chat.messages, assistantMsg] }
          : chat
      ));
      setIsTyping(false);
    }, 1800);
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setIsTyping(false);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setIsTyping(false);
  };

  const handleDeleteChat = (id: string) => {
    const updatedChats = chats.filter(chat => chat.id !== id);
    setChats(updatedChats);
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  return (
    <div className="h-screen bg-[#0a0a0a] flex text-white font-sans selection:bg-white/10 overflow-hidden">
      {/* Dashboard Sidebar */}
      <DashboardSidebar 
        chats={chats} 
        activeChatId={activeChatId}
        onNewChat={handleNewChat} 
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onOpenAddDb={() => setIsDbModalOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Top Navigation */}
        <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-white/40 hover:text-white transition-colors lg:hidden"
            >
              <Menu size={20} />
            </button>
          </div>
          
          <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 bg-white/[0.03] border border-white/5 px-3 py-1 rounded-full items-center gap-2">
            <span className="text-[10px] text-white/40 font-medium tracking-tight">Free plan ·</span>
            <button className="text-[10px] text-white hover:underline transition-all">Upgrade</button>
          </div>

          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-white/[0.03] flex items-center justify-center text-white/20 hover:text-white cursor-pointer transition-all border border-white/5">
                <span className="text-[14px]">?</span>
             </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-hide px-4 lg:px-8 pb-32">
          <div className="max-w-4xl mx-auto w-full flex flex-col min-h-full">
            
            {!activeChat || activeMessages.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center py-12 lg:py-20">
                <DashboardHero userName={userName} />
                <div className="w-full max-w-2xl">
                  <AskBar onSubmit={handleSendMessage} />
                  <CategoryPills />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col py-6 lg:py-10">
                <MessageList messages={activeMessages} isTyping={isTyping} />
              </div>
            )}

            {/* Subtle Branding Bottom (Only show on Hero) */}
            {(!activeChat || activeMessages.length === 0) && (
              <div className="mt-auto py-10 lg:py-20 flex flex-col items-center gap-4 opacity-5 grayscale pointer-events-none">
                 <span className="text-[10px] lg:text-xs tracking-[0.3em] font-bold">WUP UNIFIED BRAIN 2.0</span>
              </div>
            )}
          </div>
        </div>

        {/* Persistent AskBar for Chatting Mode */}
        {activeChat && activeMessages.length > 0 && (
          <div className="absolute bottom-6 lg:bottom-10 left-0 right-0 z-20">
            <div className="max-w-2xl mx-auto px-4 lg:px-8">
              <AskBar onSubmit={handleSendMessage} />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <ConnectDbModal isOpen={isDbModalOpen} onClose={() => setIsDbModalOpen(false)} />
    </div>
  );
}
