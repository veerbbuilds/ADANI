import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (10 attempts per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 10, 60000, "notification-read")) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email;

    if (!email) {
      return NextResponse.json({ error: "Missing email address in claims." }, { status: 400 });
    }

    // Add email to the readBy list of the active notification document
    await adminDb.collection("settings").doc("notification").update({
      readBy: FieldValue.arrayUnion(email),
    });

    return NextResponse.json({ message: "Notification marked as read successfully." }, { status: 200 });
  } catch (error) {
    console.error("Failed to mark notification read:", error);
    return NextResponse.json({ error: "Internal database error." }, { status: 500 });
  }
}
