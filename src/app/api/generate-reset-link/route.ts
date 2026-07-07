import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (3 requests per minute per IP)
    if (RateLimiter.isRateLimited(request, 3, 60000, "password-reset")) {
      return NextResponse.json(
        { error: "Too many password reset requests. Please try again in 1 minute." },
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
      console.warn(`Unauthorized password reset generation attempt by user: ${decoded.email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "User email is required to generate a reset link." },
        { status: 400 }
      );
    }

    // Generate reset link using Admin Auth SDK
    const resetLink = await adminAuth.generatePasswordResetLink(email);

    return NextResponse.json({ resetLink }, { status: 200 });
  } catch (error: any) {
    console.error("Failed to generate password reset link:", error);

    if (error.code === "auth/user-not-found") {
      return NextResponse.json(
        { error: "No user account was found with this email address." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "An internal server error occurred while generating the password reset link." },
      { status: 500 }
    );
  }
}
