import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PracticeRoom } from "@/components/horizon/PracticeRoom";

export const metadata = { title: "Practice room" };

// Only the invited candidate may open the practice room, and only before they
// have started: afterwards the real exam is the only screen.
export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: ca } = await supabase.from("candidate_assessments").select("id, status, candidate_id").eq("id", id).single();
  if (!ca || ca.candidate_id !== user.id) redirect("/candidate");
  if (ca.status !== "invited") redirect(`/candidate/assessments/${id}`);
  return <PracticeRoom backHref={`/candidate/assessments/${id}`} />;
}
