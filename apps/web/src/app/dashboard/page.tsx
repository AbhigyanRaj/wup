"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { AskBar } from "@/components/dashboard/ask-bar";
import { CategoryPills } from "@/components/dashboard/category-pills";
import { MessageList } from "@/components/dashboard/message-list";
import { Menu, AlertCircle } from "lucide-react";
import { ConnectDbModal } from "@/components/dashboard/connect-db-modal";
import { UploadModal, KnowledgeSource } from "@/components/dashboard/upload-modal";
import { MessageProps } from "@/components/dashboard/message-item";
import { ClarificationModal } from "@/components/dashboard/clarification-modal";
import { ApiKeyModal } from "@/components/dashboard/api-key-modal";
import { useTheme } from "@/components/theme-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const userName = user?.email?.split("@")[0] || "abhigyan";
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Chat state
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<MessageProps[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatuses, setTypingStatuses] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Connections (DB bridges)
  const [connections, setConnections] = useState<ConnectionItem[]>([]);

  // Knowledge sources
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);

  // Clarification state
  const [clarification, setClarification] = useState<{ question: string; options: string[]; originalPrompt: string } | null>(null);

  // Model selection
  const [currentModel, setCurrentModel] = useState("Auto-Rotate");
  const [exhaustedModels, setExhaustedModels] = useState<string[]>([]);
  const [usage, setUsage] = useState<{ freeTierUsage: number; freeTierLimit: number; hasCustomKey: boolean; availableModels?: string[] } | null>(null);

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("wuup_token");
      if (!token) return;

      try {
        const [chatRes, connRes, kbRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/chats`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/connections`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/knowledge`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/user/usage`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (chatRes.ok) setChats(await chatRes.json());
        if (connRes.ok) setConnections(await connRes.json());
        if (kbRes.ok) setKnowledgeSources(await kbRes.json());
        if (usageRes.ok) setUsage(await usageRes.json());
      } catch (err) {
        console.error("Dashboard mount fetch failed:", err);
        setError("Connection failed. Is the backend running?");
      }
    };
    fetchData();
  }, []);

  // F-2: Resume polling for any sources still in "indexing" state on mount
  useEffect(() => {
    const token = localStorage.getItem("wuup_token");
    if (!token) return;
    knowledgeSources
      .filter((s) => s.status === "indexing" || s.status === "pending")
      .forEach((s) => resumePollSource(s._id, token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  async function resumePollSource(sourceId: string, token: string) {
    let interval = 3000;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, interval));
      interval = Math.min(interval * 1.5, 15000);
      try {
        const res = await fetch(`${API_URL}/knowledge/${sourceId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.status === "indexed" || data.status === "error" || data.status === "error_quota") {
          refreshKnowledgeSources();
          return;
        }
      } catch { /* network blip */ }
    }
  }

  // ── Knowledge source helpers ─────────────────────────────────────────────────

  const refreshKnowledgeSources = useCallback(async () => {
    const token = localStorage.getItem("wuup_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/knowledge`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setKnowledgeSources(await res.json());
    } catch { /* silent */ }
  }, []);

  const handleDeleteSource = async (id: string) => {
    const token = localStorage.getItem("wuup_token");
    try {
      await fetch(`${API_URL}/knowledge/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setKnowledgeSources((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      console.error("Source delete failed:", err);
    }
  };

  // ── Messages ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeChatId) {
      setActiveMessages([]);
      return;
    }
    const fetchMessages = async () => {
      const token = localStorage.getItem("wuup_token");
      try {
        const res = await fetch(`${API_URL}/chats/${activeChatId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Map DB messages to MessageProps — include ragSources for citation pills
          setActiveMessages(
            data.map((m: any) => ({
              role: m.role,
              content: m.content,
              ragSources: m.ragSources ?? [],
              webSources: m.webSources ?? [],
              visualType: m.visualType ?? "none",
              chartData: m.chartData ?? null,
              tableData: m.tableData ?? null,
              diagramData: m.diagramData ?? null,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    };
    fetchMessages();
  }, [activeChatId]);

  const handleSendMessage = async (content: string, model: string = "Auto-Rotate", searchWeb: boolean = false) => {
    const token = localStorage.getItem("wuup_token");
    let currentChatId = activeChatId;
    setError(null);

    // Optimistic user message (no citations yet)
    const userMsg: MessageProps = { role: "user", content };
    setActiveMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setTypingStatuses([]);

    let flushInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // Create chat session if starting fresh
      if (!currentChatId) {
        const chatRes = await fetch(`${API_URL}/chats`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: content.length > 25 ? content.substring(0, 25) + "…" : content,
          }),
        });
        if (!chatRes.ok) throw new Error("Could not initialize chat session.");
        const newChat = await chatRes.json();
        currentChatId = newChat._id;
        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(currentChatId);
      }

      // Send to Brain Orchestrator
      const msgRes = await fetch(`${API_URL}/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: "user", content, model, searchWeb }),
      });

      if (!msgRes.ok) {
        const errData = await msgRes.json().catch(() => ({}));
        throw new Error((errData as any).error || "The Brain is currently unresponsive.");
      }

      const reader = msgRes.body?.getReader();
      if (!reader) throw new Error("No readable stream available.");
      
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      let targetContent = "";
      let displayContent = "";
      let streamingStarted = false;
      let finalData: any = null;
      let msgIndex = -1;

      // Smooth typing animator: drains targetContent at 40fps for a silky smooth feel
      flushInterval = setInterval(() => {
        if (streamingStarted && displayContent.length < targetContent.length && msgIndex !== -1) {
          const distance = targetContent.length - displayContent.length;
          // Spring-like easing: distance / 3 means it covers large gaps fast, but slows down near the end
          const charsToAdd = Math.max(1, Math.floor(distance / 3));
          displayContent += targetContent.substring(displayContent.length, displayContent.length + charsToAdd);

          setActiveMessages((prev) => {
            const newMsgs = [...prev];
            if (newMsgs[msgIndex]) {
              newMsgs[msgIndex] = {
                ...newMsgs[msgIndex],
                content: displayContent
              };
            }
            return newMsgs;
          });
        }
      }, 25);

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || ""; // last part is incomplete, put it back in buffer
          
          for (const line of parts) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);
                if (data.type === "status") {
                  setTypingStatuses(prev => [...prev, data.message]);
                } else if (data.type === "token") {
                  targetContent += data.text;
                  
                  if (!streamingStarted) {
                    streamingStarted = true;
                    setIsTyping(false); // remove the thinking indicator once text starts
                    
                    displayContent = targetContent.substring(0, 1);
                    // Add the assistant message and capture its stable index
                    setActiveMessages((prev) => {
                      msgIndex = prev.length;
                      return [
                        ...prev,
                        { role: "assistant", content: displayContent, ragSources: [] }
                      ];
                    });
                  }
                } else if (data.type === "done") {
                  finalData = data.message;
                } else if (data.type === "error") {
                  throw new Error(data.message);
                }
              } catch (e) {
                // Ignore parse errors on individual lines
              }
            }
          }
        }
      }

      if (finalData) {
        if (finalData.exhausted) setExhaustedModels(finalData.exhausted);

        // Refetch usage stats
        fetch(`${API_URL}/user/usage`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok && res.json())
          .then(data => data && setUsage(data))
          .catch(() => {});

        if (finalData.clarification) {
          setClarification({
            question: finalData.clarification.question,
            options: finalData.clarification.options,
            originalPrompt: content,
          });
        } else {
          setClarification(null);
        }

        clearInterval(flushInterval);

        // Update the final message with ragSources and followUps
        setActiveMessages((prev) => {
          if (msgIndex !== -1) {
            const newMsgs = [...prev];
            if (newMsgs[msgIndex]) {
              newMsgs[msgIndex] = {
                ...newMsgs[msgIndex],
                content: finalData.assistantMessage.content,
                ragSources: finalData.assistantMessage.ragSources ?? [],
                webSources: finalData.assistantMessage.webSources ?? [],
                visualType: finalData.assistantMessage.visualType ?? "none",
                chartData: finalData.assistantMessage.chartData ?? null,
                tableData: finalData.assistantMessage.tableData ?? null,
                diagramData: finalData.assistantMessage.diagramData ?? null,
                followUps: finalData.clarification ? [] : (finalData.followUps ?? []),
              };
            }
            return newMsgs;
          } else {
             // If we never started streaming (e.g. instant response without tokens), just push it
             return [
               ...prev,
               {
                 role: "assistant",
                 content: finalData.assistantMessage.content,
                 ragSources: finalData.assistantMessage.ragSources ?? [],
                 webSources: finalData.assistantMessage.webSources ?? [],
                 visualType: finalData.assistantMessage.visualType ?? "none",
                 chartData: finalData.assistantMessage.chartData ?? null,
                 tableData: finalData.assistantMessage.tableData ?? null,
                 diagramData: finalData.assistantMessage.diagramData ?? null,
                 followUps: finalData.clarification ? [] : (finalData.followUps ?? []),
               }
             ];
          }
        });
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      console.error("Chat Error:", err);
      setError(msg);
      // Remove the empty assistant message if we crashed before getting text
      setActiveMessages((prev) => {
        if (prev[prev.length - 1].role === "assistant" && prev[prev.length - 1].content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsTyping(false);
      if (flushInterval !== null) clearInterval(flushInterval);
    }
  };

  // ── Connection / Chat handlers ────────────────────────────────────────────────

  const handleDeleteChat = async (id: string) => {
    const token = localStorage.getItem("wuup_token");
    try {
      await fetch(`${API_URL}/chats/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats((prev) => prev.filter((c) => c._id !== id));
      if (activeChatId === id) {
        setActiveChatId(null);
        setActiveMessages([]);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    const token = localStorage.getItem("wuup_token");
    try {
      await fetch(`${API_URL}/connections/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setConnections((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      console.error("Bridge removal failed:", err);
    }
  };

  const handleConnectionAdded = async () => {
    const token = localStorage.getItem("wuup_token");
    const connRes = await fetch(`${API_URL}/connections`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (connRes.ok) setConnections(await connRes.json());
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <DashboardSidebar
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={() => { setActiveChatId(null); setActiveMessages([]); }}
        onSelectChat={(id) => setActiveChatId(id)}
        onDeleteChat={handleDeleteChat}
        connections={connections || []}
        onDeleteConnection={handleDeleteConnection}
        onOpenAddDb={() => setIsDbModalOpen(true)}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onOpenApiKey={() => setIsApiKeyModalOpen(true)}
        knowledgeSources={knowledgeSources}
        onDeleteSource={handleDeleteSource}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        usage={usage}
      />

      <main className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Nav */}
        <header
          className="h-14 flex items-center justify-between px-6 z-10 shrink-0"
        >
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 rounded-xl lg:hidden hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 select-none">
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-20" style={{ fontFamily: "var(--font-display)" }}>
              WUUP Intelligence
            </span>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 lg:px-6 pb-40">
          <div className="max-w-3xl mx-auto w-full flex flex-col min-h-full">

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 flex items-center gap-3 px-5 py-4 rounded-2xl text-[13px] tracking-wide shadow-2xl"
                style={{ 
                  background: "rgba(248,113,113,0.03)", 
                  border: "1px solid rgba(248,113,113,0.1)", 
                  color: "var(--red)",
                  backdropFilter: "blur(10px)"
                }}
              >
                <AlertCircle size={16} className="shrink-0 opacity-70" />
                <span className="font-medium">{error}</span>
              </motion.div>
            )}

            {!activeChatId || activeMessages.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center py-12">
                <DashboardHero userName={userName} usage={usage} />
                <div className="w-full max-w-2xl px-4">
                  <AskBar
                    onSubmit={handleSendMessage}
                    selectedModel={currentModel}
                    onModelChange={setCurrentModel}
                    exhaustedModels={exhaustedModels}
                    usage={usage}
                  />
                  <div className="mt-8">
                    <CategoryPills onSelect={(prompt) => handleSendMessage(prompt, currentModel)} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col py-6">
                <MessageList
                  messages={activeMessages}
                  isTyping={isTyping}
                  typingStatuses={typingStatuses}
                  onFollowUpSelect={(prompt) => handleSendMessage(prompt, currentModel)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Sticky Input Bar for Active Chat */}
        {activeChatId && activeMessages.length > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 z-20 px-4 lg:px-6 pb-8 pt-12 pointer-events-none"
            style={{ 
              background: isLight 
                ? "linear-gradient(to top, var(--bg-base) 40%, rgba(244,246,249,0.8) 70%, transparent)"
                : "linear-gradient(to top, var(--bg-base) 40%, rgba(14,17,24,0.8) 70%, transparent)"
            }}
          >
            <div className="max-w-2xl mx-auto pointer-events-auto flex flex-col gap-3">
              {/* Clarification Modal — appears above the AskBar */}
              <AnimatePresence>
                {clarification && (
                  <ClarificationModal
                    question={clarification.question}
                    options={clarification.options}
                    onSelect={(answer) => {
                      setClarification(null);
                      handleSendMessage(
                        `${clarification.originalPrompt} — specifically: ${answer}`,
                        currentModel
                      );
                    }}
                    onDismiss={() => setClarification(null)}
                  />
                )}
              </AnimatePresence>
              <AskBar
                onSubmit={handleSendMessage}
                selectedModel={currentModel}
                onModelChange={setCurrentModel}
                exhaustedModels={exhaustedModels}
                usage={usage}
              />
              <p className="text-[10px] text-center opacity-20 font-bold uppercase tracking-widest select-none">
                AI may display inaccurate info.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <ConnectDbModal
        isOpen={isDbModalOpen}
        onClose={() => { setIsDbModalOpen(false); handleConnectionAdded(); }}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSourcesChanged={refreshKnowledgeSources}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        usage={usage}
        onSaved={async () => {
          // Refetch usage to update UI
          const token = localStorage.getItem("wuup_token");
          const usageRes = await fetch(`${API_URL}/user/usage`, { headers: { Authorization: `Bearer ${token}` } });
          if (usageRes.ok) setUsage(await usageRes.json());
        }}
      />
    </div>
  );
}
