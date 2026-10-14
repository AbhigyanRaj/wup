import { User } from "@wup/models";
import { deleteUserCascade } from "../services/deleteUser";

type Logger = {
  info?: (...args: any[]) => void;
  warn?: (...args: any[]) => void;
  error?: (...args: any[]) => void;
};

export const USER_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
/** A deletion that started this long ago without finishing is assumed interrupted. */
export const STALE_DELETION_MS = 10 * 60 * 1000;
const BATCH = 200;

export interface UserSweepResult {
  demosPurged: number;
  deletionsResumed: number;
  failures: number;
}

/**
 * One sweep:
 *   - purges demo users whose demoExpiresAt has passed (full cascade);
 *   - resumes account deletions whose deletingAt is older than 10 minutes.
 */
export async function runUserSweepOnce(log: Logger = console, now: Date = new Date()): Promise<UserSweepResult> {
  const result: UserSweepResult = { demosPurged: 0, deletionsResumed: 0, failures: 0 };

  const expired: any[] = await User.find({ isDemo: true, demoExpiresAt: { $lt: now } })
    .select({ _id: 1 })
    .limit(BATCH)
    .lean();
  for (const u of expired) {
    try {
      await deleteUserCascade(u._id);
      result.demosPurged++;
    } catch (err: any) {
      result.failures++;
      log.error?.(`[sweeper] demo purge failed for ${String(u._id)}: ${err?.message ?? err}`);
    }
  }

  const stale: any[] = await User.find({ deletingAt: { $lt: new Date(now.getTime() - STALE_DELETION_MS) } })
    .select({ _id: 1 })
    .limit(BATCH)
    .lean();
  for (const u of stale) {
    try {
      await deleteUserCascade(u._id);
      result.deletionsResumed++;
    } catch (err: any) {
      result.failures++;
      log.error?.(`[sweeper] resumed deletion failed for ${String(u._id)}: ${err?.message ?? err}`);
    }
  }

  if (result.demosPurged || result.deletionsResumed || result.failures) {
    log.info?.(
      `[sweeper] users: ${result.demosPurged} demo(s) purged, ${result.deletionsResumed} deletion(s) resumed, ${result.failures} failure(s)`
    );
  }
  return result;
}

/**
 * Starts the user sweepers on a 15 minute interval (unref'd, so they never
 * keep the process alive). Overlapping runs are skipped. Returns a stop function.
 */
export function startUserSweepers(log: Logger = console): () => void {
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await runUserSweepOnce(log);
    } catch (err: any) {
      log.error?.(`[sweeper] user sweep failed: ${err?.message ?? err}`);
    } finally {
      running = false;
    }
  };

  const first = setTimeout(tick, 60 * 1000);
  first.unref();
  const timer = setInterval(tick, USER_SWEEP_INTERVAL_MS);
  timer.unref();

  return () => {
    stopped = true;
    clearTimeout(first);
    clearInterval(timer);
  };
}
