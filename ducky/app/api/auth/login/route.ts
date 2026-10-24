import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/permissions";
import { DEMO_USER_BY_ROLE, homePath, USERS, type Role } from "@/lib/users";

/**
 * Mock sign-in: the role picker posts `{ role }` and gets a session cookie.
 *
 * No password, no OAuth, no database. The cookie holds the user id only; the
 * role is looked up server-side on every request (see `lib/auth.ts`).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { role?: Role } | null;
  const role = body?.role;

  if (role !== "student" && role !== "teacher") {
    return Response.json({ error: "Pick student or teacher." }, { status: 400 });
  }

  const user = USERS[DEMO_USER_BY_ROLE[role]];
  if (!user) {
    return Response.json({ error: "No demo user for that role." }, { status: 401 });
  }

  const jar = await cookies();
  jar.set(COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return Response.json({ redirect: homePath(user.role) });
}
