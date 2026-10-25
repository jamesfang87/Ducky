import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE } from "@/lib/supabase/cookies";
import { cookies } from "next/headers";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut(); // revokes the session and clears the auth cookies
  (await cookies()).delete(REMEMBER_COOKIE); // the next sign-in asks again
  return Response.json({ redirect: "/login" });
}
