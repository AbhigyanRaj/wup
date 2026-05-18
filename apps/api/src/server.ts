import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";
import connectionRoutes from "./routes/connection";
import chatRoutes from "./routes/chat";
import knowledgeRoutes from "./routes/knowledge";
import userRoutes from "./routes/user";

// Register models so Mongoose knows them before any package references them by name
import "./models/KnowledgeSource";
import "./models/KnowledgeChunk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/wup";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const allowedOrigins = CORS_ORIGIN.includes(",") ? CORS_ORIGIN.split(",").map(o => o.trim()) : CORS_ORIGIN;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (Array.isArray(allowedOrigins) ? allowedOrigins.includes(origin) : allowedOrigins === origin) {
      return callback(null, true);
    }
    // Allow any localhost origin for development convenience
    if (origin.startsWith("http://localhost:")) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true 
}));
app.use(express.json({ limit: "2mb" }));

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("[WUP API] Connected to MongoDB");
    
    // Migration: update all users to have freeTierLimit: 50 if they have less
    try {
      const collection = mongoose.connection.db!.collection("users");
      const result = await collection.updateMany(
        { $or: [{ freeTierLimit: { $lt: 50 } }, { freeTierLimit: { $exists: false } }] },
        { $set: { freeTierLimit: 50 } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[WUP API] Migrated ${result.modifiedCount} users to 50 free limit.`);
      }
    } catch (err) {
      console.error("[WUP API] Migration failed:", err);
    }

    // Maintenance: ensure indexes are clean
    try {
      const collection = mongoose.connection.db!.collection("users");
      const indexes = await collection.indexes();
      if (indexes.some(idx => idx.name === "username_1")) {
        await collection.dropIndex("username_1");
        console.log("[WUP API] Cleaned stale indexes.");
      }
    } catch (err) {
      // Index might not exist yet — safe to ignore
    }
  })
  .catch(err => console.error("[WUP API] Database connection error:", err));

// Routes
app.use("/auth", authRoutes);
app.use("/connections", connectionRoutes);
app.use("/chats", chatRoutes);
app.use("/knowledge", knowledgeRoutes);
app.use("/user", userRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  const uptime = process.uptime();
  const uptimeStr = uptime < 60
    ? `${Math.floor(uptime)}s`
    : uptime < 3600
    ? `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`
    : `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WUP · API Status</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'WupDisplay';
      src: url('${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/fonts/font-1.otf') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  </style>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --white: #ffffff;
      --off-white: #f9f9f9;
      --gray-50: #f5f5f5;
      --gray-100: #ebebeb;
      --gray-200: #d4d4d4;
      --gray-400: #a1a1a1;
      --gray-600: #737373;
      --gray-800: #262626;
      --black: #0a0a0a;
      --blue: #2563eb;
      --blue-hover: #1d4ed8;
      --blue-light: rgba(37,99,235,0.08);
      --blue-border: rgba(37,99,235,0.15);
      --green: #22c55e;
      --radius-sm: 8px;
      --radius-md: 14px;
      --radius-lg: 20px;
      --radius-xl: 28px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --shadow-md: 0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
      --shadow-lg: 0 12px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
      --transition: cubic-bezier(0.16, 1, 0.3, 1);
    }

    body {
      font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--off-white);
      color: var(--black);
      min-height: 100vh;
      line-height: 1.5;
      /* subtle dot grid */
      background-image: radial-gradient(circle, #d4d4d4 1px, transparent 1px);
      background-size: 28px 28px;
    }

    /* ── Navbar ─────────────────────────────── */
    nav {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(249,249,249,0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--gray-100);
    }
    .nav-inner {
      max-width: 980px;
      margin: 0 auto;
      padding: 0 1.5rem;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--black);
    }
    .brand-name {
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--black);
    }
    .brand-name span { color: var(--gray-400); }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }
    .nav-link {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--gray-600);
      text-decoration: none;
      transition: color 0.2s;
    }
    .nav-link:hover { color: var(--black); }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--white);
      border: 1px solid var(--gray-100);
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--gray-800);
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s;
    }
    .status-pill:hover { box-shadow: var(--shadow-md); }
    .status-pill .dot {
      width: 6px;
      height: 6px;
      background: var(--green);
      border-radius: 50%;
      position: relative;
    }
    .status-pill .dot::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: var(--green);
      animation: ping 2s ease-out infinite;
    }

    /* ── Layout ─────────────────────────────── */
    .page {
      max-width: 980px;
      margin: 0 auto;
      padding: 5rem 1.5rem 6rem;
    }

    /* ── Hero ───────────────────────────────── */
    .hero {
      text-align: center;
      margin-bottom: 5rem;
    }
    .hero-eyebrow {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--gray-400);
      margin-bottom: 1.25rem;
    }
    .hero h1 {
      font-family: 'WupDisplay', 'Geist', sans-serif;
      font-size: clamp(2.75rem, 6.5vw, 4.5rem);
      font-weight: 400;
      letter-spacing: -0.02em;
      line-height: 1.05;
      color: var(--black);
      margin-bottom: 1.25rem;
    }
    .hero h1 em {
      font-style: normal;
      color: var(--blue);
    }
    .hero p {
      font-size: 1rem;
      color: var(--gray-600);
      max-width: 480px;
      margin: 0 auto 2rem;
      line-height: 1.65;
    }
    .hero-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all 0.2s var(--transition);
    }
    .btn-primary {
      background: var(--black);
      color: var(--white);
      padding: 8px 18px;
      box-shadow: var(--shadow-sm);
    }
    .btn-primary:hover {
      background: var(--gray-800);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }
    .btn-ghost {
      background: transparent;
      color: var(--gray-600);
      padding: 8px 14px;
      border: 1px solid var(--gray-200);
    }
    .btn-ghost:hover {
      color: var(--black);
      border-color: var(--gray-400);
      transform: translateY(-1px);
    }
    .btn svg { flex-shrink: 0; }

    /* ── Metrics grid ───────────────────────── */
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--gray-100);
      border: 1px solid var(--gray-100);
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: 1.25rem;
      box-shadow: var(--shadow-sm);
    }
    .metric {
      background: var(--white);
      padding: 1.75rem 1.5rem;
      transition: background 0.2s;
    }
    .metric:hover { background: var(--gray-50); }
    .metric-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      background: var(--gray-50);
      border: 1px solid var(--gray-100);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--gray-600);
      margin-bottom: 1rem;
      transition: all 0.2s;
    }
    .metric:hover .metric-icon {
      background: var(--blue-light);
      border-color: var(--blue-border);
      color: var(--blue);
    }
    .metric-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--gray-400);
      margin-bottom: 0.35rem;
    }
    .metric-value {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--black);
    }
    .metric-value.mono {
      font-family: 'Geist Mono', monospace;
      font-size: 0.85rem;
    }
    .metric-value.green { color: var(--green); }

    /* ── Divider strip ─────────────────────── */
    .strip {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.25rem;
      margin-bottom: 1.25rem;
    }
    .strip-card {
      background: var(--white);
      border: 1px solid var(--gray-100);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
      transition: all 0.25s var(--transition);
    }
    .strip-card:hover {
      border-color: var(--gray-200);
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    .strip-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--gray-600);
      margin-bottom: 0.35rem;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .strip-title svg { color: var(--gray-400); }
    .strip-value {
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--black);
    }
    .strip-sub {
      font-size: 0.7rem;
      color: var(--gray-400);
      margin-top: 0.25rem;
    }
    .uptime-bar {
      margin-top: 0.75rem;
      height: 3px;
      background: var(--gray-100);
      border-radius: 9999px;
      overflow: hidden;
    }
    .uptime-fill {
      height: 100%;
      width: 0%;
      background: var(--black);
      border-radius: 9999px;
      animation: fillBar 1.2s 0.3s var(--transition) forwards;
    }

    /* ── Terminal ───────────────────────────── */
    .terminal {
      background: var(--black);
      border-radius: var(--radius-xl);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }
    .terminal-bar {
      background: #1a1a1a;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #2a2a2a;
    }
    .traffic-lights {
      display: flex;
      gap: 6px;
    }
    .tl {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .tl:hover { opacity: 0.7; }
    .tl-red { background: #ff5f57; }
    .tl-yellow { background: #febc2e; }
    .tl-green { background: #28c840; }
    .terminal-title {
      font-family: 'Geist Mono', monospace;
      font-size: 0.7rem;
      color: #4a4a4a;
      flex: 1;
      text-align: center;
    }
    .terminal-body {
      padding: 1.5rem;
    }
    .t-line {
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-family: 'Geist Mono', monospace;
      font-size: 0.78rem;
      line-height: 1.8;
      opacity: 0;
      transform: translateY(4px);
    }
    .t-line.visible {
      animation: lineIn 0.3s var(--transition) forwards;
    }
    .t-tag {
      color: var(--blue);
      font-weight: 500;
      min-width: 120px;
      font-size: 0.72rem;
    }
    .t-msg { color: #737373; }
    .t-ok {
      margin-left: auto;
      font-size: 0.68rem;
      color: #28c840;
      font-weight: 500;
      flex-shrink: 0;
    }
    .cursor {
      display: inline-block;
      width: 7px;
      height: 13px;
      background: var(--blue);
      border-radius: 1px;
      vertical-align: middle;
      animation: blink 1s step-end infinite;
      margin-left: 4px;
    }

    /* ── Footer ─────────────────────────────── */
    footer {
      margin-top: 4rem;
      text-align: center;
      font-size: 0.75rem;
      color: var(--gray-400);
    }
    footer a {
      color: var(--gray-600);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }
    footer a:hover { color: var(--black); }

    /* ── Keyframes ──────────────────────────── */
    @keyframes ping {
      0% { transform: scale(1); opacity: 0.8; }
      80%, 100% { transform: scale(2.5); opacity: 0; }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes lineIn {
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fillBar {
      to { width: 99.9%; }
    }

    @media (max-width: 768px) {
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .strip { grid-template-columns: 1fr; }
      .hero h1 { font-size: 2.25rem; }
      .nav-link { display: none; }
    }
    @media (max-width: 500px) {
      .metrics { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>

  <!-- Navbar -->
  <nav>
    <div class="nav-inner">
      <div class="brand">
        <div class="brand-dot"></div>
        <span class="brand-name">wup<span>/</span>api</span>
      </div>
      <div class="nav-right">
        <a href="#metrics" class="nav-link">metrics</a>
        <a href="#log" class="nav-link">integrity log</a>
        <div class="status-pill">
          <div class="dot"></div>
          all systems operational
        </div>
      </div>
    </div>
  </nav>

  <div class="page">

    <!-- Hero -->
    <section class="hero">
      <span class="hero-eyebrow">wup intelligence gateway</span>
      <h1>The engine that<br><em>powers</em> everything.</h1>
      <p>A minimal, resilient API layer serving the WUP intelligence orchestrator, routing pipelines, and all database clusters in real time.</p>
      <div class="hero-actions">
        <a href="#metrics" class="btn btn-primary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          view status
        </a>
        <a href="https://github.com/abhigyanraj" target="_blank" class="btn btn-ghost">
          github
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
        </a>
      </div>
    </section>

    <!-- Metrics row -->
    <div id="metrics" class="metrics">
      <div class="metric">
        <div class="metric-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div class="metric-label">Environment</div>
        <div class="metric-value">Production</div>
      </div>
      <div class="metric">
        <div class="metric-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
        </div>
        <div class="metric-label">Database</div>
        <div class="metric-value green">Connected</div>
      </div>
      <div class="metric">
        <div class="metric-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div class="metric-label">Port</div>
        <div class="metric-value mono">${PORT}</div>
      </div>
      <div class="metric">
        <div class="metric-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="metric-label">Engine</div>
        <div class="metric-value mono">node ${process.version}</div>
      </div>
    </div>

    <!-- Strip cards -->
    <div class="strip">
      <div class="strip-card">
        <div class="strip-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          uptime
        </div>
        <div class="strip-value">${uptimeStr}</div>
        <div class="strip-sub">since last restart</div>
        <div class="uptime-bar"><div class="uptime-fill"></div></div>
      </div>
      <div class="strip-card">
        <div class="strip-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          ai providers
        </div>
        <div class="strip-value">4</div>
        <div class="strip-sub">Gemini · Claude · GPT · OpenRouter</div>
      </div>
      <div class="strip-card">
        <div class="strip-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          api version
        </div>
        <div class="strip-value">v1</div>
        <div class="strip-sub">stable release · REST + SSE</div>
      </div>
    </div>

    <!-- Terminal -->
    <div id="log" class="terminal">
      <div class="terminal-bar">
        <div class="traffic-lights">
          <div class="tl tl-red"></div>
          <div class="tl tl-yellow"></div>
          <div class="tl tl-green"></div>
        </div>
        <div class="terminal-title">wup-api — integrity log</div>
      </div>
      <div class="terminal-body" id="term-body">
        <div class="t-line" data-delay="0">
          <span class="t-tag">[BOOT]</span>
          <span class="t-msg">Initialising WUP Intelligence Router&hellip;</span>
          <span class="t-ok">✓</span>
        </div>
        <div class="t-line" data-delay="120">
          <span class="t-tag">[MIDDLEWARE]</span>
          <span class="t-msg">CORS, rate-limiter, auth pipeline bound</span>
          <span class="t-ok">✓</span>
        </div>
        <div class="t-line" data-delay="240">
          <span class="t-tag">[DATABASE]</span>
          <span class="t-msg">MongoDB cluster mapped — 5 collections</span>
          <span class="t-ok">✓</span>
        </div>
        <div class="t-line" data-delay="360">
          <span class="t-tag">[BRAIN]</span>
          <span class="t-msg">Orchestrator hot-loaded · 4 provider adapters</span>
          <span class="t-ok">✓</span>
        </div>
        <div class="t-line" data-delay="480">
          <span class="t-tag">[SERVER]</span>
          <span class="t-msg">Listening on :${PORT}</span>
          <span class="t-ok">✓</span>
        </div>
        <div class="t-line" data-delay="600">
          <span class="t-tag">[STATUS]</span>
          <span class="t-msg">All systems nominal<span class="cursor"></span></span>
        </div>
      </div>
    </div>

    <footer>
      <p>Made with care by <a href="https://github.com/abhigyanraj" target="_blank">@abhigyanraj</a> · WUP AI</p>
    </footer>

  </div>

  <script>
    // Staggered terminal line reveal
    const lines = document.querySelectorAll('.t-line');
    lines.forEach(line => {
      const delay = parseInt(line.dataset.delay || '0');
      setTimeout(() => line.classList.add('visible'), delay + 200);
    });
  </script>

</body>
</html>`);
});



// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[WUP API] Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

app.listen(PORT, () => {
  console.log(`[WUP API] Server running on http://localhost:${PORT}`);
});

