import { getProfile } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { user, profile } = await getProfile();
  if (!user) redirect("/login");
  if (!profile?.role) redirect("/onboarding");
  redirect(profile.role === "teacher" ? "/teacher" : "/student");
}
