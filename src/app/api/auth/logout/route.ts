import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // 🔒 Record LOGOUT audit trail before clearing cookies (CWE-778)
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        await adminDb.collection("audit_logs").add({
          eventType: "LOGOUT",
          email: decoded.email || "unknown",
          timestamp: new Date().toISOString(),
          metadata: { role: decoded.role || "surveyor" },
          ip: "RESTRICTED",
          createdAt: new Date().toISOString(),
        });
      } catch {
        // Token may already be expired — still proceed with logout
      }
    }
  } catch {
    // Non-critical — proceed with cookie clearing regardless
  }

  const response = NextResponse.json(
    { message: "Logged out successfully." },
    { status: 200 }
  );

  // Clear HTTP-only cookies by setting maxAge to 0 (expired)
  response.cookies.set("session_token", "", { path: "/", maxAge: 0 });
  response.cookies.set("session_role", "", { path: "/", maxAge: 0 });
  response.cookies.set("session_email", "", { path: "/", maxAge: 0 });

  return response;
}
