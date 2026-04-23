import { createClient } from "@/lib/supabase/server";
import { FloatingForm } from "@/components/floating-form";
import { CropForm } from "@/components/crop-form";
import { notFound } from "next/navigation";
import { getServerT } from "@/lib/i18n-server";

export default async function EditCropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getServerT();

  const { data: crop } = await supabase
    .from("crop_catalog")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (!crop) notFound();

  return (
    <FloatingForm title={t("crop_form.title_edit")} backHref="/komoditas">
      <CropForm crop={crop} />
    </FloatingForm>
  );
}
