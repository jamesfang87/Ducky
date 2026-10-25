import { getProfile } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";

async function rotateCode(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const { supabase } = await getProfile();
  const { error } = await supabase.rpc("regenerate_join_code", { cid: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/teacher/classes/${id}`);
}

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getProfile();
  const { data: cls } = await supabase.from("classes").select("*").eq("id", id).eq("teacher_id", user!.id).single();
  if (!cls) notFound();

  const { data: roster } = await supabase
    .from("enrollments")
    .select("joined_at, profiles(full_name, email)")
    .eq("class_id", id)
    .order("joined_at");

  const joinUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/join?code=${cls.join_code}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1, width: 240 });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        {cls.course_number && <p className="font-mono text-sm font-semibold text-gray-500">{cls.course_number}</p>}
        <h1 className="text-2xl font-bold">{cls.name}</h1>
      </div>
      <section className="flex flex-wrap items-center gap-8 rounded-xl border p-6">
        <div className="w-60 bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Join code</p>
          <p className="font-mono text-5xl font-bold tracking-widest">{cls.join_code}</p>
          <p className="break-all text-sm text-gray-500">{joinUrl}</p>
          <form action={rotateCode}>
            <input type="hidden" name="id" value={cls.id} />
            <button className="text-sm text-red-600 underline">Generate new code</button>
          </form>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Students ({roster?.length ?? 0})</h2>
        <ul className="divide-y rounded-lg border">
          {roster?.map((r, i) => {
            const p = r.profiles as unknown as { full_name: string | null; email: string | null };
            return <li key={i} className="p-3">{p?.full_name ?? p?.email}</li>;
          })}
        </ul>
      </section>
    </main>
  );
}
