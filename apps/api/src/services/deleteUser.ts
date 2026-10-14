import * as brain from "@wup/brain";
import {
  Chat,
  Connection,
  KnowledgeChunk,
  KnowledgeSource,
  KnowledgeSourceText,
  Message,
  UsageDaily,
  User,
} from "@wup/models";

export interface DeleteUserResult {
  userId: string;
  /** False when the user document was already gone (a resumed or repeated call). */
  userDeleted: boolean;
  deleted: Record<string, number>;
}

/**
 * Deletes a user and everything they own.
 *
 * 1. Marks the user with deletingAt (kept if already set) so authenticate can
 *    refuse the account and the sweeper can resume an interrupted run.
 * 2. Drops pooled MongoDB clients for the user's own (non-system) bridges.
 * 3. Deletes dependent rows by userId, children before parents.
 * 4. Deletes the user document last.
 *
 * Every step is a delete-by-owner, so the cascade is idempotent and can be
 * re-run from the start after a crash at any point.
 */
export async function deleteUserCascade(userId: unknown): Promise<DeleteUserResult> {
  const id = String(userId);
  await User.updateOne({ _id: id, deletingAt: { $exists: false } }, { $set: { deletingAt: new Date() } });

  const release = (brain as any).releasePooledClient;
  if (typeof release === "function") {
    const bridges: any[] = await Connection.find({ userId: id }).select({ _id: 1, isSystem: 1 }).lean();
    for (const b of bridges) {
      if (b.isSystem) continue;
      try {
        release(String(b._id));
      } catch {
        // Closing a pooled client is best effort.
      }
    }
  }

  const steps: Array<[string, () => Promise<{ deletedCount?: number }>]> = [
    ["messages", () => Message.deleteMany({ userId: id })],
    ["chats", () => Chat.deleteMany({ userId: id })],
    ["connections", () => Connection.deleteMany({ userId: id })],
    ["knowledgeChunks", () => KnowledgeChunk.deleteMany({ userId: id })],
    ["knowledgeSourceTexts", () => KnowledgeSourceText.deleteMany({ userId: id })],
    ["knowledgeSources", () => KnowledgeSource.deleteMany({ userId: id })],
    ["usageDaily", () => UsageDaily.deleteMany({ userId: id })],
  ];

  const deleted: Record<string, number> = {};
  for (const [name, run] of steps) {
    const r = await run();
    deleted[name] = r.deletedCount ?? 0;
  }

  const u = await User.deleteOne({ _id: id });
  return { userId: id, userDeleted: (u.deletedCount ?? 0) > 0, deleted };
}
