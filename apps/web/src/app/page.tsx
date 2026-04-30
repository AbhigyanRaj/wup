"use client";

import Link from "next/link";
import { ArrowRight, Database, FileText, Zap, ShieldCheck } from "lucide-react";
import {
  SiMongodb, SiSupabase, SiGooglesheets,
  SiNotion, SiSlack, SiPostgresql,
} from "react-icons/si";
import { motion } from "framer-motion";
import BlurReveal from "@/components/reactbits/BlurReveal";
import LogoLoop from "@/components/reactbits/LogoLoop";
import LineWaves from "@/components/reactbits/LineWaves";

const features = [
  {
    icon: <Database size={15} />,
    title: "Live DB Bridges",
    desc: "Connect MongoDB and Google Sheets. The AI queries them directly — no exports, no ETL.",
  },
  {
    icon: <Zap size={15} />,
    title: "Model Rotation",
    desc: "Automatically switches between Gemini models on rate limits. Zero downtime, always available.",
  },
  {
    icon: <FileText size={15} />,
    title: "Document RAG",
    desc: "Upload PDFs and text files. The AI grounds every answer with citations from your documents.",
  },
  {
    icon: <ShieldCheck size={15} />,
    title: "Read-Only Safety",
    desc: "Strictly forbidden from writing or deleting data. Your databases are safe by design.",
  },
];

const techLogos = [
  { node: <SiPostgresql />, title: "PostgreSQL" },
  { node: <SiMongodb />, title: "MongoDB" },
  { node: <SiSupabase />, title: "Supabase" },
  { node: <SiGooglesheets />, title: "Google Sheets" },
  { node: <SiNotion />, title: "Notion" },
  { node: <SiSlack />, title: "Slack" },
];

