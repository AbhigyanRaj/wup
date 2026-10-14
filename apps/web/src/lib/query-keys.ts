/*
 * TanStack Query key factory. Every app query uses these keys so that
 * invalidation is predictable:
 *   queryClient.invalidateQueries({ queryKey: qk.chats.all })
 *
 * Data shapes stored under each key:
 * - qk.me                 UserDTO
 * - qk.usage              UsageResponse
 * - qk.models             ModelsResponse
 * - qk.meta               MetaResponse
 * - qk.chats.list         InfiniteData<Page<ChatSummary>, string | null>  (sidebar)
 * - qk.chats.search(q)    Page<ChatSummary>  (with `match` snippets)
 * - qk.chats.detail(id)   ChatSummary
 * - qk.messages(id)       owned by APP-2 (useMessages)
 * - qk.bridges.*, qk.knowledge.*, qk.prefs: owned by APP-4
 */
export const qk = {
  me: ["auth", "me"] as const,
  usage: ["user", "usage"] as const,
  models: ["user", "models"] as const,
  meta: ["meta"] as const,
  prefs: ["user", "prefs"] as const,
  keys: ["user", "keys"] as const,
  chats: {
    all: ["chats"] as const,
    list: ["chats", "list"] as const,
    search: (q: string) => ["chats", "search", q] as const,
    detail: (id: string) => ["chats", "detail", id] as const,
  },
  messages: (chatId: string) => ["messages", chatId] as const,
  bridges: {
    all: ["bridges"] as const,
    list: ["bridges", "list"] as const,
    detail: (id: string) => ["bridges", "detail", id] as const,
  },
  knowledge: {
    all: ["knowledge"] as const,
    list: ["knowledge", "list"] as const,
    config: ["knowledge", "config"] as const,
    detail: (id: string) => ["knowledge", "detail", id] as const,
  },
} as const;
