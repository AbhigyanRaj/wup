"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useAuth } from "@/components/auth-context";
import { motion, AnimatePresence } from "framer-motion";

const PERKS = [
  "Query any MongoDB collection in plain English",
  "Upload PDFs — get cited, grounded answers",
  "Live web search combined with your data",
  "50 queries free · No card required",
];

export default function LoginPage() {
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
    <main className="min-h-screen flex bg-black overflow-hidden selection:bg-white/10">

      {/* ── Left panel — brand ─────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] shrink-0 relative px-14 py-12 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.018)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Glow */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at bottom left, rgba(255,95,31,0.1) 0%, transparent 65%)" }} />
        <div className="absolute top-0 right-0 w-[300px] h-[300px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top right, rgba(255,255,255,0.03) 0%, transparent 70%)" }} />

        {/* Logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-2 h-2 rounded-full shadow-[0_0_12px_rgba(255,95,31,0.5)]"
            style={{ background: "var(--orange)" }} />
          <span className="text-[15px] tracking-[0.2em] font-bold uppercase text-white/85"
            style={{ fontFamily: "var(--font-display)" }}>WUUP</span>
        </div>

        {/* Center copy */}
        <div className="relative z-10 flex flex-col gap-10">
          <div>
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/28 mb-5 font-semibold flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[var(--orange)] inline-block" />
              AI Data Intelligence
            </p>
            <h2 className="text-[2.6rem] leading-[1.05] tracking-tight text-white/88 mb-4"
              style={{ fontFamily: "var(--font-display)" }}>
              Think deeper.<br />Know faster.
            </h2>
            <p className="text-[13.5px] text-white/35 leading-relaxed max-w-xs font-light">
              Connect your databases, upload documents, and get instant answers grounded in your own data.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {PERKS.map((perk, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
                className="flex items-center gap-3"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,95,31,0.1)", border: "1px solid rgba(255,95,31,0.2)" }}>
                  <Check size={10} style={{ color: "var(--orange)" }} />
                </div>
                <span className="text-[12.5px] text-white/45 leading-tight">{perk}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-white/15 relative z-10">© 2026 Wuup · Built by Abhigyan Raj</p>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">

        {/* Subtle center glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[500px] rounded-full"
            style={{ background: "radial-gradient(ellipse, rgba(255,95,31,0.04) 0%, transparent 65%)" }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[380px]"
        >
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-white/25 hover:text-white/60 mb-12 text-[11px] font-medium transition-colors group"
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
                className="text-[26px] font-semibold tracking-tight text-white/90 mb-1.5"
              >
                {isSignUp ? "Create account" : "Welcome back"}
              </motion.h1>
            </AnimatePresence>
            <p className="text-white/35 text-[13px] leading-relaxed">
              {isSignUp ? "Start building with Wuup for free." : "Sign in to access your workspace."}
            </p>
          </div>

          <div className="space-y-5">
            {/* Google */}
            <div className="space-y-2">
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full py-3 rounded-2xl font-medium text-[13px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.75)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.15)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)";
                }}
              >
                <SiGoogle size={14} className="opacity-60" />
                Continue with Google
              </button>
              <p className="text-[10px] text-white/18 text-center tracking-wide">
                Demo mode — Google integration coming soon
              </p>
            </div>

            {/* Divider */}
            <div className="relative flex items-center gap-4">
              <div className="h-px flex-1 bg-white/[0.07]" />
              <span className="text-[9px] text-white/20 font-bold uppercase tracking-[0.25em]">or</span>
              <div className="h-px flex-1 bg-white/[0.07]" />
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
                    className="w-full px-4 py-3 rounded-2xl text-[13px] placeholder:text-white/20 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.035)",
                      border: `1px solid ${focusedField === "email" ? "rgba(255,95,31,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: "rgba(255,255,255,0.88)",
                      caretColor: "var(--orange)",
                      outline: "none",
                      boxShadow: focusedField === "email" ? "0 0 0 3px rgba(255,95,31,0.06)" : "none",
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
                    className="w-full px-4 py-3 rounded-2xl text-[13px] placeholder:text-white/20 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.035)",
                      border: `1px solid ${focusedField === "password" ? "rgba(255,95,31,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: "rgba(255,255,255,0.88)",
                      caretColor: "var(--orange)",
                      outline: "none",
                      boxShadow: focusedField === "password" ? "0 0 0 3px rgba(255,95,31,0.06)" : "none",
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
                    className="text-[11.5px] px-1 pt-0.5 font-medium"
                    style={{ color: "var(--red)" }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-2xl font-bold text-[13px] text-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-1"
                style={{ background: "var(--orange)", boxShadow: "0 0 24px rgba(255,95,31,0.22)" }}
              >
                {authLoading
                  ? <Loader2 size={16} className="animate-spin" />
                  : (isSignUp ? "Create account" : "Sign in")}
              </button>
            </form>

            {/* Toggle sign up / login */}
            <div className="text-center pt-1">
              <button
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                className="text-[12px] text-white/30 hover:text-white/65 transition-colors"
              >
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <span className="font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {isSignUp ? "Sign in" : "Sign up free"}
                </span>
              </button>
            </div>

            {/* Legal */}
            <p className="text-center text-white/14 text-[10px] leading-relaxed pt-2">
              By continuing, you agree to our{" "}
              <Link href="#" className="text-white/28 hover:text-white/55 transition-colors underline underline-offset-2">Terms</Link>
              {" & "}
              <Link href="#" className="text-white/28 hover:text-white/55 transition-colors underline underline-offset-2">Privacy Policy</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
