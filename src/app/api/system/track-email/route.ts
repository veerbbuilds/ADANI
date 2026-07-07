import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { RateLimiter } from "@/lib/rateLimiter";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF base64 string
const TRACKING_PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Lightweight User Agent Parser (CWE-20)
function parseUserAgent(ua: string) {
  let os = "Unknown OS";
  let device = "Desktop";
  let client = "Direct Mail App";

  const uaLower = ua.toLowerCase();

  // 1. Detect Operating System
  if (uaLower.includes("windows")) {
    os = "Windows";
  } else if (uaLower.includes("macintosh") || uaLower.includes("mac os x")) {
    os = "macOS";
  } else if (uaLower.includes("iphone")) {
    os = "iOS";
    device = "iPhone";
  } else if (uaLower.includes("ipad")) {
    os = "iOS";
    device = "iPad";
  } else if (uaLower.includes("android")) {
    os = "Android";
    device = "Mobile";
  } else if (uaLower.includes("linux")) {
    os = "Linux";
  }

  // 2. Detect Client/Browser
  if (uaLower.includes("googleimageproxy") || uaLower.includes("via ggpht.com")) {
    client = "Gmail Proxy";
    os = "Cloud Server";
    device = "Google Proxy Server";
  } else if (uaLower.includes("outlook") || uaLower.includes("office")) {
    client = "MS Outlook";
  } else if (uaLower.includes("thunderbird")) {
    client = "Mozilla Thunderbird";
  } else if (uaLower.includes("chrome")) {
    client = "Chrome";
  } else if (uaLower.includes("safari") && !uaLower.includes("chrome")) {
    client = "Safari";
  } else if (uaLower.includes("firefox")) {
    client = "Firefox";
  } else if (uaLower.includes("edge")) {
    client = "MS Edge";
  }

  return { os, device, client };
}

// Fetch IP Geolocation details with a strict 2-second timeout to prevent thread blocking (CWE-400)
async function getGeoLocation(ip: string) {
  const isPrivate =
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.");

  if (isPrivate) {
    return {
      country: "Local Host / VPN",
      region: "Internal",
      city: "Local Sandbox",
      isp: "Private Loopback Address",
    };
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000); // 2 second timeout limit

    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    
    clearTimeout(id);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "success") {
        return {
          country: data.country || "Unknown",
          region: data.regionName || "Unknown",
          city: data.city || "Unknown",
          isp: data.isp || "Unknown ISP",
          lat: data.lat || null,
          lon: data.lon || null,
        };
      }
    }
  } catch (err) {
    // Fail silently to always return tracking pixel
  }

  return {
    country: "Unknown Country",
    region: "Unknown Region",
    city: "Unknown City",
    isp: "Unable to Resolve Provider",
  };
}

export async function GET(request: Request) {
  try {
    // 🛡️ Apply rate limiting (50 requests per minute per IP) to prevent spamming opens (CWE-770)
    if (RateLimiter.isRateLimited(request, 50, 60000, "email-tracking-pixel")) {
      return new NextResponse(TRACKING_PIXEL_GIF, {
        status: 200,
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Capture details of who opened the email
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
      const userAgent = request.headers.get("user-agent") || "unknown";

      // Parse user agent into specific device details
      const parsedUa = parseUserAgent(userAgent);

      // Detect Google Image proxy server pre-fetching caching (standard Gmail client behavior)
      const isProxy = userAgent.includes("GoogleImageProxy") || userAgent.includes("via ggpht.com");

      // Query Geolocation in background
      const geo = await getGeoLocation(ip);

      const logRef = adminDb.collection("email_logs").doc(id);

      // Perform atomic update: status = "OPENED" and append the open event with location data
      await logRef.update({
        status: "OPENED",
        opens: FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          ip,
          userAgent,
          clientName: parsedUa.client,
          device: parsedUa.device,
          os: parsedUa.os,
          isProxy,
          country: geo.country,
          region: geo.region,
          city: geo.city,
          isp: geo.isp,
        }),
      });
    }
  } catch (error) {
    // Silent catch — do not break the email loading if database fails
    console.error("Email tracking trigger failed:", error);
  }

  // Always return the transparent 1x1 GIF so the email looks perfect and doesn't show broken image
  return new NextResponse(TRACKING_PIXEL_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
