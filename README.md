# WUP

WUP is a high-performance AI orchestration platform designed to unify disparate data sources into a single, document-centric workspace. It addresses the challenge of data fragmentation by allowing users to interact with live databases and spreadsheets via natural language. The platform is engineered for data analysts, engineers, and product teams who require immediate, conversational access to multi-source data without the overhead of manual querying.


## Features

- **Intelligent Model Rotation**: System maintains zero downtime by automatically switching between multiple Gemini models (3.0 Flash, 2.5 Flash, 2.0 Flash) when rate limits or daily quotas are reached.
- **Multi-Source Data Bridges**: Secure connectivity for MongoDB and Google Sheets with an encrypted credential vault for sensitive information.
- **Autonomous Tool Orchestration**: Leverages LLM function-calling loops to introspect schemas and execute read-only queries across bridged databases.
- **Conversational Persistence**: Full multi-turn thread management with optimized context windows for precise and reliable long-form interaction.
- **Premium Interface Architecture**: A minimalist, high-fidelity workspace inspired by state-of-the-art AI interfaces, focused on readability and data presentation.

## Setup and Installation

### Prerequisites

- Node.js 18.0 or higher
- MongoDB instance (Local or Atlas)
- Google Cloud Project with Gemini and Sheets APIs enabled

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/AbhigyanRaj/wup.git
   cd wup
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create `.env` files in `apps/api` and `apps/web` using the provided `.env.example` templates. Refer to the specific application directories for configuration keys.

### Running the Project

To start the development environment for both the API and Web applications, run:
```bash
npm run dev
```

The Web interface will be accessible at `http://localhost:3000` and the API at `http://localhost:4000`.

## Tech Stack

- **Languages**: TypeScript
- **Frontend Framework**: Next.js 15 (App Router), Framer Motion, Tailwind CSS
- **Backend Framework**: Node.js, Express
- **Databases**: MongoDB (Primary), Google Sheets Integration
- **AI Models**: Google Gemini (Direct API orchestration)

## Usage Examples

### Connecting a Data Bridge
Users can connect external databases via the dashboard UI or API. Example API call to bridge a MongoDB collection:
```bash
curl -X POST http://localhost:4000/connections \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Inventory DB",
    "type": "mongodb",
    "config": "mongodb+srv://user:pass@cluster.mongodb.net/"
  }'
```

### Querying the Brain
Once a bridge is active, the assistant can be queried directly about the data. Example query sequence:
1. **Request**: "Which products in the Inventory DB have a stock level below 10?"
2. **System Action**: Brain calls `get_mongodb_schema`, then `query_mongodb` with a filter `{ stock: { $lt: 10 } }`.
3. **Response**: Assistant returns a Markdown table showing the relevant products.

## Architecture Notes

WUP is structured as a Monorepo using Turborepo to manage applications and shared packages.

### System Flow Diagram
```mermaid
graph TD
    User((User)) -->|Natural Language| Web[Web Application - apps/web]
    Web -->|API Request| API[API Service - apps/api]
    
    subgraph "Intelligence Layer"
    API -->|Orchestrate| Brain[Brain Orchestrator - packages/brain]
    Brain -->|Model Rotation| Gemini[Gemini AI Cluster]
    end
    
    subgraph "Data Bridges"
    Brain -->|Function Call| Mongo[(MongoDB)]
    Brain -->|Function Call| Sheets[(Google Sheets)]
    end
    
    Gemini -->|Synthesis| Brain
    Brain -->|Structured Data| API
    API -->|JSON Response| Web
    Web -->|Premium UI Message| User
```

- **apps/web**: Next.js frontend handling the UI layer and model status visualization.
- **apps/api**: Express backend managing authentication, session persistence, and credential storage.
- **packages/brain**: Core intelligence package containing the orchestrator logic, tool registry, and model rotation protocols.

## Limitations

- **Read-Only Access**: The system is strictly forbidden from performing write or delete operations on bridged data sources.
- **Database Support**: Performance and introspection features are currently optimized for MongoDB and Google Sheets. Other drivers are not yet supported.
- **Context Window**: Long-form conversations are subject to a sliding window of the 10 most recent messages to manage LLM token usage effectively.

## Future Improvements

- **Token Streaming**: Integration of Server-Sent Events (SSE) for real-time token rendering in the UI.
- **Multi-Source Joins**: Ability for the AI to synthesize data from MongoDB and Google Sheets into a single cohesive report.
- **Semantic Search & RAG**: Integration with vector databases to allow natural language search across unstructured documents (PDFs, Notion) alongside structured data.
- **Enhanced Data Visualization**: Specialized components for rendering interactive charts and graphs directly within the thread.
- **Automated Intelligence**: Scheduled query execution with AI-synthesized summaries delivered via Slack, Teams, or Email.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions and audit logging for shared database bridges.
- **Edge Intelligence**: Optimized local-first processing for reduced latency and improved privacy on sensitive on-premise datasets.

---
Developed by **Abhigyan Raj and Team** | 2026 Unified Brain Project
