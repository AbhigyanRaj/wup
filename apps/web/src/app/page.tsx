import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiReact, SiNextdotjs, SiTypescript, SiTailwindcss, SiPostgresql, SiMongodb, SiSupabase, SiGooglesheets, SiNotion, SiSlack } from "react-icons/si";
import BlurReveal from "@/components/reactbits/BlurReveal";
import LogoLoop from "@/components/reactbits/LogoLoop";
import LineWaves from "@/components/reactbits/LineWaves";

export default function Home() {
  const techLogos = [
    { node: <SiPostgresql />, title: "PostgreSQL" },
    { node: <SiMongodb />, title: "MongoDB" },
    { node: <SiSupabase />, title: "Supabase" },
    { node: <SiGooglesheets />, title: "Google Sheets" },
    { node: <SiNotion />, title: "Notion" },
    { node: <SiSlack />, title: "Slack" },
    { node: <SiReact />, title: "React" },
    { node: <SiNextdotjs />, title: "Next.js" },
    { node: <SiTypescript />, title: "TypeScript" },
    { node: <SiTailwindcss />, title: "Tailwind CSS" },
  ];

  return (
    <main className="min-h-screen relative flex flex-col items-center selection:bg-white/10 selection:text-white bg-black overflow-x-hidden">
      {/* Hero Section (Includes Navbar for background consistency) */}
      <section className="relative w-full h-screen flex flex-col items-center px-8 text-center overflow-hidden ">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
          <LineWaves
            speed={0.15}
            innerLineCount={28}
            outerLineCount={32}
            warpIntensity={0.6}
            rotation={-45}
            edgeFadeWidth={0.1}
            colorCycleSpeed={0.5}
            brightness={0.15}
          />
          {/* Top & Bottom Fade Mask */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black" />
        </div>

        {/* Navigation (Inside Hero for background) */}
        <nav className="relative z-20 w-full max-w-7xl py-8 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="text-xl font-medium tracking-tighter">WUP</div>
          </Link>
          <div className="flex gap-8 text-sm font-light text-white/60">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#docs" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/login" className="px-5 py-2 bg-white text-black rounded-3xl font-medium hover:bg-neutral-200 transition-all">
              Get Started
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center items-center max-w-4xl">
          <BlurReveal
            text="Transform your data stack"
            className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.1] mb-8 justify-center"
            duration={1}
          />
          
          <p className="text-white/40 text-lg md:text-xl font-light mb-12 max-w-2xl leading-relaxed">
            Chat with your live data in plain English. No SQL, no complexity, just intelligence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Link 
              href="/login" 
              className="group flex items-center gap-2 px-8 py-4 bg-white text-black rounded-3xl font-medium text-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Launch Unified Brain
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="px-8 py-4 text-white/60 hover:text-white transition-colors text-lg font-light">
              View Documentation
            </button>
          </div>
        </div>
      </section>

      {/* Marquee Section (LogoLoop) */}
      <section className="w-full py-20 border-y border-white/5 bg-neutral-900/10 backdrop-blur-3xl">
        <div className="max-w-7xl mx-auto px-8 mb-12 text-[10px] uppercase tracking-[0.3em] text-white/20 font-medium">
          Supported Integrations
        </div>
        <LogoLoop
          logos={techLogos}
          speed={60}
          direction="left"
          logoHeight={40}
          gap={80}
          scaleOnHover
          fadeOut
          fadeOutColor="#000000"
          className="text-white/20"
        />
      </section>

      {/* Footer */}
      <footer className="w-full max-w-7xl px-8 py-20 mt-auto border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-lg font-medium tracking-tighter">WUP</div>
            </div>
            <p className="text-white/40 text-sm font-light max-w-xs leading-relaxed">
              The seamless self-service intelligence layer for modern teams. Built for high-performance data operations.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">Platform</h4>
            <Link href="#" className="text-sm font-light text-white/50 hover:text-white transition-colors">Dashboard</Link>
            <Link href="#" className="text-sm font-light text-white/50 hover:text-white transition-colors">Connectors</Link>
            <Link href="#" className="text-sm font-light text-white/50 hover:text-white transition-colors">Slack Bot</Link>
          </div>
          <div className="flex flex-col gap-4">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">Company</h4>
            <Link href="#" className="text-sm font-light text-white/50 hover:text-white transition-colors">About</Link>
            <Link href="#" className="text-sm font-light text-white/50 hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="text-sm font-light text-white/50 hover:text-white transition-colors">Legal</Link>
          </div>
        </div>
        <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-[10px] text-white/20 uppercase tracking-widest">
          <div>© 2026 Unified Brain</div>
          <div className="flex gap-8">
            <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
            <Link href="#" className="hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
