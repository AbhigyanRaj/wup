"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Database, 
  Table2, 
  Zap, 
  Terminal, 
  CheckCircle2,
  Loader2,
  ChevronRight,
  Globe,
  Lock,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check
} from "lucide-react";

interface ConnectDbModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "choice" | "method" | "automated" | "manual" | "assistant" | "loading" | "success";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const WUP_ASSISTANT_EMAIL = "bridge@wup-ai.iam.gserviceaccount.com";

export function ConnectDbModal({ isOpen, onClose }: ConnectDbModalProps) {
  const [step, setStep] = useState<Step>("choice");
  const [selectedSource, setSelectedSource] = useState<{ name: string, icon: any, type: string } | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep("choice");
      setSelectedSource(null);
      setManualUrl("");
    }
  }, [isOpen]);

  const sources = [
    { name: "Google Sheets", type: "sheets", icon: <Table2 size={20} />, description: "Cloud Spreadsheet Picker" },
    { name: "MongoDB", type: "mongodb", icon: <Database size={20} />, description: "Live Atlas Discovery" },
    { name: "Supabase", type: "supabase", icon: <Zap size={20} />, description: "Project & Table Selector" },
    // { name: "PostgreSQL", type: "postgresql", icon: <Terminal size={20} />, description: "Direct SQL Bridge" },
  ];

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(WUP_ASSISTANT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualConnect = async () => {
    setStep("loading");
    const token = localStorage.getItem("wup_token");

    try {
      const res = await fetch(`${API_URL}/connections`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: `${selectedSource?.name} (${new Date().toLocaleDateString()})`,
          type: selectedSource?.type,
          config: manualUrl
        })
      });

      if (res.ok) {
        setStep("success");
        setTimeout(() => onClose(), 2500);
      } else {
        // If it fails (e.g., access denied), show assistant for Google Sheets
        if (selectedSource?.type === "sheets") {
           setStep("assistant");
        } else {
           setStep("choice"); // Fallback
        }
      }
    } catch (err) {
      console.error("Connection failed", err);
      setStep("choice");
    }
  };

  const handleMockOAuth = () => {
    setStep("loading");
    setTimeout(() => setStep("automated"), 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#0f0f0f] border border-white/[0.05] rounded-[24px] lg:rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg lg:text-xl font-medium tracking-tight text-white/90 font-serif italic capitalize">
              {step === "choice" && "Data Source"}
              {step === "method" && "Connection Method"}
              {step === "manual" && `Manual ${selectedSource?.name}`}
              {step === "assistant" && "Access Assistant"}
              {step === "automated" && "Select Discovery"}
              {step === "loading" && "Initializing"}
              {step === "success" && "Success"}
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-full text-white/20 hover:text-white transition-all">
              <X size={18} />
            </button>
          </div>

          {/* STEP: SOURCE CHOICE */}
          {step === "choice" && (
            <div className="space-y-1">
              {sources.map((source) => (
                <button
                  key={source.name}
                  onClick={() => {
                    setSelectedSource(source);
                    setStep("method");
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/[0.03] transition-all group text-left border border-transparent hover:border-white/5"
                >
                  <div className="flex-shrink-0 text-white/20 group-hover:text-white/80 transition-colors">
                    {source.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-medium text-white/60 group-hover:text-white transition-colors">{source.name}</h3>
                    <p className="text-[10px] text-white/10 font-light italic truncate">{source.description}</p>
                  </div>
                  <ChevronRight size={14} className="text-white/5 group-hover:text-white/20 transition-all" />
                </button>
              ))}
            </div>
          )}

          {/* STEP: METHOD CHOICE (HYBRID) */}
          {step === "method" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <button 
                onClick={handleMockOAuth}
                className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-all group text-left"
               >
                 <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Globe size={20} />
                 </div>
                 <div className="flex-1">
                    <h3 className="text-sm font-medium text-white">Seamless Discovery</h3>
                    <p className="text-[10px] text-white/40">Connect your account & pick visually.</p>
                 </div>
                 <ShieldCheck size={16} className="text-blue-500 opacity-50" />
               </button>

               <div className="flex items-center gap-3 py-2">
                  <div className="h-[1px] flex-1 bg-white/5" />
                  <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">or</span>
                  <div className="h-[1px] flex-1 bg-white/5" />
               </div>

               <button 
                onClick={() => setStep("manual")}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border border-white/5 hover:bg-white/[0.02] transition-all group text-left"
               >
                 <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                    <Lock size={20} />
                 </div>
                 <div className="flex-1">
                    <h3 className="text-sm font-medium text-white/80">Manual Connection</h3>
                    <p className="text-[10px] text-white/20">Paste a direct URL or environment key.</p>
                 </div>
               </button>

               <button onClick={() => setStep("choice")} className="w-full text-center text-[10px] text-white/20 hover:text-white/40 transition-all font-medium py-2">
                 Back to sources
               </button>
            </div>
          )}

          {/* STEP: MANUAL INPUT */}
          {step === "manual" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-3">
                <p className="text-[10px] text-white/40 font-light italic px-1 tracking-wide leading-relaxed">
                  Enter the direct connection endpoint for your {selectedSource?.name}.
                </p>
                <input 
                  autoFocus
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder={selectedSource?.type === "sheets" ? "https://docs.google.com/spreadsheets/..." : "Connection Link..."}
                  className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 px-5 text-sm font-light text-white placeholder:text-white/5 focus:border-white/10 transition-all outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setStep("method")}
                  className="px-6 py-3 border border-white/5 rounded-xl text-xs font-medium text-white/20 hover:text-white/60 transition-all"
                >
                  Back
                </button>
                <button 
                  onClick={handleManualConnect}
                  disabled={!manualUrl}
                  className="flex-1 py-3 bg-white text-black rounded-xl font-semibold text-xs hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Verify & Bridge
                </button>
              </div>
            </div>
          )}

          {/* STEP: ACCESS ASSISTANT (THE RECOVERY FLOW) */}
          {step === "assistant" && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
               <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl flex gap-3 text-yellow-400/80">
                  <ShieldCheck size={18} className="shrink-0" />
                  <p className="text-[11px] leading-relaxed italic">
                    WUP needs explicit permissions to read this spreadsheet. Please grant access to our secure Bridge Service.
                  </p>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                     <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">1. Click 'Share' in Google Sheets</p>
                     <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">2. Add this email as 'Viewer'</p>
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-white/[0.03] border border-white/5 rounded-xl relative group">
                     <div className="flex-1 truncate text-xs text-white/60 font-mono">
                        {WUP_ASSISTANT_EMAIL}
                     </div>
                     <button 
                      onClick={handleCopyEmail}
                      className="p-1.5 hover:bg-white/5 rounded-md text-white/20 hover:text-white transition-all"
                     >
                        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                     </button>
                  </div>
               </div>

               <button 
                onClick={handleManualConnect}
                className="w-full flex items-center justify-center gap-3 py-4 bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/[0.05] transition-all group"
               >
                 <Loader2 className="w-4 h-4 text-white/20 animate-spin group-hover:text-white" />
                 <span className="text-xs font-semibold text-white/60 group-hover:text-white">Live Checking Access...</span>
               </button>

               <button onClick={() => setStep("manual")} className="w-full text-center text-[10px] text-white/20 hover:text-white/40 transition-all font-medium">
                 Use a different sheet
               </button>
            </div>
          )}

          {/* STEP: DISCOVERY PICKER (MOCK) */}
          {step === "automated" && (
            <div className="space-y-5 animate-in slide-in-from-top-2 duration-500">
               <div className="space-y-2 text-center pb-2">
                  <p className="text-xs text-white/60 italic font-medium">Available Sources Detected</p>
                  <p className="text-[10px] text-white/20 font-light">Select which {selectedSource?.type} to bridge to your Brain.</p>
               </div>

               <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {[1,2,3].map((i) => (
                    <button 
                      key={i} 
                      onClick={() => setStep("loading")}
                      className="w-full p-4 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-blue-500/5 flex items-center justify-center text-blue-500/40 group-hover:text-blue-500">
                            {selectedSource?.icon}
                         </div>
                         <div className="text-left">
                            <h4 className="text-xs font-medium text-white/80">{i === 1 ? 'Production' : i === 2 ? 'Global_Sales' : 'User_Trends'}</h4>
                            <p className="text-[10px] text-white/10 italic">Last modified 2h ago</p>
                         </div>
                      </div>
                      <ExternalLink size={12} className="text-white/5 group-hover:text-white/20" />
                    </button>
                  ))}
               </div>

               <button onClick={() => setStep("method")} className="w-full text-center text-[10px] text-white/20 hover:text-white/40 transition-all font-medium py-2">
                 Back
               </button>
            </div>
          )}

          {step === "loading" && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
              <Loader2 className="w-8 h-8 text-white/10 animate-spin" />
              <p className="text-[11px] font-light text-white/20 tracking-widest italic uppercase">Syncing Protocol...</p>
            </div>
          )}

          {step === "success" && (
            <div className="py-12 flex flex-col items-center justify-center gap-4 animate-in zoom-in-95 duration-700">
              <div className="w-16 h-16 bg-green-500/5 border border-green-500/10 rounded-full flex items-center justify-center text-green-500">
                <CheckCircle2 size={32} />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-white/80 italic mb-1 uppercase tracking-widest">Bridge Active</p>
                <p className="text-[10px] text-white/10 font-light">Context synchronization complete.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
