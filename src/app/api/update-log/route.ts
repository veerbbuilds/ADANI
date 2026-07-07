import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { checkPermission } from "@/lib/authHelper";
import { RateLimiter } from "@/lib/rateLimiter";
import { ApiCache } from "@/lib/apiCache";
import { sanitize } from "@/lib/sanitizer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (20 updates per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 20, 60000, "update-log")) {
      return NextResponse.json(
        { error: "Too many updates. Please slow down." },
        { status: 429 }
      );
    }

    // 🔒 Enforce Content-Type header validation (CWE-20)
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 415 }
      );
    }

    // 🔒 Strictly authorize using cookie permission session matrix
    const auth = await checkPermission("access_log_entry");
    if (!auth.authorized || !auth.role) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const body = await request.json();
    const gp_no = sanitize(body.gp_no || "", 50).toUpperCase();

    if (!gp_no) {
      return NextResponse.json({ error: "GP No is required." }, { status: 400 });
    }

    const docRef = adminDb.collection("yard_logs").doc(gp_no);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Target log entry not found." }, { status: 404 });
    }

    const existingData = docSnap.data() || {};

    // 🔓 Handle Admin/Developer unlock override
    if (body.action === "unlock") {
      if (auth.role !== "superadmin" && auth.role !== "admin") {
        return NextResponse.json(
          { error: "Access Denied. Only Admin and Developer accounts can unlock logs." },
          { status: 403 }
        );
      }

      await docRef.update({
        allow_surveyor_edit: true,
        unlocked_by: auth.email || "system",
        unlocked_at: new Date().toISOString(),
      });

      // Append Audit log record
      await adminDb.collection("audit_logs").add({
        eventType: "LOG_UNLOCKED",
        email: auth.email || "system",
        timestamp: new Date().toISOString(),
        ip: request.headers.get("x-forwarded-for") || "127.0.0.1",
        userAgent: request.headers.get("user-agent") || "unknown",
        metadata: {
          gp_no,
          reason: "Manual admin unlock for surveyor correction",
        },
      });

      ApiCache.invalidate();
      return NextResponse.json(
        { message: "Log entry temporarily unlocked for surveyor editing." },
        { status: 200 }
      );
    }

    // 🛡️ Check edit rules: Surveyor is restricted to 30 min unless temp unlocked
    if (auth.role === "surveyor") {
      const emailLower = auth.email?.toLowerCase() || "";
      const isCreator =
        (existingData.surveyor_email || "").toLowerCase() === emailLower ||
        (existingData.surveyor_name || "").toLowerCase().includes(emailLower);

      if (!isCreator) {
        return NextResponse.json({ error: "Access Denied. You do not own this entry." }, { status: 403 });
      }

      // Check edit window (30 minutes) or temp unlock status
      const isTempUnlocked = existingData.allow_surveyor_edit === true;
      const timestamp = existingData.timestamp;
      let docTimeMs = Date.now();
      if (timestamp) {
        docTimeMs = typeof timestamp.toDate === "function" ? timestamp.toDate().getTime() : new Date(timestamp).getTime();
      }

      const diffMs = Date.now() - docTimeMs;
      if (diffMs > 30 * 60 * 1000 && !isTempUnlocked) {
        return NextResponse.json(
          { error: "Locked. The 30-minute edit window for this entry has expired. Contact Developer or Admin to unlock." },
          { status: 403 }
        );
      }
    } else if (auth.role !== "superadmin") {
      // Admins locked from direct modifications after 30 mins to preserve audit trail
      const timestamp = existingData.timestamp;
      let docTimeMs = Date.now();
      if (timestamp) {
        docTimeMs = typeof timestamp.toDate === "function" ? timestamp.toDate().getTime() : new Date(timestamp).getTime();
      }
      const diffMs = Date.now() - docTimeMs;
      if (diffMs > 30 * 60 * 1000) {
        return NextResponse.json(
          { error: "Locked. Direct edits restricted to Developers after 30 minutes." },
          { status: 403 }
        );
      }
    }

    // Sanitize parameters for updates using centralized sanitizer (CWE-79)
    const updatedPayload = {
      truck_no: sanitize(body.truck_no || "", 50).toUpperCase(),
      vessel_name: sanitize(body.vessel_name || "", 100),
      commodity: sanitize(body.commodity || "", 100),
      receiver_party: sanitize(body.receiver_party || "", 150),
      yard_location: sanitize(body.yard_location || "", 50),
      boe_no: sanitize(body.boe_no || "", 50),
      allow_surveyor_edit: false, // Relock again upon successful updates
      last_edited_by: auth.email || "superadmin",
      last_edited_at: new Date().toISOString(),
    };

    // Update Firestore
    await docRef.update(updatedPayload);

    // ⚡ Invalidate active log cache so all viewports refresh instantly
    ApiCache.invalidate();

    return NextResponse.json({ message: "Log entry updated successfully." }, { status: 200 });
  } catch (error) {
    console.error("Failed to update log entry:", error);
    return NextResponse.json(
      { error: "An internal server error occurred while updating the log entry." },
      { status: 500 }
    );
  }
}
