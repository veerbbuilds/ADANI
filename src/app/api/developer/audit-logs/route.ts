import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 🛡️ Apply rate limiting (10 attempts per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 10, 60000, "developer-audit-logs")) {
      return NextResponse.json(
        { error: "Too many audit log requests. Please wait a minute." },
        { status: 429 }
      );
    }

    // 🔒 Strictly authorize using session cookie (removes manual developer key input)
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.role !== "superadmin") {
      console.warn(`Unauthorized audit-logs read attempt by user: ${decoded.email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    // Query audit logs ordered by timestamp descending
    const snap = await adminDb.collection("audit_logs").orderBy("timestamp", "desc").limit(100).get();
    const logs = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      };
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to query audit logs:", error);
    return NextResponse.json(
      { error: "Internal database query failure." },
      { status: 500 } // 🔒 HARDENED: Replaced status: 550 with standard HTTP 500 (CWE-209)
    );
  }
}
