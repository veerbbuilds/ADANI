/**
 * Server-side API Cache Manager — reduces Firestore read operations
 * Supports logs cache (60s TTL) and permissions cache (5min TTL)
 */

export class ApiCache {
  // --- Logs Cache ---
  private static cachedLogs: Record<string, unknown>[] | null = null;
  private static lastLogsFetched: number = 0;
  private static LOGS_TTL_MS = 60000; // 60 seconds cache (increased from 30s)

  // --- Permissions Cache ---
  private static cachedPermissions: Record<string, unknown> | null = null;
  private static lastPermsFetched: number = 0;
  private static PERMS_TTL_MS = 300000; // 5 minutes cache

  /**
   * Returns cached logs if valid, otherwise executes callback to refresh cache
   */
  public static async getLogs(fetchCallback: () => Promise<Record<string, unknown>[]>): Promise<Record<string, unknown>[]> {
    const now = Date.now();
    if (this.cachedLogs && now - this.lastLogsFetched < this.LOGS_TTL_MS) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[CACHE_HIT] Returning ${this.cachedLogs.length} logs from memory.`);
      }
      return this.cachedLogs;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[CACHE_MISS] Querying Firestore database...");
    }
    const freshLogs = await fetchCallback();
    this.cachedLogs = freshLogs;
    this.lastLogsFetched = now;
    return freshLogs;
  }

  /**
   * Returns cached permissions if valid, otherwise fetches from Firestore
   */
  public static async getPermissions(fetchCallback: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
    const now = Date.now();
    if (this.cachedPermissions && now - this.lastPermsFetched < this.PERMS_TTL_MS) {
      return this.cachedPermissions;
    }

    const freshPerms = await fetchCallback();
    this.cachedPermissions = freshPerms;
    this.lastPermsFetched = now;
    return freshPerms;
  }

  /**
   * Invalidates active logs cache (run during new log placement or deletions)
   */
  public static invalidate() {
    if (process.env.NODE_ENV !== "production") {
      console.log("[CACHE_INVALIDATED] Cleared log cache from memory.");
    }
    this.cachedLogs = null;
    this.lastLogsFetched = 0;
  }

  /**
   * Invalidates permissions cache (run when permissions matrix is updated)
   */
  public static invalidatePermissions() {
    this.cachedPermissions = null;
    this.lastPermsFetched = 0;
  }
}
