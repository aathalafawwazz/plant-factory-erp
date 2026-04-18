import { FloatingForm } from "@/components/floating-form";
import { CropForm } from "@/components/crop-form";

export default function NewCropPage() {
  return (
    <FloatingForm title="Tambah Komoditas" backHref="/komoditas">
      <CropForm />
    </FloatingForm>
  );
}
