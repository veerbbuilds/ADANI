import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";
import { sanitize } from "@/lib/sanitizer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (5 requests per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 5, 60000, "profile-update")) {
      return NextResponse.json(
        { error: "Too many profile update requests. Please try again in 1 minute." },
        { status: 429 }
      );
    }

    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("session_token");

    if (!tokenCookie) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    // Verify session
    const decodedToken = await adminAuth.verifyIdToken(tokenCookie.value);
    const uid = decodedToken.uid;

    const body = await request.json();
    const { displayName, phoneNumber } = body;

    // Centralized sanitization (CWE-79)
    const cleanName = sanitize(displayName || "", 100);
    const cleanPhone = (phoneNumber || "").replace(/[^0-9+\-\s()]/g, "").trim().substring(0, 25);

    // Save profile details to central Firestore users collection
    await adminDb.collection("users").doc(uid).set({
      displayName: cleanName,
      phoneNumber: cleanPhone,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({
      message: "Profile details updated successfully.",
      profile: { displayName: cleanName, phoneNumber: cleanPhone }
    }, { status: 200 });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "An internal server error occurred while updating profile metadata." },
      { status: 500 }
    );
  }
}
