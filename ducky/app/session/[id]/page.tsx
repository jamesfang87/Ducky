import SessionView from "@/components/session/SessionView";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionView key={id} sessionId={id} />;
}
