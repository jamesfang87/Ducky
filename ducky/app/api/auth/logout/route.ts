import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut(); // revokes the session and clears the auth cookies
  return Response.json({ redirect: "/login" });
}
