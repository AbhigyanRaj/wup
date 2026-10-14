import { z } from "zod";
import { ISODateSchema, IdSchema, LIMITS, ObjectIdSchema, pageSchema } from "./common";

export const ChatModeSchema = z.enum(["chat", "research"]);
export type ChatMode = z.infer<typeof ChatModeSchema>;

/** "auto" titles may be replaced by the server; "user" titles never are. */
export const TitleSourceSchema = z.enum(["auto", "user"]);
export type TitleSource = z.infer<typeof TitleSourceSchema>;

export const ChatSummarySchema = z.object({
  id: IdSchema,
  /** @deprecated alias of id, kept for older clients */
  _id: IdSchema,
  title: z.string(),
  titleSource: TitleSourceSchema,
  pinned: z.boolean(),
  bridgeIds: z.array(IdSchema),
  messageCount: z.number(),
  lastMessageAt: ISODateSchema,
  createdAt: ISODateSchema,
  /** Present on search results (ListChatsQuery.q). */
  match: z
    .object({
      messageId: IdSchema.nullable(),
      snippet: z.string(),
    })
    .optional(),
});
export type ChatSummary = z.infer<typeof ChatSummarySchema>;

export const ChatPageSchema = pageSchema(ChatSummarySchema);
export type ChatPage = z.infer<typeof ChatPageSchema>;

// ─── Request bodies ───────────────────────────────────────────────────────────

const ChatTitleSchema = z.string().trim().min(1).max(LIMITS.maxChatTitle);
const BridgeIdsSchema = z.array(ObjectIdSchema).max(LIMITS.maxBridgesPerChat);

export const CreateChatBodySchema = z.object({
  title: ChatTitleSchema.optional(),
  bridgeIds: BridgeIdsSchema.optional(),
});
export type CreateChatBody = z.infer<typeof CreateChatBodySchema>;

export const UpdateChatBodySchema = z.object({
  title: ChatTitleSchema.optional(),
  pinned: z.boolean().optional(),
  bridgeIds: BridgeIdsSchema.optional(),
});
export type UpdateChatBody = z.infer<typeof UpdateChatBodySchema>;

/** Query string of GET /chats. Values arrive as strings, so limit is coerced. */
export const ListChatsQuerySchema = z.object({
  q: z.string().trim().max(LIMITS.maxChatSearch).optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.maxChatPageSize).optional(),
  cursor: z.string().max(200).optional(),
});
export type ListChatsQuery = z.infer<typeof ListChatsQuerySchema>;

const ModelIdSchema = z.string().trim().min(1).max(200);

export const SendMessageBodySchema = z.object({
  content: z
    .string()
    .min(1, "Message content cannot be empty")
    .max(LIMITS.maxPromptChars, `Messages are limited to ${LIMITS.maxPromptChars} characters`)
    .refine((v) => v.trim().length > 0, { message: "Message content cannot be empty" }),
  mode: ChatModeSchema.optional(),
  model: ModelIdSchema.optional(),
  searchWeb: z.boolean().optional(),
  /** Legacy clients send role: "user". Nothing else is accepted. */
  role: z.literal("user").optional(),
});
export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;

export const RegenerateBodySchema = z.object({
  mode: ChatModeSchema.optional(),
  model: ModelIdSchema.optional(),
  searchWeb: z.boolean().optional(),
});
export type RegenerateBody = z.infer<typeof RegenerateBodySchema>;

export const FeedbackRatingSchema = z.enum(["up", "down"]);
export type FeedbackRating = z.infer<typeof FeedbackRatingSchema>;

export const FeedbackBodySchema = z.object({
  /** null clears existing feedback. */
  rating: FeedbackRatingSchema.nullable(),
  note: z.string().trim().max(LIMITS.maxFeedbackNote).optional(),
});
export type FeedbackBody = z.infer<typeof FeedbackBodySchema>;

// ─── Diagram edits ────────────────────────────────────────────────────────────

/**
 * Which diagram of a message an edit belongs to: "visual" is the message's
 * diagramData, "m:<n>" the n-th (0 based) ```mermaid fence in its content.
 */
export const DIAGRAM_KEY_PATTERN = /^(visual|m:\d{1,3})$/;
export const DiagramKeySchema = z.string().regex(DIAGRAM_KEY_PATTERN, "Invalid diagram key");
export type DiagramKey = z.infer<typeof DiagramKeySchema>;

/** A saved Excalidraw scene is capped at this many bytes of JSON. */
export const MAX_DIAGRAM_SCENE_BYTES = 1_000_000;

/** Only these appState fields are stored; everything else is dropped. */
export const DiagramAppStateSchema = z.object({
  viewBackgroundColor: z.string().max(32).optional(),
  gridSize: z.number().int().min(0).max(100).nullable().optional(),
});
export type DiagramAppState = z.infer<typeof DiagramAppStateSchema>;

/** Excalidraw BinaryFileData (images only), keyed by file id. */
export const DiagramFileSchema = z.object({
  id: z.string().max(128),
  mimeType: z.string().regex(/^image\/[a-z0-9.+-]+$/i),
  dataURL: z.string().startsWith("data:image/"),
  created: z.number().optional(),
  lastRetrieved: z.number().optional(),
});
export type DiagramFile = z.infer<typeof DiagramFileSchema>;

export const SaveDiagramBodySchema = z.object({
  /** Excalidraw elements, stored as-is (opaque to the API). */
  elements: z.array(z.record(z.string(), z.unknown())).max(5000),
  appState: DiagramAppStateSchema.optional(),
  files: z.record(z.string().max(128), DiagramFileSchema).optional(),
});
export type SaveDiagramBody = z.infer<typeof SaveDiagramBodySchema>;

export const SaveDiagramResponseSchema = z.object({
  key: DiagramKeySchema,
  updatedAt: z.string(),
});
export type SaveDiagramResponse = z.infer<typeof SaveDiagramResponseSchema>;
