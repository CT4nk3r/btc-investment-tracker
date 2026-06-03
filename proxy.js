import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/wallet(.*)"]);
const hasClerkEnv = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default hasClerkEnv
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : function setupModeProxy(req) {
      if (req.nextUrl.pathname.startsWith("/api/") && req.nextUrl.pathname !== "/api/health") {
        return NextResponse.json(
          { error: "Clerk is not configured yet. Add Clerk environment variables before public release." },
          { status: 503 },
        );
      }

      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/__clerk(.*)",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
