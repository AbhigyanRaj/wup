"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useAuth } from "@/components/auth-context";
import { useTheme } from "@/components/theme-provider";
import { motion, AnimatePresence } from "framer-motion";

const PERKS = [
  "Query any MongoDB collection in plain English",
  "Upload PDFs — get cited, grounded answers",
  "Live web search combined with your data",
  "50 queries free · No card required",
];

export default function LoginPage() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const { login, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch {
      setError(isSignUp ? "Sign up failed. Please try again." : "Invalid email or password.");
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await login("google-demo@wup.ai");
    } catch {
      setError("Google login unavailable.");
    }
  };

  return (
    <main 
      className={`min-h-screen flex transition-colors duration-300 overflow-hidden selection:bg-[#2563eb]/25 w-full ${
        isLight ? "bg-[#faf9f6]" : "bg-[#04060a]"
      }`}
      style={{
        backgroundImage: isLight
          ? `
            radial-gradient(circle at 50% -10%, rgba(37, 99, 235, 0.08) 0%, rgba(99, 102, 241, 0.02) 30%, transparent 60%),
            radial-gradient(circle at 0% 100%, rgba(37, 99, 235, 0.01) 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.01) 0%, transparent 40%),
            linear-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.035) 1px, transparent 1px)
          `
          : `
            radial-gradient(circle at 50% -10%, rgba(37, 99, 235, 0.15) 0%, rgba(99, 102, 241, 0.05) 30%, transparent 60%),
            radial-gradient(circle at 0% 100%, rgba(37, 99, 235, 0.02) 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.02) 0%, transparent 40%),
            linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px)
          `,
        backgroundSize: "100% 100%, 100% 100%, 100% 100%, 56px 56px, 56px 56px"
      }}
    >

      {/* ── Left panel — brand ─────────────────────────────────────── */}
      <div 
        className={`hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative px-14 py-12 overflow-hidden transition-colors duration-300`}
        style={{ 
          background: isLight ? "rgba(15,23,42,0.015)" : "rgba(255,255,255,0.01)", 
          borderRight: isLight ? "1px solid rgba(15,23,42,0.05)" : "1px solid rgba(255,255,255,0.06)" 
        }}
      >

        {/* Glow */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at bottom left, rgba(37,99,235,0.08) 0%, transparent 65%)" }} />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] pointer-events-none"
          style={{ background: isLight ? "radial-gradient(ellipse at top right, rgba(15,23,42,0.01) 0%, transparent 70%)" : "radial-gradient(ellipse at top right, rgba(255,255,255,0.02) 0%, transparent 70%)" }} />

        {/* Logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-2 h-2 rounded-full shadow-[0_0_12px_rgba(37,99,235,0.6)] bg-[#2563eb]" />
          <span className={`text-[14px] tracking-[0.2em] font-bold uppercase transition-colors ${isLight ? "text-zinc-900" : "text-white"}`}
            style={{ fontFamily: "var(--font-display)" }}>WUUP</span>
        </div>

        {/* Center copy */}
        <div className="relative z-10 flex flex-col gap-10">
          <div>
            <p className="text-[9px] uppercase tracking-[0.4em] text-zinc-500 mb-5 font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] inline-block animate-pulse" />
              AI Intelligence Orchestration
            </p>
            <h2 className={`text-[2.6rem] leading-[1.05] tracking-tight mb-4 transition-colors ${isLight ? "text-zinc-900" : "text-white"}`}
              style={{ fontFamily: "var(--font-display)" }}>
              Think deeper.<br />Know faster.
            </h2>
            <p className={`text-[13.5px] leading-relaxed max-w-xs font-light transition-colors ${isLight ? "text-zinc-600" : "text-zinc-300"}`}>
              Connect your databases, upload documents, and get instant answers mathematically grounded in your own data.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PERKS.map((perk, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
                className="flex items-center gap-3"
              >
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors"
                  style={{ 
                    background: "rgba(37,99,235,0.06)", 
                    border: isLight ? "1px solid rgba(37,99,235,0.12)" : "1px solid rgba(37,99,235,0.18)" 
                  }}
                >
                  <Check size={10} className="text-[#2563eb]" />
                </div>
                <span className={`text-[12.5px] leading-tight transition-colors ${isLight ? "text-zinc-700 font-medium" : "text-zinc-200"}`}>{perk}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className={`text-[10px] relative z-10 transition-colors ${isLight ? "text-zinc-400" : "text-zinc-600"}`}>© 2026 Wuup · Abhigyan Raj</p>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">

        {/* Subtle center glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.03) 0%, transparent 65%)" }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[340px]"
        >
          {/* Back link */}
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 mb-10 text-[11px] font-semibold transition-colors group ${
              isLight ? "text-zinc-500 hover:text-zinc-800" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ArrowLeft size={11} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to home
          </Link>

          {/* Heading */}
          <div className="mb-8">
            <AnimatePresence mode="wait">
              <motion.h1
                key={isSignUp ? "signup" : "login"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className={`text-[24px] font-semibold tracking-tight mb-1.5 transition-colors ${
                  isLight ? "text-zinc-900" : "text-white"
                }`}
              >
                {isSignUp ? "Create account" : "Welcome back"}
              </motion.h1>
            </AnimatePresence>
            <p className={`text-[12.5px] leading-relaxed transition-colors ${
              isLight ? "text-zinc-500" : "text-zinc-400"
            }`}>
              {isSignUp ? "Start building with Wuup for free." : "Sign in to access your workspace."}
            </p>
          </div>

          <div className="space-y-4">
            {/* Google */}
            <div className="space-y-2">
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className={`w-full py-2.5 rounded-full font-bold text-[11.5px] tracking-wide flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-40 shadow-sm cursor-pointer border ${
                  isLight 
                    ? "bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-800"
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12] text-zinc-300"
                }`}
              >
                <SiGoogle size={12} className="text-[#2563eb]" />
                Continue with Google
              </button>
              <p className={`text-[9px] text-center tracking-wider transition-colors ${isLight ? "text-zinc-400" : "text-zinc-600"}`}>
                Demo mode — Google integration coming soon
              </p>
            </div>

            {/* Divider */}
            <div className="relative flex items-center gap-4">
              <div className={`h-px flex-1 ${isLight ? "bg-zinc-200" : "bg-white/[0.05]"}`} />
              <span className={`text-[8.5px] font-bold uppercase tracking-[0.25em] ${isLight ? "text-zinc-400" : "text-zinc-500"}`}>or</span>
              <div className={`h-px flex-1 ${isLight ? "bg-zinc-200" : "bg-white/[0.05]"}`} />
            </div>

            {/* Email / Password form */}
            <form onSubmit={handleSubmit} className="space-y-3">

              <div className="space-y-2.5">
                {/* Email */}
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    placeholder="Email address"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    autoComplete="email"
                    className={`w-full px-4 py-2.5 rounded-xl text-[12.5px] transition-all font-medium outline-none ${
                      isLight 
                        ? "bg-white border border-zinc-200 placeholder:text-zinc-400 text-zinc-900" 
                        : "bg-white/[0.025] border border-white/[0.06] placeholder:text-zinc-600 text-white"
                    }`}
                    style={{
                      borderColor: focusedField === "email" ? "#2563eb" : undefined,
                      caretColor: "#2563eb",
                      boxShadow: focusedField === "email" ? "0 0 0 3px rgba(37,99,235,0.08)" : "none",
                    }}
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    className={`w-full px-4 py-2.5 rounded-xl text-[12.5px] transition-all font-medium outline-none ${
                      isLight 
                        ? "bg-white border border-zinc-200 placeholder:text-zinc-400 text-zinc-900" 
                        : "bg-white/[0.025] border border-white/[0.06] placeholder:text-zinc-600 text-white"
                    }`}
                    style={{
                      borderColor: focusedField === "password" ? "#2563eb" : undefined,
                      caretColor: "#2563eb",
                      boxShadow: focusedField === "password" ? "0 0 0 3px rgba(37,99,235,0.08)" : "none",
                    }}
                  />
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-[11px] px-1 pt-0.5 font-bold text-rose-500"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Submit - Refined premium minimal button */}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-full font-bold text-[12px] tracking-wide text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-2 bg-[#2563eb] hover:bg-[#1d4ed8] cursor-pointer"
                style={{ boxShadow: "0 4px 14px rgba(37,99,235,0.2)" }}
              >
                {authLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : (isSignUp ? "Create account" : "Sign in")}
              </button>
            </form>

            {/* Toggle sign up / login */}
            <div className="text-center pt-1">
              <button
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                className={`text-[12px] transition-colors cursor-pointer ${
                  isLight ? "text-zinc-500 hover:text-zinc-800" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <span className={`font-bold ${isLight ? "text-zinc-800" : "text-zinc-200"}`}>
                  {isSignUp ? "Sign in" : "Sign up free"}
                </span>
              </button>
            </div>

            {/* Legal */}
            <p className={`text-center text-[10px] leading-relaxed pt-2 transition-colors ${
              isLight ? "text-zinc-400" : "text-zinc-600"
            }`}>
              By continuing, you agree to our{" "}
              <Link href="#" className={`transition-colors underline underline-offset-2 ${
                isLight ? "text-zinc-500 hover:text-zinc-800" : "text-zinc-400 hover:text-zinc-200"
              }`}>Terms</Link>
              {" & "}
              <Link href="#" className={`transition-colors underline underline-offset-2 ${
                isLight ? "text-zinc-500 hover:text-zinc-800" : "text-zinc-400 hover:text-zinc-200"
              }`}>Privacy Policy</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