export default function Home() {
  return (
    <main className="min-h-screen relative flex flex-col items-center bg-black text-white overflow-x-hidden selection:bg-white/10">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative w-full min-h-screen flex flex-col items-center px-6 text-center overflow-hidden">

        {/* Animated background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
          <LineWaves
            speed={0.1}
            innerLineCount={22}
            outerLineCount={26}
            warpIntensity={0.5}
            rotation={-45}
            edgeFadeWidth={0.14}
            colorCycleSpeed={0.35}
            brightness={0.1}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/20 to-black" />
        </div>

        {/* Nav */}
        <nav className="relative z-20 w-full max-w-5xl mx-auto pt-7 pb-4 flex justify-between items-center">
          {/* Logo using Monument Extended Regular */}
          <Link href="/" className="text-[15px] tracking-widest text-white/85 uppercase" style={{ fontFamily: "var(--font-display-2)" }}>
            WUP
          </Link>
          <div className="flex items-center gap-6">
            <Link href="#features" className="text-[12px] text-white/38 hover:text-white/70 transition-colors tracking-wide">
              Features
            </Link>
            <Link href="#integrations" className="text-[12px] text-white/38 hover:text-white/70 transition-colors tracking-wide">
              Integrations
            </Link>
            <Link
              href="/login"
              className="text-[12px] font-medium px-4 py-1.5 rounded-3xl bg-white text-black hover:bg-white/90 active:scale-[0.97] transition-all tracking-wide"
            >
              Sign in
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center max-w-5xl mx-auto pt-16 pb-28">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-3xl border border-white/8 bg-white/[0.04] text-[10.5px] text-white/40 mb-10 tracking-[0.12em] uppercase"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange)] shadow-[0_0_8px_rgba(255,95,31,0.5)] inline-block" />
            AI-powered data intelligence
          </motion.div>

          {/* Headline — Monument Extended Ultrabold */}
          <div
            className="mb-6 w-full max-w-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <BlurReveal
              text="Ask your data anything."
              className="text-[clamp(2rem,5.5vw,4.2rem)] leading-[1.05] tracking-tight justify-center text-white/95 whitespace-nowrap"
              duration={0.85}
              highlightWords={[{ word: "data", style: { color: "#ff5f1f" } }]}
            />
          </div>

          {/* Sub — Normal font, one line */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="text-[15px] leading-relaxed max-w-2xl mb-11 text-white/40 font-light"
          >
            Connect databases, upload documents, get instant answers in plain English.
          </motion.p>

          {/* CTA row */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center gap-3"
          >
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-3xl text-black text-[12px] font-bold active:scale-[0.97] transition-all tracking-wide"
              style={{ background: "#ff5f1f", boxShadow: "0 0 20px rgba(255,95,31,0.25)" }}
            >
              Start for free
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link 
              href="https://www.notion.so/Wup-350d9fc386ee80fa8d2dea6736f86625?source=copy_link"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-3xl border border-white/10 bg-white/[0.04] text-[12px] text-white/45 hover:text-white/70 hover:bg-white/[0.07] transition-all tracking-wide"
            >
              View docs
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="w-full max-w-5xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="mb-14"
        >
          <div
            className="text-[9px] uppercase tracking-[0.4em] text-white/20 font-medium mb-5 flex items-center gap-2"
          >
            <div className="w-1 h-1 rounded-full bg-[var(--orange)] opacity-40" />
            Built different
          </div>
          <h2
            className="text-[clamp(1.6rem,4vw,2.6rem)] tracking-tight text-white/88 leading-[1.05]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Intelligence that works<br />with your existing stack.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.45 }}
              className="group p-6 rounded-2xl border border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.045] transition-all duration-200"
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }}
              >
                {f.icon}
              </div>
              <h3
                className="text-[13px] text-white/80 mb-2 tracking-wide"
                style={{ fontFamily: "var(--font-display-2)" }}
              >
                {f.title}
              </h3>
              <p className="text-[12.5px] leading-relaxed text-white/32">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Integrations Marquee ─────────────────────────────────────────── */}
      <section id="integrations" className="w-full py-16 border-y border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6 mb-10 text-[9px] uppercase tracking-[0.4em] text-white/18 font-medium text-center">
          Supported integrations
        </div>
        <LogoLoop
          logos={techLogos}
          speed={50}
          direction="left"
          logoHeight={34}
          gap={68}
          scaleOnHover
          fadeOut
          fadeOutColor="#000000"
          className="text-white/18"
        />
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────── */}
      <section className="w-full max-w-5xl mx-auto px-6 py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <h2
            className="text-[clamp(1.6rem,4vw,2.8rem)] tracking-tight text-white/88 mb-5 leading-[1.05]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Ready to talk<br />to your <span style={{ color: "#ff5f1f" }}>data</span>?
          </h2>
          <p className="text-[13px] text-white/32 mb-9 max-w-xs mx-auto leading-relaxed tracking-wide">
            Connect a database and ask your first question in under 60 seconds.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-3xl text-black text-[12px] font-bold active:scale-[0.97] transition-all tracking-wide"
            style={{ background: "#ff5f1f", boxShadow: "0 0 25px rgba(255,95,31,0.25)" }}
          >
            Get started free
            <ArrowRight size={12} />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-12 border-t border-white/[0.05]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8">
          <div>
            <div
              className="text-[13px] tracking-widest text-white/75 mb-1.5 uppercase"
              style={{ fontFamily: "var(--font-display-2)" }}
            >
              WUP
            </div>
            <p className="text-[11.5px] text-white/22 font-light max-w-[200px] leading-relaxed">
              AI intelligence layer for your databases.
            </p>
          </div>
          <div className="flex gap-12">
            <div className="flex flex-col gap-3">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/18 font-medium">Platform</p>
              <Link href="#" className="text-[12px] text-white/35 hover:text-white/65 transition-colors font-light">Dashboard</Link>
              <Link href="#" className="text-[12px] text-white/35 hover:text-white/65 transition-colors font-light">Connectors</Link>
              <Link 
                href="https://www.notion.so/Wup-350d9fc386ee80fa8d2dea6736f86625?source=copy_link" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-white/35 hover:text-white/65 transition-colors font-light"
              >
                Docs
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/18 font-medium">Company</p>
              <Link href="#" className="text-[12px] text-white/35 hover:text-white/65 transition-colors font-light">About</Link>
              <Link href="#" className="text-[12px] text-white/35 hover:text-white/65 transition-colors font-light">Privacy</Link>
              <Link href="#" className="text-[12px] text-white/35 hover:text-white/65 transition-colors font-light">GitHub</Link>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/[0.04] flex justify-between items-center text-[9.5px] text-white/15 tracking-widest uppercase">
          <span>© 2026 Wup</span>
          <span>Built by Abhigyan Raj</span>
        </div>
      </footer>

    </main>
  );
}
