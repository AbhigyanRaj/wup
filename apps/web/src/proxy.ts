import { NextResponse, type NextRequest } from "next/server";

/*
 * Auth gate for app routes. A missing `wuup_authed` cookie sends the visitor to
 * /login?next=<path>. This is a coarse UX redirect only: every API call and
 * Server Function must still verify the session itself.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.has("wuup_authed")) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/chat", "/chat/:path*", "/data/:path*", "/settings/:path*"],
};
