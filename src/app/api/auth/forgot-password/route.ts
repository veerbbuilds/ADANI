import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";
import { EmailService } from "@/lib/emailService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🛡️ Wrap sensitive actions with RateLimiter to prevent spam (3 requests per minute per IP)
    if (RateLimiter.isRateLimited(request, 3, 60000, "forgot-password-api")) {
      return NextResponse.json(
        { error: "Too many password reset requests. Please wait a minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email address is required." }, { status: 400 });
    }

    // 1. Generate secure password reset action link using Admin Auth SDK
    const firebaseResetLink = await adminAuth.generatePasswordResetLink(email);

    // Parse action code parameters to direct the user back to our Next.js UI
    const urlObj = new URL(firebaseResetLink);
    const oobCode = urlObj.searchParams.get("oobCode");
    const apiKey = urlObj.searchParams.get("apiKey");

    const appOrigin = new URL(request.url).origin;
    const resetLink = `${appOrigin}/reset-password?oobCode=${oobCode}&apiKey=${apiKey}`;

    // 2. Deliver the mail programmatically using our tracking EmailService
    const success = await EmailService.sendPasswordResetEmail(email, resetLink, appOrigin);

    if (!success) {
      return NextResponse.json(
        { error: "Mail server configuration issue. Please contact administrator." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Password reset instructions sent." }, { status: 200 });
  } catch (error: any) {
    console.error("Forgot password programmatic flow failed:", error);
    
    // 🔒 HARDENED: Anti-enumeration (CWE-204) — always return same generic response
    // regardless of whether the email exists or not
    if (error.code === "auth/user-not-found") {
      return NextResponse.json(
        { message: "If the email is registered, a password reset link has been sent." },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "An internal server error occurred while sending the email." },
      { status: 500 }
    );
  }
}
