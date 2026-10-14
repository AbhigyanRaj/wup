/*
 * DTO types for the app, re-exported from @wup/contracts (types only, so no
 * zod lands in the client bundle). Import app types from here:
 *   import type { MessageDTO, ChatSummary } from "@/lib/types";
 *
 * Note: the contracts' error body type `ApiError` is re-exported as
 * `ApiErrorBody`, because `ApiError` in `@/lib/api` is the thrown class.
 */
export type {
  // common
  Id,
  ISODate,
  Page,
  ErrorCode,
  ErrorDetail,
  ApiError as ApiErrorBody,
  // auth + user
  AuthResponse,
  DemoResponse,
  SignupBody,
  LoginBody,
  ChangePasswordBody,
  LlmProvider,
  PlanTier,
  ResponseStyle,
  UserPreferences,
  UserPlan,
  UserOnboarding,
  UserDTO,
  UpdateProfileBody,
  UpdatePreferencesBody,
  SetApiKeyBody,
  SetApiKeyBodyInput,
  DeleteAccountBody,
  UsageDay,
  UsageResponse,
  ModelOption,
  ModelsResponse,
  // meta
  Feature,
  MetaResponse,
  WaitlistFeature,
  WaitlistBody,
  HealthResponse,
  // chats
  ChatMode,
  TitleSource,
  ChatSummary,
  ChatPage,
  CreateChatBody,
  UpdateChatBody,
  ListChatsQuery,
  SendMessageBody,
  RegenerateBody,
  FeedbackRating,
  FeedbackBody,
  // messages
  MessageStatus,
  MessageRole,
  VisualType,
  ChartType,
  ChartData,
  TableCell,
  TableData,
  DiagramNodeType,
  DiagramNode,
  DiagramEdge,
  DiagramData,
  FollowUp,
  Clarification,
  QueryRecord,
  DocSource,
  WebSource,
  DataSource,
  Source,
  SourceKind,
  ResearchStepStatus,
  ResearchStep,
  LegacyRagSource,
  LegacyWebSource,
  MessageModel,
  MessageMetrics,
  MessageFeedback,
  MessageError,
  MessageDTO,
  // stream
  StatusCode,
  DonePayload,
  ToolState,
  StreamEvent,
  StreamEventType,
  StreamEventOf,
  MetaBlock,
  // connections
  BridgeType,
  BridgeStatus,
  ScopeEntry,
  RedactionMap,
  SheetTab,
  BridgeSummary,
  SchemaField,
  BridgeDetails,
  MongoTestResult,
  SheetsTestResult,
  TestConnectionResult,
  CreateConnectionResponse,
  TestConnectionBody,
  CreateConnectionBody,
  UpdateConnectionBody,
  // knowledge
  KnowledgeType,
  KnowledgeStatus,
  KnowledgeSourceDTO,
  UploadResponse,
  KnowledgeConfig,
} from "@wup/contracts";

// ─── App-only types ─────────────────────────────────────────────────────────

/** Dialogs the shell can open through `useAppUI().openDialog`. */
export type AppDialog = "connect" | "upload" | "welcome";

/** Auth status exposed by `useAuth()`. */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
