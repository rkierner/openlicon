import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Routes that don't need auth
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth",
  "/_next",
  "/favicon",
  "/icon",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes and static assets
  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API routes with PAT Bearer tokens are handled in the route handler via
  // withAuth() — the middleware only handles UI session protection here.
  if (pathname.startsWith("/api/")) {
    // Allow API routes — individual handlers enforce auth via withAuth()
    // PAT Bearer tokens are validated there, not at the edge
    return NextResponse.next();
  }

  // UI routes: require a valid session
  const session = await auth();
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
