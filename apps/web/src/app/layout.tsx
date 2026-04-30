import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Custom display fonts from assets */
const fontDisplay = localFont({
  src: "../../public/fonts/font-1.otf",
  variable: "--font-display",
  display: "swap",
});

const fontDisplay2 = localFont({
  src: "../../public/fonts/font-2.otf",
  variable: "--font-display-2",
  display: "swap",
});

import { AuthProvider } from "@/components/auth-context";

export const metadata: Metadata = {
  title: "Wup | AI Data Intelligence",
  description: "AI-powered data intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fontDisplay.variable} ${fontDisplay2.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
