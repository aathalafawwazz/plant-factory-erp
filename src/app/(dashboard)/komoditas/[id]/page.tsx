import { createClient } from "@/lib/supabase/server";
import { FloatingForm } from "@/components/floating-form";
import { CropForm } from "@/components/crop-form";
import { notFound } from "next/navigation";

export default async function EditCropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: crop } = await supabase
    .from("crop_catalog")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (!crop) notFound();

  return (
    <FloatingForm title="Edit Komoditas" backHref="/komoditas">
      <CropForm crop={crop} />
    </FloatingForm>
  );
}
