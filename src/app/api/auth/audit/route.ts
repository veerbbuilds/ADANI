import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🛡️ Rate limit: 10 requests per minute per IP (CWE-770)
    if (RateLimiter.isRateLimited(request, 10, 60000, "audit")) {
      return NextResponse.json(
        { error: "Too many audit requests. Please slow down." },
        { status: 429 }
      );
    }

    // 🔒 Authentication check — only verified users can write audit entries (CWE-862)
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Verify token is valid (don't need role check — all authenticated users can log)
    try {
      await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    const body = await request.json();
    const { eventType, email, timestamp, metadata, gps } = body;

    if (!eventType) {
      return NextResponse.json({ error: "Missing eventType." }, { status: 400 });
    }

    // Extract connection metadata (IP is strictly collected ONLY at login time for privacy compliance)
    const isLogin = eventType === "LOGIN" || eventType === "LOGIN_FAILED";
    const ip = isLogin 
      ? (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1")
      : "RESTRICTED";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Format GPS values safely
    const latitude = gps?.latitude !== undefined ? gps.latitude : null;
    const longitude = gps?.longitude !== undefined ? gps.longitude : null;
    const mapsLink = (latitude !== null && longitude !== null)
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`
      : null;

    // Document payload
    const logDoc = {
      eventType,
      email: email || "anonymous",
      timestamp: timestamp || new Date().toISOString(),
      metadata: metadata || {},
      ip,
      userAgent,
      gps: {
        latitude,
        longitude,
        mapsLink,
      },
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore central logs
    await adminDb.collection("audit_logs").add(logDoc);

    return NextResponse.json({ message: "Audit event recorded successfully." }, { status: 200 });
  } catch (error) {
    console.error("Failed to record audit log entry:", error);
    return NextResponse.json(
      { error: "Internal server logging failure." },
      { status: 500 }
    );
  }
}
