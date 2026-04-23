import { PlantLogSection } from "@/components/plant-log-section";
import { getServerT } from "@/lib/i18n-server";

export default async function PlantingPage() {
  const t = await getServerT();
  return (
    <div>
      <h1 className="text-lg font-semibold text-foreground mb-4">{t("cult.plant_log")}</h1>
      <PlantLogSection hideInternalHeader />
    </div>
  );
}
