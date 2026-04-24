import { createClient } from "@/lib/supabase/server";
import { FloatingForm } from "@/components/floating-form";
import { CropForm } from "@/components/crop-form";
import { notFound, redirect } from "next/navigation";
import { getServerT } from "@/lib/i18n-server";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function EditCropPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getServerT();

  // Editing is admin + operator only. Viewer reaching via URL is bounced.
  const currentUser = await getCurrentUser();
  if (!currentUser || !["admin", "operator"].includes(currentUser.role)) {
    redirect("/komoditas?denied=/komoditas/" + id);
  }

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
