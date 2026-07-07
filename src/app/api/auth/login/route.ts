import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";
import { EmailService } from "@/lib/emailService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (5 attempts per minute per IP)
    if (RateLimiter.isRateLimited(request, 5, 60000, "login")) {
      return NextResponse.json(
        { error: "Too many login requests. Please try again in 1 minute." },
        { status: 429 }
      );
    }

    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: "Missing ID token." }, { status: 400 });
    }

    // Verify the Firebase Client ID Token using the Admin SDK
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    // Hardcode Master Dev Head role mapping for veer.b.builds@gmail.com
    let role = decodedToken.role || "surveyor"; // Default fallback role
    
    if (email === "veer.b.builds@gmail.com") {
      role = "superadmin";
      await adminAuth.setCustomUserClaims(uid, { role: "superadmin" });
    }

    // Capture perfect IP on login (OWASP Logging & Monitoring)
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Write login audit log entry with IP
    await adminDb.collection("audit_logs").add({
      eventType: "LOGIN",
      email: email || "unknown",
      timestamp: new Date().toISOString(),
      metadata: { role, method: "Firebase Auth" },
      ip,
      userAgent,
      createdAt: new Date().toISOString(),
    });

    // 🔒 Trigger security email alert for privileged accounts (CWE-359)
    if (email && (role === "superadmin" || role === "admin")) {
      const appOrigin = new URL(request.url).origin;
      // Fire-and-forget in background so it doesn't block fast login times
      EmailService.sendLoginAlert(email, role, ip, userAgent, appOrigin).catch(console.error);
    }

    // Set secure HTTP-only cookies
    const response = NextResponse.json(
      {
        message: "Session established successfully.",
        user: { uid, email, role },
      },
      { status: 200 }
    );

    // 🔒 HARDENED: Cookie maxAge reduced from 7 days to 1 hour to match Firebase ID token lifetime (CWE-384)
    // SameSite=Lax allows redirect from email reset links while blocking CSRF
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60, // 1 hour (matches Firebase ID token expiry)
      path: "/",
    };

    response.cookies.set("session_token", idToken, cookieOptions);

    // 🔒 HARDENED: Keep role/email cookies for middleware edge checks only
    // These are always re-verified against the token in session/route.ts (CWE-565)
    response.cookies.set("session_role", role, cookieOptions);
    response.cookies.set("session_email", email || "", cookieOptions);

    return response;
  } catch (error) {
    console.error("Authentication session initialization failed:", error);
    return NextResponse.json(
      { error: "Authentication failed. Invalid login session." },
      { status: 401 }
    );
  }
}
