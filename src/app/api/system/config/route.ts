import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";
import { sanitize } from "@/lib/sanitizer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 🛡️ Apply rate limiting (20 requests per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 20, 60000, "system-config-get")) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    // 1. Fetch Maintenance Mode status
    const configDoc = await adminDb.collection("settings").doc("system").get();
    const isMaintenance = configDoc.exists ? !!configDoc.data()?.maintenanceMode : false;

    // 2. Fetch Active System Notification
    const notifDoc = await adminDb.collection("settings").doc("notification").get();
    const notifData = notifDoc.exists ? notifDoc.data() : null;

    let notification = null;
    if (notifData && notifData.active) {
      // Check session to determine if current user has marked it read
      let isRead = false;
      let readByList: string[] = [];

      const cookieStore = await cookies();
      const token = cookieStore.get("session_token")?.value;
      let email = "";
      let role = "";

      if (token) {
        try {
          const decoded = await adminAuth.verifyIdToken(token);
          email = decoded.email || "";
          role = decoded.role || "";
          if (email && Array.isArray(notifData.readBy)) {
            isRead = notifData.readBy.includes(email);
          }
          // Only share readers list with privileged roles
          if (role === "superadmin" || role === "admin") {
            readByList = notifData.readBy || [];
          }
        } catch (e) {
          // Token invalid/expired - treat as anonymous
        }
      }

      notification = {
        id: notifData.id,
        title: notifData.title,
        message: notifData.message,
        active: notifData.active,
        isRead,
        readBy: readByList, // Only populated for admins
      };
    }

    return NextResponse.json({
      maintenanceMode: isMaintenance,
      notification,
    }, { status: 200 });
  } catch (error) {
    console.error("Failed to retrieve system settings:", error);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (5 requests per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 5, 60000, "system-config-post")) {
      return NextResponse.json(
        { error: "Too many settings modification requests. Please wait a minute." },
        { status: 429 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const role = decoded.role || "";

    if (role !== "superadmin" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin rights required." }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "toggle-maintenance") {
      const { maintenanceMode } = body;
      await adminDb.collection("settings").doc("system").set({
        maintenanceMode: !!maintenanceMode,
        updatedAt: new Date().toISOString(),
        updatedBy: decoded.email,
      }, { merge: true });

      return NextResponse.json({ message: "Maintenance mode state saved." }, { status: 200 });
    }

    if (action === "publish-notification") {
      const { title, message } = body;
      if (!title || !message) {
        return NextResponse.json({ error: "Title and message are required." }, { status: 400 });
      }

      // Centralized sanitization (CWE-79)
      const cleanTitle = sanitize(title, 200);
      const cleanMessage = sanitize(message, 1000);

      await adminDb.collection("settings").doc("notification").set({
        id: `notif_${Date.now()}`,
        title: cleanTitle,
        message: cleanMessage,
        active: true,
        readBy: [],
        createdAt: new Date().toISOString(),
        createdBy: decoded.email,
      });

      return NextResponse.json({ message: "System notification broadcasted." }, { status: 200 });
    }

    if (action === "clear-notification") {
      await adminDb.collection("settings").doc("notification").set({
        active: false,
      }, { merge: true });

      return NextResponse.json({ message: "System notification deactivated." }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update system config:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
