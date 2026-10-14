import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthArtPanel } from "@/components/auth/art-panel";
import { AuthForm } from "@/components/auth/auth-form";
import { noindexMetadata } from "@/lib/seo";

/*
 * Log in and sign up (kit login.md 6 + components/auth.html). Left: the woven
 * PixelField art panel with the brand on it (900px and up). Right: the 320px
 * auth column; ?mode=signup switches the copy and adds a name field.
 * useSearchParams lives in AuthForm, so it sits inside Suspense.
 */
export const metadata: Metadata = {
  ...noindexMetadata,
  title: "Log in",
  description: "Log in to wuup or create an account to ask MongoDB, Google Sheets and PDFs questions in plain English.",
};

function ColumnFallback() {
  return (
    <div className="auth__col" aria-hidden="true">
      <div className="mx-auto mb-7 h-7 w-44 rounded-full bg-[#f0f0f0]" />
      <div className="h-11 rounded-full bg-[#f0f0f0]" />
      <div className="my-4 h-5" />
      <div className="h-11 rounded-full border border-[#e6e6e6]" />
      <div className="h-11 rounded-full border border-[#e6e6e6]" />
      <div className="mt-2 h-11 rounded-full bg-[#f0f0f0]" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth h-dvh min-h-[600px] max-[899px]:h-auto max-[899px]:min-h-dvh">
      <AuthArtPanel />
      <div className="auth__panel overflow-y-auto px-5 py-12 min-[900px]:px-4">
        <Suspense fallback={<ColumnFallback />}>
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}
