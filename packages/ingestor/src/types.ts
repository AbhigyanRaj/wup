/** File types the ingestor can index (mirrors KnowledgeType in @wup/contracts). */
export type KnowledgeFileType = "pdf" | "txt" | "md" | "csv" | "docx";

export const KNOWLEDGE_FILE_TYPES: readonly KnowledgeFileType[] = ["pdf", "txt", "md", "csv", "docx"];
