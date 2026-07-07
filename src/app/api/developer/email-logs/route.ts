import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 🛡️ Apply rate limiting (15 requests per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 15, 60000, "developer-email-logs")) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
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
    if (decoded.role !== "superadmin" && decoded.role !== "admin") {
      console.warn(`Unauthorized email-logs read attempt by user: ${decoded.email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    // Query email logs ordered by sentAt descending, limited to 100 entries
    const snap = await adminDb
      .collection("email_logs")
      .orderBy("sentAt", "desc")
      .limit(100)
      .get();

    const logs = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      };
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to query email logs:", error);
    return NextResponse.json(
      { error: "Internal database query failure." },
      { status: 500 }
    );
  }
}
