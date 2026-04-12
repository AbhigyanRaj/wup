# WUP - Unified Brain 2.0

WUP is a high-performance, minimalist AI orchestration platform designed to bridge disparate data sources into a unified, document-centric workspace. Inspired by state-of-the-art AI interfaces like Claude, WUP focuses on premium aesthetics, liquid responsiveness, and secure data orchestration.

![WUP Dashboard](/apps/web/public/logo.png)

## 🌟 Key Features

- **Claude-Inspired Workspace**: A distraction-free, "Document Style" chat interface with refined typography and fluid animations.
- **Intelligent Model Rotation**: 🔄 Automatically switches between available Gemini models (Gemini 3 Flash, 2.5 Flash, 2.0 Flash) if quota limits are reached, ensuring zero downtime.
- **Model Intelligence Selector**: A premium dashboard widget that allows users to manually select their preferred model or use "Auto-Rotate" with real-time exhaustion (429) tracking.
- **Multi-DB Connection Bridge**: Seamlessly connect MongoDB, Google Sheets, Supabase, and PostgreSQL via an encrypted credential vault.
- **Hybrid Sheets Authentication**: Supports both secure Service Account JSON keys and simplified API Key fallback for public/link-shared spreadsheets.
- **Session-Aware Chat**: Full persistence for multiple conversation threads with local memory and real-time synchronization.

## 🧠 Technical Architecture (Monorepo)

- **`apps/web`**: Next.js 15 (App Router) frontend utilizing Tailwind CSS and Framer Motion for high-fidelity interactions. Features dynamic model state management and bridge status visualization.
- **`apps/api`**: Modular Node.js / Express backend with an MVC architecture, MongoDB integration, and JWT-based authentication.
- **`packages/brain`**: Core AI orchestration logic with multi-turn function calling loops and adaptive model fallback protocols.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB instance (local or Atlas)
- Google Cloud Project (with Gemini and Sheets APIs enabled)

### Setup
1. **Clone and Install**:
```bash
git clone https://github.com/AbhigyanRaj/wup.git
cd wup
npm install
```

2. **Configure Environment**:
Create `.env` files in `apps/api` and `apps/web`:
```env
# apps/api/.env
PORT=4000
MONGODB_URI=your_mongo_url
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_gemini_key

# Optional: For secure private sheets
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=./path/to/service-account.json
```

3. **Run Development Mode**:
```bash
# Start both Web and API simultaneously
npm run dev
```

## 🔐 Security & Reliability

- **AES-256 Encryption**: All external database connection strings are encrypted at rest.
- **Fail-Fast Protocol**: The brain instantly detects daily quota exhaustion and switches to the next available intelligence core to prevent UI hangs.
- **Bridge Verifier**: Enhanced error handling for Google Sheets "API Disabled" and "Permission Denied" states with actionable user feedback.

## 🛤️ Roadmap & Next Steps

### Phase 2: Data Bridge & Model Intelligence ✅ COMPLETED (April 2026)
- [x] **Dynamic Intelligence Rotation**: Automated fallback between Gemini models.
- [x] **Hybrid Sheets Connectivity**: Support for API key access to public sheets.
- [x] **Exhaustion Visualizers**: UI indicators for rate-limited models.
- [x] **Context Bridge Status**: Dashboard indicator for active data connections.

### Phase 3: High-Performance UX
- [ ] **Token Streaming**: Implement Server-Sent Events (SSE) for instant, real-time responses.
- [ ] **Streaming Renderer**: Update the UI to display tokens one-by-one as they arrive.
- [ ] **Asynchronous Feedback**: Better visual cues during complex multi-tool executions.

### Phase 4: Advanced Analytics
- [ ] **Multi-Source Joins**: Let the AI combine data from MongoDB and Sheets in a single analysis.
- [ ] **Data Visualization**: Specialized components for AI-generated charts and graphs.

---
Developed by **Abhigyan Raj** | 2026 Unified Brain Project
