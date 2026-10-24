import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const HOME = { teacher: "/teacher", student: "/session/demo" } as const;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const wanted = searchParams.get("role");
  const next = searchParams.get("next") ?? "";
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  if (!code) return fail("Google did not send a sign-in code back. Try again.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(`Sign-in failed: ${error.message}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Signed in, but no session was saved. Check that cookies are allowed.");

  // First sign-in: lock in the role picked on the login page. Existing users keep their role.
  let { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile?.role && (wanted === "student" || wanted === "teacher")) {
    const { error: roleError } = await supabase.rpc("set_my_role", { new_role: wanted });
    if (roleError) return fail(`Could not save your role: ${roleError.message}`);
    profile = { role: wanted };
  }

  const role = profile?.role === "teacher" ? "teacher" : "student";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  return NextResponse.redirect(`${origin}${safeNext || HOME[role]}`);
}
