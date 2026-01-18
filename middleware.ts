import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/loading", "/room"]);

const hasClerk =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

export default hasClerk
  ? clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  const isAuthenticated = !!userId;
  const path = request.nextUrl.pathname;

  // Authenticated users on home → redirect to /loading
  if (isAuthenticated && path === "/") {
    return NextResponse.redirect(new URL("/loading", request.url));
  }

  // Unauthenticated users on /loading or /room → redirect to /
  if (!isAuthenticated && isProtectedRoute(request)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
})
  : () => NextResponse.next();
