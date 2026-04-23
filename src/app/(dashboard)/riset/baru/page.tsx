import { createClient } from "@/lib/supabase/server";
import { NewResearchForm, type HolePickerOption, type CropOption } from "./form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewResearchPage() {
  const supabase = await createClient();

  const [holesRes, cropsRes, reservedRes] = await Promise.all([
    // Ambil SEMUA lubang supaya picker bisa menampilkan peta lengkap
    // dan user melihat konteks (lubang yang terisi/direservasi tampil muted).
    supabase
      .from("holes")
      .select("id, canonical_id, rack, tier, lane, hole_number, status")
      .order("rack").order("tier").order("lane").order("hole_number"),
    supabase
      .from("crop_catalog")
      .select("id, name_id, grow_duration_days")
      .order("name_id"),
    supabase
      .from("research_hole_allocations")
      .select("hole_id")
      .is("released_at", null),
  ]);

  const reservedSet = new Set((reservedRes.data ?? []).map((a) => a.hole_id));
  const allHoles: HolePickerOption[] = (holesRes.data ?? []).map((h) => ({
    id: h.id,
    canonical_id: h.canonical_id,
    rack: h.rack,
    tier: h.tier,
    lane: h.lane,
    hole_number: h.hole_number,
    status: h.status,
    reservedByOther: reservedSet.has(h.id),
  }));

  const crops: CropOption[] = (cropsRes.data ?? []).map((c) => ({
    id: c.id,
    name_id: c.name_id,
    grow_duration_days: c.grow_duration_days,
  }));

  return <NewResearchForm allHoles={allHoles} crops={crops} />;
}
