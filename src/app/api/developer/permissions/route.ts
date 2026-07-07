import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

// Default permission settings structure (safe fallbacks)
const DEFAULT_PERMISSIONS = {
  surveyor: {
    access_log_entry: true,
    access_dashboard: false,
    delete_logs: false,
    export_csv: false,
  },
  admin: {
    access_log_entry: true,
    access_dashboard: true,
    delete_logs: false,
    export_csv: true,
  },
  superadmin: {
    access_log_entry: true,
    access_dashboard: true,
    delete_logs: true,
    export_csv: true,
  },
};

export async function GET() {
  try {
    // 🔒 Authentication check — only authenticated users can read permissions (CWE-862)
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    try {
      await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }

    const docRef = adminDb.collection("settings").doc("permissions");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      await docRef.set(DEFAULT_PERMISSIONS);
      return NextResponse.json(DEFAULT_PERMISSIONS);
    }

    return NextResponse.json(docSnap.data());
  } catch (error) {
    console.error("Failed to query permissions settings:", error);
    return NextResponse.json(
      { error: "Internal server database error." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // 🔒 Strictly authorize using session cookie (removes manual developer key input)
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.role !== "superadmin") {
      console.warn(`Unauthorized permissions modification attempt by user: ${decoded.email}`);
      return NextResponse.json({ error: "Access denied. Developer privileges required." }, { status: 403 });
    }

    const payload = await request.json();

    if (!payload.surveyor || !payload.admin || !payload.superadmin) {
      return NextResponse.json({ error: "Invalid schema structure." }, { status: 400 });
    }

    // Save configuration
    await adminDb.collection("settings").doc("permissions").set(payload);

    return NextResponse.json({ message: "Permissions matrix updated successfully." }, { status: 200 });
  } catch (error) {
    console.error("Failed to update permissions settings:", error);
    return NextResponse.json(
      { error: "Internal server error occurred." },
      { status: 500 }
    );
  }
}
