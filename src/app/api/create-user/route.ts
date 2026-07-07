import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

// 🔒 Password complexity validation: min 8 characters, at least 1 uppercase, 1 lowercase, 1 digit (CWE-521)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (3 requests per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 3, 60000, "create-user")) {
      return NextResponse.json(
        { error: "Too many account creation attempts. Please try again in 1 minute." },
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
      console.warn(`Unauthorized account creation attempt by user: ${decoded.email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, role } = body;

    // Input Validation (CWE-20)
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Email, password, and role are required." },
        { status: 400 }
      );
    }

    if (role !== "surveyor" && role !== "admin" && role !== "superadmin") {
      return NextResponse.json(
        { error: "Invalid role specified." },
        { status: 400 }
      );
    }

    // Enforce strong password policy (CWE-521)
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number." },
        { status: 400 }
      );
    }

    // Create user in Firebase Auth using the Admin SDK
    const userRecord = await adminAuth.createUser({
      email,
      password,
      emailVerified: true,
    });

    // Set custom user claims for role-based authorization (surveyor or admin)
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    return NextResponse.json(
      {
        message: `Successfully created user account for ${email} with role '${role}'.`,
        uid: userRecord.uid,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Failed to create new user account:", error);
    
    // Check if user already exists
    if (error.code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "An internal server error occurred while creating the user account." },
      { status: 500 }
    );
  }
}
