import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 🛡️ Rate limit: 30 requests per minute per IP (CWE-770)
    if (RateLimiter.isRateLimited(request, 30, 60000, "session")) {
      return NextResponse.json({ authenticated: false, error: "Rate limited." }, { status: 429 });
    }

    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token");

    if (!tokenCookie) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    // 🔒 HARDENED: Derive ALL values from verified token only (CWE-565)
    // Never trust session_role/session_email cookies — they are only for middleware edge checks
    const decodedToken = await adminAuth.verifyIdToken(tokenCookie.value);

    // Retrieve actual display name from central Firestore database
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const displayName = userData?.displayName || decodedToken.name || "";

    return NextResponse.json({
      authenticated: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email || "",
        role: decodedToken.role || "surveyor",
        displayName: displayName,
      },
    });
  } catch (error) {
    // Token expired or invalid — return unauthenticated (don't leak error details)
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
