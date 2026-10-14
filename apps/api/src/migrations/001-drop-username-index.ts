/**
 * Migration 001-drop-username-index
 *
 * Early versions of the User model had a unique `username` field. Its index
 * (`username_1`) makes every signup without a username collide on null.
 * Drop it when present. Idempotent.
 */
import type { MigrationContext } from "./index";

export const id = "001-drop-username-index";

export async function up(ctx: MigrationContext): Promise<void> {
  const users = ctx.db.collection("users");
  let indexes: Array<{ name?: string }> = [];
  try {
    indexes = await users.indexes();
  } catch (err: any) {
    // NamespaceNotFound: no users collection yet, nothing to drop
    if (err?.codeName === "NamespaceNotFound" || err?.code === 26) return;
    throw err;
  }
  if (indexes.some((idx) => idx.name === "username_1")) {
    await users.dropIndex("username_1");
    ctx.log.info({ migration: id }, "dropped stale users.username_1 index");
  }
}

export default { id, up };
