"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { setToken } from "@/lib/auth-token";
import { cn } from "@/lib/cn";
import { APP_HOME, SITE } from "@/lib/site";

/*
 * The auth column (kit login.md 3.3 and 6; brief 5 and 10). One component,
 * two modes from ?mode=signup, a COPY table for the words. Order: Google
 * (coming soon) pill, OR, the email form, the ink primary (a grey surface
 * until the form is valid), then the terms note, the mode switch and the demo.
 * Three text colours only (#141414, #525252, #999); indigo appears once, in
 * the focus ring and the "Coming soon" label.
 */

type Mode = "login" | "signup";

const COPY: Record<Mode, { heading: string; cta: string; prompt: string; action: string; to: Mode }> = {
  login: { heading: "Log in to wuup", cta: "Log in", prompt: "Don't have an account?", action: "Create one", to: "signup" },
  signup: { heading: "Create your account", cta: "Create account", prompt: "Already have an account?", action: "Log in", to: "login" },
};

const MIN_PASSWORD = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REVEAL_MS = 1600;

/** `next` must be a same-site path: starts with "/" and not "//". */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return APP_HOME;
  return raw;
}

interface ApiError {
  error?: string;
  code?: string;
  retryAfterS?: number;
}

function messageFor(status: number, body: ApiError | null, mode: Mode | "demo"): string {
  if (status === 409) return "An account with this email already exists";
  if (status === 429) {
    const wait = body?.retryAfterS ? ` Try again in about ${Math.max(1, Math.ceil(body.retryAfterS / 60))} min.` : "";
    return (body?.error ?? "Too many attempts. Please wait a few minutes and try again.") + (body?.error ? "" : wait);
  }
  if (body?.error) return body.error;
  if (status === 401) return "That email and password don't match.";
  if (mode === "demo") return "The demo could not start. Please try again.";
  return "Something went wrong. Please try again.";
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.92l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l4-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

/** "Continue with Google" until clicked, then "Coming soon" in indigo with a soft shimmer for 1.6s. */
function GoogleSoon() {
  const [revealed, setRevealed] = useState(false);
  const [announce, setAnnounce] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shimmer = useRef<HTMLSpanElement | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function trigger() {
    setRevealed(true);
    setAnnounce("");
    // Re-set on the next tick so a second click is announced again.
    requestAnimationFrame(() => setAnnounce("Continue with Google is coming soon."));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRevealed(false), REVEAL_MS);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shimmer.current?.animate([{ backgroundPosition: "120% 0" }, { backgroundPosition: "-20% 0" }], {
        duration: REVEAL_MS,
        easing: "ease-in-out",
      });
    }
  }

  return (
    <>
      <button type="button" onClick={trigger} className="btn btn--auth btn--block bg-[#f0f0f0] text-[#141414] hover:bg-[#e6e6e6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b3b3b3]">
        <span>
          <GoogleIcon />
          <span className="relative inline-grid overflow-hidden">
            <span
              aria-hidden={revealed}
              className={cn(
                "col-start-1 row-start-1 truncate transition-[transform,opacity] duration-200 ease-out",
                revealed ? "-translate-y-1.5 opacity-0" : "translate-y-0 opacity-100",
              )}
            >
              Continue with Google
            </span>
            <span
              ref={shimmer}
              aria-hidden={!revealed}
              className={cn(
                "col-start-1 row-start-1 truncate bg-clip-text text-center font-medium text-transparent transition-[transform,opacity] duration-200 ease-out",
                revealed ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
              )}
              style={{
                backgroundImage:
                  "linear-gradient(100deg, var(--indigo-700) 0%, var(--indigo-700) 40%, var(--indigo-400) 50%, var(--indigo-700) 60%, var(--indigo-700) 100%)",
                backgroundSize: "250% 100%",
                backgroundPosition: "50% 0",
              }}
            >
              Coming soon
            </span>
          </span>
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </>
  );
}

const inputCls =
  "h-11 w-full rounded-full border border-[#e6e6e6] bg-white px-4 text-[16px] text-[#141414] placeholder:text-[#999] outline-none transition-[border-color,box-shadow] duration-[120ms] hover:border-[#cccccc] focus:border-[#b3b3b3] focus:shadow-[0_0_0_3px_rgba(106,136,226,0.28)] sm:text-[15px] aria-[invalid=true]:border-[#b81514]";

