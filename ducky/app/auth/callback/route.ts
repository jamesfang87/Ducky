import { createClient } from "@/lib/supabase/server";
import { homePath } from "@/lib/users";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash"); // email templates that link straight here
  const otpType = searchParams.get("type") as EmailOtpType | null;
  let wanted = searchParams.get("role");
  const next = searchParams.get("next") ?? "";
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  if (!code && !(tokenHash && otpType)) return fail("No sign-in code came back. Try again.");

  // Google and email links (PKCE) send ?code; a token_hash link is verified directly.
  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: otpType! });
  if (error) {
    const otherBrowser = code && /code verifier/i.test(error.message);
    return fail(otherBrowser ? "Open the email link in the same browser you signed up in, or log in again." : `Sign-in failed: ${error.message}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Signed in, but no session was saved. Check that cookies are allowed.");
  wanted ??= user.user_metadata?.role ?? null; // email sign-up stores the chosen role here too

  // First sign-in only: lock in the role picked on the login page. Existing users keep theirs.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  let role = profile?.role as "student" | "teacher" | null | undefined;
  if (!role) {
    if (wanted !== "student" && wanted !== "teacher") return fail("Pick student or teacher, then sign in.");
    const { error: roleError } = await supabase.rpc("set_my_role", { new_role: wanted });
    if (roleError) return fail(`Could not save your role: ${roleError.message}`);
    role = wanted;
  }
  if (role !== "student" && role !== "teacher") return fail("This account has no student or teacher access.");

  // The middleware sends them through the 2-step code check (/mfa) before any protected page.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  return NextResponse.redirect(`${origin}${safeNext || homePath(role)}`);
}
