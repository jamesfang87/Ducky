import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS, REMEMBER_COOKIE, withLifetime } from "./cookies";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            const remember = cookieStore.get(REMEMBER_COOKIE)?.value;
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, withLifetime(options, remember)));
          } catch {
            // Called from a Server Component; the middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
