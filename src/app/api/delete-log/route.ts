import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { ApiCache } from "@/lib/apiCache";
import { RateLimiter } from "@/lib/rateLimiter";
import { EmailService } from "@/lib/emailService";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    // 🛡️ Apply rate limiting (5 attempts per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 5, 60000, "delete-log")) {
      return NextResponse.json(
        { error: "Too many deletion requests. Please try again in 1 minute." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const gp_no = (searchParams.get("gp_no") || "").trim().toUpperCase();

    if (!gp_no) {
      return NextResponse.json(
        { error: "GP No is required for deletion." },
        { status: 400 }
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
      console.warn(`Unauthorized deletion attempt of GP ${gp_no} by user: ${decoded.email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    const docRef = adminDb.collection("yard_logs").doc(gp_no);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: "Target log entry was not found in the database." },
        { status: 404 }
      );
    }

    // Delete document
    await docRef.delete();

    // 🔒 Trigger security email alert for critical deletion actions (CWE-359)
    const appOrigin = new URL(request.url).origin;
    EmailService.sendDeletionAlert(gp_no, decoded.email || "System Admin", "Manual audit clear", appOrigin).catch(console.error);

    // ⚡ Invalidate active log cache so the dashboard updates instantly
    ApiCache.invalidate();

    return NextResponse.json(
      { message: `Movement entry ${gp_no} permanently deleted from database.` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete log entry:", error);
    return NextResponse.json(
      { error: "An internal server error occurred while deleting the log entry." },
      { status: 500 }
    );
  }
}
