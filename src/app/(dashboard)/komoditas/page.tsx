import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerI18n } from "@/lib/i18n-server";
import { translateCommodity } from "@/lib/translate-helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function CropCatalogPage() {
  const supabase = await createClient();
  const { t, lang } = await getServerI18n();

  const { data: crops } = await supabase
    .from("crop_catalog")
    .select("*")
    .order("name_id");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-foreground">{t("cult.commodity_catalog")}</h1>
        <Link href="/komoditas/baru">
          <Button className="h-9 bg-primary text-white text-[13px] hover:bg-primary/90">{t("cult.add_commodity")}</Button>
        </Link>
      </div>

      {(!crops || crops.length === 0) ? (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("cult.no_commodities")}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">{t("common.name")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("commodity.name_latin")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("cult.duration_days")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">EC (mS/cm)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">pH</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">CO2 (ppm)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">VPD (kPa)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">PPFD</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("commodity.solution_temp")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">{t("commodity.notes")}</TableHead>
                <TableHead className="text-[12px] text-muted-foreground w-[80px]">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.map((crop) => (
                <TableRow key={crop.id}>
                  <TableCell className="text-[13px] font-medium">{translateCommodity(crop.name_id, lang)}</TableCell>
                  <TableCell className="text-[13px] italic text-muted-foreground">
                    {crop.name_latin ?? "-"}
                  </TableCell>
                  <TableCell className="text-[13px]">{crop.grow_duration_days}</TableCell>
                  <TableCell className="text-[13px]">
                    {crop.ec_min !== null && crop.ec_max !== null
                      ? `${crop.ec_min} – ${crop.ec_max}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {crop.ph_min !== null && crop.ph_max !== null
                      ? `${crop.ph_min} – ${crop.ph_max}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {crop.co2_min !== null && crop.co2_max !== null
                      ? `${crop.co2_min} – ${crop.co2_max}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {crop.vpd_min !== null && crop.vpd_max !== null
                      ? `${crop.vpd_min} – ${crop.vpd_max}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {crop.ppfd_min !== null && crop.ppfd_max !== null
                      ? `${crop.ppfd_min} – ${crop.ppfd_max}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-[13px]">
                    {crop.solution_temp_min !== null && crop.solution_temp_max !== null
                      ? `${crop.solution_temp_min} – ${crop.solution_temp_max}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground max-w-[200px] truncate">
                    {crop.density_notes ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/komoditas/${crop.id}`}>
                      <Button variant="ghost" size="sm">{t("common.edit")}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
