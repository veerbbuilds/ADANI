import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { checkPermission } from "@/lib/authHelper";
import { RateLimiter } from "@/lib/rateLimiter";
import { ApiCache } from "@/lib/apiCache";
import { sanitize } from "@/lib/sanitizer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 🛡️ Apply rate limiting (20 logs per minute per IP) (CWE-770)
    if (RateLimiter.isRateLimited(request, 20, 60000, "log-movement")) {
      return NextResponse.json(
        { error: "Too many submissions. Please slow down." },
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

    // 🔒 Strictly authorize based on cookie permissions matrix
    const auth = await checkPermission("access_log_entry");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 403 });
    }

    const body = await request.json();

    // 🔒 Centralized Sanitization (CWE-79)
    const gp_no = sanitize(body.gp_no || "", 50).toUpperCase();
    const truck_no = sanitize(body.truck_no || "", 50).toUpperCase();
    const vessel_name = sanitize(body.vessel_name || "", 100);
    const commodity = sanitize(body.commodity || "", 100);
    const receiver_party = sanitize(body.receiver_party || "", 150);
    const yard_location = sanitize(body.yard_location || "", 50);
    const boe_no = sanitize(body.boe_no || "", 50);
    const surveyor_name = sanitize(body.surveyor_name || "", 100) || "Anonymous Surveyor";

    // Server-side validation (CWE-20)
    if (!gp_no || !truck_no) {
      return NextResponse.json(
        { error: "GP No and Truck No are required fields." },
        { status: 400 }
      );
    }

    const gpPattern = /^GP\d{11}$/;
    if (!gpPattern.test(gp_no)) {
      return NextResponse.json(
        { error: "Invalid GP Number format. Must match GP followed by 11 digits (e.g. GP26070301214)." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("yard_logs").doc(gp_no);

    const entryData = {
      gp_no,
      truck_no,
      vessel_name,
      commodity,
      receiver_party,
      yard_location,
      boe_no,
      surveyor_name,
      surveyor_email: auth.email || "",
      timestamp: FieldValue.serverTimestamp(),
    };

    // 🔒 HARDENED: Run a Firestore transaction to execute atomic check-and-create (CWE-362 / Race Condition)
    try {
      await adminDb.runTransaction(async (transaction: any) => {
        const docSnap = await transaction.get(docRef);
        if (docSnap.exists) {
          throw new Error("ALREADY_EXISTS");
        }
        transaction.set(docRef, entryData);
      });
    } catch (txError: any) {
      if (txError.message === "ALREADY_EXISTS") {
        return NextResponse.json(
          { error: `A log entry with GP No ${gp_no} already exists.` },
          { status: 409 }
        );
      }
      throw txError;
    }

    // ⚡ Invalidate active log cache so the dashboard shows the new data instantly
    ApiCache.invalidate();

    return NextResponse.json(
      { message: "Log entry saved successfully", id: gp_no },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating yard log:", error);
    return NextResponse.json(
      { error: "An internal server error occurred while saving the entry." },
      { status: 500 }
    );
  }
}
