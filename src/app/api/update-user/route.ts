import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

// 🔒 Password complexity validation: min 8 characters, at least 1 uppercase, 1 lowercase, 1 digit (CWE-521)
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (5 requests per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 5, 60000, "update-user")) {
      return NextResponse.json(
        { error: "Too many profile updates. Please try again in 1 minute." },
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
    // Allow users to update their own password OR superadmin to update anyone
    const body = await request.json();
    const { email, password, role } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required to locate the user account." },
        { status: 400 }
      );
    }

    const isSelfUpdate = decoded.email === email;
    const isSuperAdmin = decoded.role === "superadmin";

    if (!isSelfUpdate && !isSuperAdmin) {
      console.warn(`Unauthorized password update attempt by user: ${decoded.email} on target: ${email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    // Retrieve the user from Firebase Auth to get the uid
    const userRecord = await adminAuth.getUserByEmail(email);
    const uid = userRecord.uid;

    const updateParams: any = {};
    if (password) {
      // Enforce strong password policy (CWE-521)
      if (!PASSWORD_REGEX.test(password)) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number." },
          { status: 400 }
        );
      }
      updateParams.password = password;
    }

    // Perform details update in Firebase Auth
    if (Object.keys(updateParams).length > 0) {
      await adminAuth.updateUser(uid, updateParams);
    }

    // Perform role updates if superadmin requested it
    if (role && isSuperAdmin) {
      if (role !== "surveyor" && role !== "admin" && role !== "superadmin") {
        return NextResponse.json(
          { error: "Invalid role specified." },
          { status: 400 }
        );
      }
      await adminAuth.setCustomUserClaims(uid, { role });
    }

    return NextResponse.json(
      { message: `Successfully updated user account details for ${email}.` },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Failed to update user details:", error);
    
    if (error.code === "auth/user-not-found") {
      return NextResponse.json(
        { error: "No user account was found with this email address." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "An internal server error occurred while updating the account details." },
      { status: 500 }
    );
  }
}
