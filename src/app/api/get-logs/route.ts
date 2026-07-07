import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { checkPermission } from "@/lib/authHelper";
import { RateLimiter } from "@/lib/rateLimiter";
import { ApiCache } from "@/lib/apiCache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 🛡️ Apply rate limiting (30 requests per minute per IP)
    if (RateLimiter.isRateLimited(request, 30, 60000, "get-logs")) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    // 🔒 Strictly authorize: Allow if user has access_dashboard OR access_log_entry
    let auth = await checkPermission("access_dashboard");
    if (!auth.authorized) {
      auth = await checkPermission("access_log_entry");
      if (!auth.authorized) {
        return NextResponse.json({ error: "Access denied. Insufficient permissions." }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    // Query Firestore using cache wrapper (updates cached results for 30s)
    const logs = await ApiCache.getLogs(async () => {
      const snapshot = await adminDb
        .collection("yard_logs")
        .orderBy("timestamp", "desc")
        .limit(500)
        .get();

      const items: any[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        let formattedTimestamp = null;
        
        if (data.timestamp) {
          if (typeof data.timestamp.toDate === "function") {
            formattedTimestamp = data.timestamp.toDate().toISOString();
          } else {
            formattedTimestamp = data.timestamp;
          }
        }

        items.push({
          ...data,
          timestamp: formattedTimestamp,
        });
      });

      return items;
    });

    // 🔒 Enforce least-privilege: Non-admin/developer accounts can ONLY query logs they submitted themselves
    let userLogs = [...logs] as any[];
    if (auth.role !== "superadmin" && auth.role !== "admin" && auth.email) {
      const emailLower = auth.email.toLowerCase();
      userLogs = userLogs.filter(
        (log) =>
          (log.surveyor_email || "").toLowerCase() === emailLower ||
          (log.surveyor_name || "").toLowerCase().includes(emailLower)
      );
    }

    // Server-side search filter
    if (search) {
      const filtered = userLogs.filter(
        (log) =>
          log.truck_no?.toLowerCase().includes(search) ||
          log.vessel_name?.toLowerCase().includes(search) ||
          log.gp_no?.toLowerCase().includes(search)
      );
      return NextResponse.json(filtered, { status: 200 });
    }

    return NextResponse.json(userLogs, { status: 200 });
  } catch (error) {
    console.error("Error fetching yard logs:", error);
    return NextResponse.json(
      { error: "An internal server error occurred while retrieving log entries." },
      { status: 500 }
    );
  }
}
