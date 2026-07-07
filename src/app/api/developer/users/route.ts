import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 🛡️ Apply rate limiting (10 attempts per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 10, 60000, "developer-users-get")) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
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
      console.warn(`Unauthorized users directory read attempt by user: ${decoded.email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    // List all users registered in the Firebase project
    const userListResult = await adminAuth.listUsers(1000);
    const users = userListResult.users.map((user: any) => {
      const role = user.customClaims?.role || "surveyor";
      return {
        uid: user.uid,
        email: user.email || "N/A",
        role,
        disabled: user.disabled,
        createdAt: user.metadata.creationTime,
        lastSignIn: user.metadata.lastSignInTime,
      };
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to list project user accounts:", error);
    return NextResponse.json(
      { error: "Internal server error occurred." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (10 attempts per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 10, 60000, "developer-users-post")) {
      return NextResponse.json(
        { error: "Too many user modification requests. Please wait a minute." },
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
      console.warn(`Unauthorized user modification attempt by user: ${decoded.email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { action, targetUid, role } = body;

    if (!targetUid || !action) {
      return NextResponse.json({ error: "Missing required parameters action/targetUid." }, { status: 400 });
    }

    // Process user modifications
    if (action === "suspend") {
      await adminAuth.updateUser(targetUid, { disabled: true });
      return NextResponse.json({ message: "User account suspended successfully." });
    } else if (action === "unsuspend") {
      await adminAuth.updateUser(targetUid, { disabled: false });
      return NextResponse.json({ message: "User account enabled successfully." });
    } else if (action === "set-role") {
      if (role !== "surveyor" && role !== "admin" && role !== "superadmin") {
        return NextResponse.json({ error: "Invalid role specification." }, { status: 400 });
      }
      await adminAuth.setCustomUserClaims(targetUid, { role });
      return NextResponse.json({ message: `User role claims updated to '${role}'.` });
    } else {
      return NextResponse.json({ error: "Invalid action type specified." }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to modify target user account:", error);
    return NextResponse.json(
      { error: "Internal server user moderation failed." },
      { status: 500 } // 🔒 HARDENED: Replaced status: 550 with standard HTTP 500 (CWE-209)
    );
  }
}
