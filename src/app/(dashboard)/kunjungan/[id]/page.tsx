import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VisitDetail } from "@/components/visit-detail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KunjunganDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const visitId = Number(id);
  if (!Number.isFinite(visitId)) notFound();

  const supabase = await createClient();

  const [visit, contacts, attachments] = await Promise.all([
    supabase.from("visits").select("*").eq("id", visitId).single(),
    supabase.from("visit_contacts").select("*").eq("visit_id", visitId)
      .order("is_primary", { ascending: false }).order("id"),
    supabase.from("visit_attachments").select("*").eq("visit_id", visitId)
      .order("created_at", { ascending: false }),
  ]);

  if (visit.error || !visit.data) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  return (
    <VisitDetail
      visit={visit.data}
      contacts={contacts.data ?? []}
      attachments={attachments.data ?? []}
      currentUserId={user?.id ?? null}
      currentUserRole={(profile?.role as string) ?? "viewer"}
    />
  );
}
