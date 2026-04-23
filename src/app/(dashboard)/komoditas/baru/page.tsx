import { FloatingForm } from "@/components/floating-form";
import { CropForm } from "@/components/crop-form";
import { getServerT } from "@/lib/i18n-server";

export default async function NewCropPage() {
  const t = await getServerT();
  return (
    <FloatingForm title={t("crop_form.title_add")} backHref="/komoditas">
      <CropForm />
    </FloatingForm>
  );
}
