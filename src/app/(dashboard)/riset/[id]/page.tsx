import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResearchDetail } from "@/components/research-detail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RisetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const researchId = Number(id);
  if (!Number.isFinite(researchId)) notFound();

  const supabase = await createClient();

  const [project, allocations, logs, attachments, materials, allHolesRes, activeAllocRes] = await Promise.all([
    supabase.from("research_projects").select("*").eq("id", researchId).single(),
    supabase
      .from("research_hole_allocations")
      .select("*, holes(canonical_id, status, rack, tier, lane, hole_number)")
      .eq("research_id", researchId)
      .order("reserved_from", { ascending: false }),
    supabase
      .from("research_progress_logs")
      .select("*")
      .eq("research_id", researchId)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("research_attachments")
      .select("*")
      .eq("research_id", researchId)
      .order("created_at", { ascending: false }),
    supabase
      .from("research_materials")
      .select("*")
      .eq("research_id", researchId)
      .order("created_at", { ascending: false }),
    supabase
      .from("holes")
      .select("id, canonical_id, rack, tier, lane, hole_number, status")
      .order("rack").order("tier").order("lane").order("hole_number"),
    supabase
      .from("research_hole_allocations")
      .select("hole_id, research_id")
      .is("released_at", null),
  ]);

  if (project.error || !project.data) notFound();

  const ownedByThis = new Set<number>(
    (activeAllocRes.data ?? [])
      .filter((a) => a.research_id === researchId)
      .map((a) => a.hole_id)
  );
  const reservedByOther = new Set<number>(
    (activeAllocRes.data ?? [])
      .filter((a) => a.research_id !== researchId)
      .map((a) => a.hole_id)
  );
  const allHoles = (allHolesRes.data ?? []).map((h) => ({
    id: h.id,
    canonical_id: h.canonical_id,
    rack: h.rack,
    tier: h.tier,
    lane: h.lane,
    hole_number: h.hole_number,
    status: h.status,
    reservedByOther: reservedByOther.has(h.id),
  }));

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  return (
    <ResearchDetail
      project={project.data}
      allocations={allocations.data ?? []}
      logs={logs.data ?? []}
      attachments={attachments.data ?? []}
      materials={materials.data ?? []}
      allHoles={allHoles}
      ownedHoleIds={ownedByThis}
      currentUserId={user?.id ?? null}
      currentUserRole={(profile?.role as string) ?? "viewer"}
    />
  );
}
