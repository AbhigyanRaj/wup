"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useAuth } from "@/components/auth-context";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const { login, isLoading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(isSignUp ? "Sign up failed." : "Invalid credentials.");
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await login("google-demo@wup.ai");
    } catch (err: any) {
      setError("Google login unavailable.");
    }
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center px-6 bg-black selection:bg-white/10 overflow-hidden">
      {/* Subtle Depth Background */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ 
          background: "radial-gradient(circle at center, #0f0f0f 0%, #000 100%)" 
        }} 
      />

      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[320px]"
      >
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 text-white/30 hover:text-white/80 mb-10 text-[11px] font-medium transition-all group"
        >
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          Back
        </Link>

        <div className="space-y-8">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-white/90 mb-1.5">
              {isSignUp ? "Create account" : "Welcome back"}
            </h1>
            <p className="text-white/50 text-[13px] leading-relaxed">
              {isSignUp 
                ? "Start your journey with Wup." 
                : "Enter your credentials to access the Brain."}
            </p>
          </div>

          <div className="space-y-6">
            {/* Google Social Option */}
            <div className="space-y-2.5">
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full py-2.5 bg-white/[0.04] border border-white/[0.06] text-white/80 rounded-3xl font-medium text-[13px] flex items-center justify-center gap-2.5 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] transition-all group disabled:opacity-50"
              >
                <SiGoogle size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                Continue with Google
              </button>
              <p className="text-[10px] text-white/20 text-center tracking-wide">
                Demo mode only — integration unavailable
              </p>
            </div>

            <div className="relative flex items-center gap-4 py-1">
              <div className="h-[1px] flex-1 bg-white/[0.06]" />
              <span className="text-[10px] text-white/20 font-medium uppercase tracking-widest">or</span>
              <div className="h-[1px] flex-1 bg-white/[0.06]" />
            </div>

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <input
                  id="email"
                  type="email"
                  placeholder="Email address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-3xl text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-[var(--orange)]/30 hover:border-white/10 transition-all"
                  style={{ caretColor: "var(--orange)" }}
                />
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="w-full px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-3xl text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-[var(--orange)]/30 hover:border-white/10 transition-all"
                  style={{ caretColor: "var(--orange)" }}
                />
                {error && (
                  <motion.p 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="text-red-400 text-[11px] px-2 pt-1 font-medium text-center"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              <button
                disabled={authLoading}
                className="w-full py-2.5 rounded-3xl font-bold text-[13px] text-black active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "#ff5f1f", boxShadow: "0 0 20px rgba(255,95,31,0.2)" }}
              >
                {authLoading ? <Loader2 size={16} className="animate-spin" /> : (isSignUp ? "Sign up" : "Continue")}
              </button>
            </form>

            <div className="pt-2 flex flex-col items-center gap-8">
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-white/40 hover:text-white text-[12px] transition-all border-b border-transparent hover:border-white/20 pb-0.5"
              >
                {isSignUp ? "Already have an account? Log in" : "Don't have an account? Sign up"}
              </button>

              <div className="text-center text-white/15 text-[10px] leading-relaxed max-w-[240px]">
                By continuing, you agree to our <br />
                <Link href="#" className="text-white/30 hover:text-white transition-colors">Terms of Service</Link> & <Link href="#" className="text-white/30 hover:text-white transition-colors">Privacy Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