export function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const mode: Mode = params.get("mode") === "signup" ? "signup" : "login";
  const next = safeNext(params.get("next"));
  const copy = COPY[mode];
  const uid = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<null | "form" | "demo">(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState(mode);

  // Clear the error when the mode changes (brief 10).
  if (lastMode !== mode) {
    setLastMode(mode);
    setError(null);
  }

  const emailOk = EMAIL_RE.test(email.trim());
  const pwOk = mode === "signup" ? password.length >= MIN_PASSWORD : password.length > 0;
  const nameOk = mode === "login" || name.trim().length > 0;
  const valid = emailOk && pwOk && nameOk;

  const switchHref = (() => {
    const q = new URLSearchParams();
    if (copy.to === "signup") q.set("mode", "signup");
    const n = params.get("next");
    if (n) q.set("next", n);
    const s = q.toString();
    return `/login${s ? `?${s}` : ""}`;
  })();

  async function call(path: "/auth/login" | "/auth/signup" | "/auth/demo", body: object | undefined, kind: "form" | "demo") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`${SITE.apiUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = (await res.json().catch(() => null)) as (ApiError & { token?: string }) | null;
      if (!res.ok) {
        setError(messageFor(res.status, data, kind === "demo" ? "demo" : mode));
        setBusy(null);
        return;
      }
      setToken(data?.token ?? null);
      router.replace(next);
    } catch {
      setError("We could not reach wuup. Check your connection and try again.");
      setBusy(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    if (mode === "signup") {
      void call("/auth/signup", { name: name.trim(), email: email.trim(), password }, "form");
    } else {
      void call("/auth/login", { email: email.trim(), password }, "form");
    }
  }

  return (
    <div className="auth__col">
      <div className="mb-5 flex justify-center min-[900px]:hidden">
        <span className="font-sans text-[28px] font-bold leading-none tracking-[-0.035em] text-[#141414]">wuup</span>
      </div>
      <h1 className="auth__title">{copy.heading}</h1>

      <GoogleSoon />

      <div className="divider-or my-4 text-[14px] text-[#525252] before:bg-[#f0f0f0] after:bg-[#f0f0f0]">OR</div>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2" aria-label={copy.heading}>
        {mode === "signup" ? (
          <>
            <label htmlFor={`${uid}-name`} className="sr-only">
              Name
            </label>
            <input
              id={`${uid}-name`}
              className={inputCls}
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </>
        ) : null}
        <label htmlFor={`${uid}-email`} className="sr-only">
          Email
        </label>
        <input
          id={`${uid}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={inputCls}
          placeholder="e.g., name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={email.length > 3 && !emailOk && email.includes("@") && email.split("@")[1]!.includes(".") ? true : undefined}
        />
        <label htmlFor={`${uid}-pw`} className="sr-only">
          Password
        </label>
        <div className="relative">
          <input
            id={`${uid}-pw`}
            type={showPw ? "text" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={cn(inputCls, "pr-12")}
            placeholder={mode === "signup" ? `Password, ${MIN_PASSWORD}+ characters` : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={mode === "signup" ? `${uid}-pw-hint` : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            aria-pressed={showPw}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-[#525252] transition-colors duration-[120ms] hover:bg-[#f0f0f0] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-indigo-400"
          >
            {showPw ? <EyeOff className="size-[18px]" strokeWidth={1.5} /> : <Eye className="size-[18px]" strokeWidth={1.5} />}
          </button>
        </div>
        {mode === "signup" ? (
          <p id={`${uid}-pw-hint`} className={cn("px-4 text-[13px]", password && !pwOk ? "text-[#525252]" : "text-[#999]")}>
            At least {MIN_PASSWORD} characters.
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-1 flex items-start gap-2 rounded-xl border border-[rgb(184_21_20/0.3)] bg-[#fde7e2] px-3 py-2.5 text-[13px] leading-[1.45] text-[#b81514]"
          >
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!valid || busy !== null}
          aria-busy={busy === "form"}
          className={cn(
            "btn btn--auth btn--block mt-2",
            valid || busy === "form"
              ? "btn--auth-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141414]/50 disabled:opacity-100"
              : "cursor-not-allowed bg-[#f0f0f0] text-[#999] disabled:opacity-100",
          )}
        >
          <span>
            {busy === "form" ? <Loader2 className="size-4 animate-spin" aria-label="Working" /> : copy.cta}
          </span>
        </button>
      </form>

      <p className="mt-4 text-center text-[13px] leading-[1.5] text-[#999]">
        By continuing you agree to the{" "}
        <Link href="/terms" className="text-[#525252] underline underline-offset-2 hover:text-[#141414]">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-[#525252] underline underline-offset-2 hover:text-[#141414]">
          privacy policy
        </Link>
        .
      </p>

      <p className="auth__switch mt-5 text-[14px] text-[#141414]">
        {copy.prompt}{" "}
        <Link href={switchHref} replace scroll={false} className="text-[#525252] hover:underline">
          {copy.action}
        </Link>
      </p>

      <button
        type="button"
        onClick={() => void call("/auth/demo", undefined, "demo")}
        disabled={busy !== null}
        aria-busy={busy === "demo"}
        className="btn btn--auth btn--block mt-5 bg-transparent shadow-[inset_0_0_0_1px_#e6e6e6] hover:bg-[#f0f0f0]"
      >
        <span>
          {busy === "demo" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy === "demo" ? "Opening the demo" : "Try the demo"}
        </span>
      </button>
      <p className="mt-2 text-center text-[13px] text-[#999]">A sandbox with sample data. No sign-up needed.</p>
    </div>
  );
}
