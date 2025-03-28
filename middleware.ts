import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Get authenticated user using getUser() for security
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is signed in and the current path is / or /login or /signup, redirect to /dashboard
  if (user && ["/login", "/signup", "/"].includes(req.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // If user is not signed in and the current path is not / or /login or /signup, redirect to /login
  if (
    !user &&
    !["/login", "/signup", "/", "/api/auth/callback"].some((path) => req.nextUrl.pathname.startsWith(path))
  ) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

