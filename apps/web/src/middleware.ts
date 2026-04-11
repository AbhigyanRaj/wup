import { type NextRequest, NextResponse } from 'next/server'

// MOCK MIDDLEWARE: Bypassing Supabase for Frontend Demo
export async function middleware(request: NextRequest) {
  // We allow all routes for now to ensure the user can see the frontend
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
