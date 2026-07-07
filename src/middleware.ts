import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Edge Middleware — Security Headers + Route Protection
 * CWE-693, CWE-1021, CWE-862
 */

// Routes that require authentication (checked via session_token cookie presence)
const PROTECTED_ROUTES = ["/dashboard", "/developer", "/surveyor", "/profile"];

// Public routes that should never be blocked
const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password", "/~offline"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- 1. Edge-Level Route Protection (CWE-862) ---
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  const isApiRoute = pathname.startsWith("/api");
  const isStaticAsset = pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname === "/favicon.ico";

  // Check session cookie for protected routes (not API — APIs handle their own auth)
  if (isProtected && !isApiRoute && !isStaticAsset) {
    const sessionToken = request.cookies.get("session_token")?.value;
    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Root "/" redirect — send to /login if unauthenticated, /surveyor if authenticated
  if (pathname === "/") {
    const sessionToken = request.cookies.get("session_token")?.value;
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // --- 2. Security Response Headers (CWE-1021, OWASP A05) ---
  const response = NextResponse.next();

  // Content Security Policy — strict but allows Firebase SDK and Google Fonts
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleapis.com",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // Prevent clickjacking (CWE-1021)
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Control referrer leakage
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // HTTP Strict Transport Security — enforce HTTPS for 2 years
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");

  // Restrict browser features/APIs from iframes
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");

  // Prevent DNS prefetching
  response.headers.set("X-DNS-Prefetch-Control", "off");

  // Block cross-domain policies
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");

  return response;
}

// Match all routes except static files
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icons|favicon.ico).*)",
  ],
};
