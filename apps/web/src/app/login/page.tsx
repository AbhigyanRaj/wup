"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useAuth } from "@/components/auth-context";

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
    <main className="min-h-screen relative flex flex-col items-center justify-center px-8 bg-black selection:bg-white/10 overflow-hidden">
      {/* Subtle Depth Background */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ 
          background: "radial-gradient(circle at center, #0a0a0a 0%, #000 100%)" 
        }} 
      />

      <div className="relative z-10 w-full max-w-[340px] animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-white/20 hover:text-white mb-12 text-[10px] uppercase tracking-widest font-light transition-all group"
        >
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        {/* Modular Access Card */}
        <div className="space-y-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tighter mb-2">
              {isSignUp ? "Create account." : "Welcome back."}
            </h1>
            <p className="text-white/40 font-light text-sm leading-relaxed">
              {isSignUp 
                ? "Start your journey with the Unified Brain." 
                : "Enter your credentials to access the Brain."}
            </p>
          </div>

          <div className="space-y-8">
            {/* Google Social Option */}
            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading}
                className="w-full py-4 bg-zinc-900 border border-white/5 text-white/60 rounded-3xl font-medium text-xs flex items-center justify-center gap-3 hover:bg-zinc-800 hover:text-white active:scale-[0.98] transition-all group disabled:opacity-50"
              >
                <SiGoogle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Continue with Google
              </button>
              <p className="text-[9px] text-white/20 text-center tracking-wide uppercase">
                Demo mode only — integration unavailable
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[9px] uppercase tracking-[0.3em]">
                <span className="bg-black px-4 text-white/20 font-bold">or use email</span>
              </div>
            </div>

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full px-6 py-4 bg-zinc-900/30 border border-white/5 rounded-3xl text-white placeholder:text-zinc-700 focus:outline-none focus:border-white/20 hover:border-white/10 transition-all font-light text-sm"
                />
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="w-full px-6 py-4 bg-zinc-900/30 border border-white/5 rounded-3xl text-white placeholder:text-zinc-700 focus:outline-none focus:border-white/20 hover:border-white/10 transition-all font-light text-sm"
                />
                {error && (
                  <p className="text-red-500 text-[10px] px-2 font-medium text-center">{error}</p>
                )}
              </div>

              <button
                disabled={authLoading}
                className="w-full py-4 bg-white text-black rounded-3xl font-semibold text-sm hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignUp ? "Create Account" : "Continue")}
              </button>
            </form>

            <div className="pt-4 flex flex-col items-center gap-6">
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-white/40 hover:text-white text-[11px] font-light transition-all border-b border-transparent hover:border-white/20 pb-0.5"
              >
                {isSignUp ? "Already have an account? Log In" : "Don't have an account? Sign Up"}
              </button>

              <p className="text-center text-white/10 text-[9px] uppercase tracking-widest leading-relaxed">
                By continuing, you agree to our <br />
                <Link href="#" className="hover:text-white/30 transition-colors">Terms of Service</Link> & <Link href="#" className="hover:text-white/30 transition-colors">Privacy Policy</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
