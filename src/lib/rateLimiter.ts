interface RateRecord {
  timestamps: number[];
}

export class RateLimiter {
  private static tracker = new Map<string, RateRecord>();
  private static lastCleanup = Date.now();
  private static limitListener: ((ip: string, category: string, count: number, origin: string) => void) | null = null;

  /**
   * Registers a listener callback to decouple email alerts and prevent circular module dependencies.
   */
  public static setLimitListener(listener: (ip: string, category: string, count: number, origin: string) => void) {
    this.limitListener = listener;
  }

  /**
   * Evaluates if a given IP exceeds rate limit bounds.
   * Runs cleanups dynamically.
   */
  public static isRateLimited(
    request: Request,
    limit: number,
    windowMs: number,
    category: string = "default"
  ): boolean {
    // Resolve client IP securely
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const trackerKey = `${category}:${ip}`;
    const now = Date.now();

    // Trigger cleanup every 5 minutes
    if (now - this.lastCleanup > 300000) {
      this.runCleanup();
    }

    let record = this.tracker.get(trackerKey);
    if (!record) {
      record = { timestamps: [] };
      this.tracker.set(trackerKey, record);
    }

    // Filter out timestamps outside the active window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= limit) {
      // 🔒 HARDENED: Mask IP for GDPR compliance — only show last octet (CWE-532)
      const maskedIp = ip.includes(".") ? `*.*.*${ip.substring(ip.lastIndexOf("."))}` : "*.masked";
      console.warn(`[RATE_LIMIT_TRIGGERED] IP: ${maskedIp} | Category: ${category} | Limit: ${limit} req/${windowMs / 1000}s`);

      // Resolve the application request origin dynamically
      let appOrigin = "http://localhost:3000";
      try {
        appOrigin = new URL(request.url).origin;
      } catch (e) {
        // Fallback
      }

      // Decoupled notification execution (prevents circular ES imports)
      const isSecuritySensitive = category === "login" || category === "forgot-password-api" || category === "create-user" || category === "password-reset";
      if (isSecuritySensitive && this.limitListener) {
        try {
          this.limitListener(maskedIp, category, record.timestamps.length, appOrigin);
        } catch (err) {
          console.error("Rate limit listener execution failed:", err);
        }
      }

      return true;
    }

    record.timestamps.push(now);
    return false;
  }

  private static runCleanup() {
    const now = Date.now();
    for (const [key, record] of this.tracker.entries()) {
      // Wipes records that haven't sent any requests within 10 minutes
      const activeTimestamps = record.timestamps.filter((ts) => now - ts < 600000);
      if (activeTimestamps.length === 0) {
        this.tracker.delete(key);
      } else {
        record.timestamps = activeTimestamps;
      }
    }
    this.lastCleanup = now;
  }
}
