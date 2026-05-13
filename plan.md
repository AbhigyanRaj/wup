# WUP Documentation Plan

This document outlines the plan for creating the comprehensive documentation for the WUP platform in LaTeX. The documentation aims to be the single source of truth for understanding WUP in depth.

## Document Structure

### 1. Introduction
- Vision and Purpose of WUP.
- Core Features and Target Audience.

### 2. System Architecture Overview
- Monorepo structure (Apps & Packages).
- Component Breakdown:
    - **Frontend**: Next.js 15, Framer Motion, Tailwind CSS.
    - **API Service**: Express, Node.js, MongoDB.
    - **Brain Package**: Intelligence orchestration, tool registry.
    - **Ingestor**: RAG pipeline, PDF processing.
- System Workflow and Data Flow (Mermaid description).

### 3. Core Capabilities (Deep Dive)
- **Intelligent Model Rotation**: Handling rate limits (429s) and rotating between Gemini models.
- **Live Data Bridges**: Introspection and querying of MongoDB and Google Sheets.
- **Knowledge Base (RAG)**: Chunking, embedding, and citation mechanism.

### 4. Technical Implementation Details
- **Brain Orchestrator**: The query pipeline (RAG -> Context Building -> Gemini -> Tool Execution).
- **System Prompt & Meta Protocol**: How the brain handles clarification, answers, and structured metadata (follow-ups, Mermaid diagrams).
- Read-only policy and security considerations.

### 5. Metrics & Roadmap
- Evaluation framework (Latency, Accuracy, Reliability, Groundedness).
- Future directions (SSE, Advanced Visualization, Multi-Source Synthesis).

---

## Phase-Wise Writing Plan (Chunks of ~200 lines)

To keep file sizes manageable and allow for iterative review, the document will be generated in the following phases:

- **Phase 1 (Chunk 1)**: Setup, Title, Abstract, Introduction, and High-Level Architecture.
- **Phase 2 (Chunk 2)**: Deep dive into the Brain Package (Orchestrator, Model Rotation, and the custom prompt/meta protocol).
- **Phase 3 (Chunk 3)**: Deep dive into the Ingestor (RAG pipeline) and Data Bridges.
- **Phase 4 (Chunk 4)**: Evaluation Metrics, Roadmap, and Conclusion.

---

## Open Questions / Decisions
- **LaTeX Template**: Defaulting to standard `article` class unless a specific template is provided.
- **Tone**: Formal technical report style.
