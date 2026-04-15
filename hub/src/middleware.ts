import { auth } from "@/lib/auth-config";

export default auth((req) => {
  // Short-circuit health checks to prevent database/auth initialization during K8s probes
  if (req.nextUrl.pathname.startsWith("/api/health")) return;
  
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/v1/register") || nextUrl.pathname.startsWith("/api/v1/report") || nextUrl.pathname.startsWith("/api/health") || nextUrl.pathname.startsWith("/api/v1/setup") || nextUrl.pathname.startsWith("/api/v1/db-debug");
  const isLoginPage = nextUrl.pathname.startsWith("/login");
  const isSetupPage = nextUrl.pathname.startsWith("/setup");

  if (isApiRoute) {
    if (isPublicApiRoute || isAuthRoute) return;
    if (!isLoggedIn) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    return;
  }

  if (isLoginPage || isSetupPage) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/", nextUrl));
    }
    return;
  }

  if (!isLoggedIn && !isSetupPage) {
    // Note: In a real production scenario, you'd cache the "isSetupDone" state 
    // to avoid a DB check/fetch on every unauthenticated request.
    return Response.redirect(new URL("/login", nextUrl));
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next|api/health).*)", "/", "/(api|trpc)(.*)"],
};
