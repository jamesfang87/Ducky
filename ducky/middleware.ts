import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/permissions";
import { homePath, USERS, type Role } from "@/lib/users";

/**
 * Route gates. Anything matched here needs a session, and the listed roles.
 *
 * Runs before the page renders, so a student typing /teacher never sees a
 * teacher screen. The cookie only carries an id; the role is resolved here
 * from the server-side user table.
 */
const RULES: { pattern: RegExp; roles: Role[] }[] = [
  { pattern: /^\/teacher(?:\/|$)/, roles: ["teacher"] },
  { pattern: /^\/session(?:\/|$)/, roles: ["student", "teacher"] },
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const id = req.cookies.get(COOKIE_NAME)?.value;
  const user = id ? USERS[id] : undefined;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const rule = RULES.find((r) => r.pattern.test(pathname));
  if (rule && !rule.roles.includes(user.role)) {
    const url = req.nextUrl.clone();
    url.pathname = homePath(user.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/teacher/:path*", "/session/:path*"],
};
