/**
 * Client-side Telemetry and Geolocation Auditing Helper
 */

interface KeypressTelemetry {
  inputName: string;
  keyCount: number;
  timeSpentMs: number;
}

export class TelemetryEngine {
  private static keypressCounts: Record<string, number> = {};
  private static focusStartTimes: Record<string, number> = {};
  private static accumulatedTimes: Record<string, number> = {};

  /**
   * Safe wrapper to fetch geolocation coordinates
   */
  public static async getCoordinates(): Promise<{ latitude: number | null; longitude: number | null }> {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return { latitude: null, longitude: null };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Geolocation access denied or unavailable:", error.message);
          resolve({ latitude: null, longitude: null });
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    });
  }

  /**
   * Start tracking input field focus
   */
  public static startFocus(inputName: string) {
    this.focusStartTimes[inputName] = Date.now();
  }

  /**
   * Stop tracking input focus and accumulate time
   */
  public static endFocus(inputName: string) {
    const startTime = this.focusStartTimes[inputName];
    if (startTime) {
      const elapsed = Date.now() - startTime;
      this.accumulatedTimes[inputName] = (this.accumulatedTimes[inputName] || 0) + elapsed;
      delete this.focusStartTimes[inputName];
    }
  }

  /**
   * Increment keystroke count for an input
   */
  public static recordKeypress(inputName: string) {
    this.keypressCounts[inputName] = (this.keypressCounts[inputName] || 0) + 1;
  }

  /**
   * Compile and reset the telemetry data
   */
  public static compileTelemetry(): KeypressTelemetry[] {
    // End any active focuses to compile complete times
    Object.keys(this.focusStartTimes).forEach((key) => this.endFocus(key));

    const result: KeypressTelemetry[] = Object.keys(this.keypressCounts).map((inputName) => ({
      inputName,
      keyCount: this.keypressCounts[inputName] || 0,
      timeSpentMs: this.accumulatedTimes[inputName] || 0,
    }));

    // Reset counters
    this.keypressCounts = {};
    this.focusStartTimes = {};
    this.accumulatedTimes = {};

    return result;
  }

  /**
   * Queue telemetry or audit event. If offline, buffers in localStorage.
   */
  public static async dispatchEvent(event: {
    eventType: string;
    email: string;
    metadata?: Record<string, any>;
  }) {
    const coordinates = event.eventType === "USER_CLICK"
      ? { latitude: null, longitude: null }
      : await this.getCoordinates();
    const payload = {
      ...event,
      timestamp: new Date().toISOString(),
      gps: coordinates,
    };

    if (typeof window !== "undefined" && !navigator.onLine) {
      // Buffer event in local cache queue when offline
      try {
        const queueRaw = localStorage.getItem("offline_telemetry_queue");
        const queue = queueRaw ? JSON.parse(queueRaw) : [];
        queue.push(payload);
        localStorage.setItem("offline_telemetry_queue", JSON.stringify(queue));
      } catch (err) {
        console.error("Failed to buffer offline telemetry:", err);
      }
      return;
    }

    // Direct push to audit endpoint when online
    try {
      await fetch("/api/auth/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("Failed to push telemetry log. Buffering locally...", err);
      try {
        const queueRaw = localStorage.getItem("offline_telemetry_queue");
        const queue = queueRaw ? JSON.parse(queueRaw) : [];
        queue.push(payload);
        localStorage.setItem("offline_telemetry_queue", JSON.stringify(queue));
      } catch (e) {
        console.warn("Failed to cache telemetry event in localStorage:", e);
      }
    }
  }

  /**
   * Syncs buffered telemetry events when online
   */
  public static async syncTelemetryQueue() {
    if (typeof window === "undefined" || !navigator.onLine) return;

    try {
      const queueRaw = localStorage.getItem("offline_telemetry_queue");
      if (!queueRaw) return;

      const queue = JSON.parse(queueRaw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      // 🔒 HARDENED: Cap queue size to prevent localStorage exhaustion (CWE-400)
      const MAX_TELEMETRY_QUEUE = 100;
      const trimmedQueue = queue.slice(0, MAX_TELEMETRY_QUEUE);

      // 🔒 FIX: Track success count and splice after loop (prevents shift() desync)
      let successCount = 0;
      for (const payload of trimmedQueue) {
        try {
          const res = await fetch("/api/auth/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            successCount++;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      // Remove all successfully synced entries at once from the original queue
      queue.splice(0, successCount);
      localStorage.setItem("offline_telemetry_queue", JSON.stringify(queue));
    } catch (err) {
      console.error("Telemetry sync failed:", err);
    }
  }
}
