import { createClient } from "@/lib/supabase/server";
import { RackMap } from "@/components/rack-map";

export default async function HolePage() {
  const supabase = await createClient();

  const [holesResult, cyclesResult, cropsResult] = await Promise.all([
    supabase.from("holes").select("*").order("rack").order("tier").order("lane").order("hole_number"),
    supabase
      .from("planting_cycles")
      .select("*, crop_catalog(*)")
      .in("status", ["planted", "growing", "ready_harvest"]),
    supabase.from("crop_catalog").select("*").order("name_id"),
  ]);

  const holes = holesResult.data ?? [];
  const cycles = cyclesResult.data ?? [];
  const crops = cropsResult.data ?? [];

  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground mb-4">Peta Lubang Tanam</h1>
      <RackMap holes={holes} cycles={cycles as never} crops={crops} />
    </div>
  );
}
