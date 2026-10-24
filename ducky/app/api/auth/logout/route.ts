import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/permissions";

export async function POST() {
  const jar = await cookies();
  // Expire rather than delete so the path matches the cookie set at login.
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return Response.json({ redirect: "/login" });
}
