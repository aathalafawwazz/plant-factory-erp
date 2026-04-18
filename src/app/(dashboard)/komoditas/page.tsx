import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  const { data: crops } = await supabase
    .from("crop_catalog")
    .select("*")
    .order("name_id");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-foreground">Katalog Komoditas</h1>
        <Link href="/komoditas/baru">
          <Button className="h-9 bg-[oklch(0.65_0.18_260)] text-white text-[13px] hover:bg-[oklch(0.60_0.20_260)]">+ Tambah Komoditas</Button>
        </Link>
      </div>

      {(!crops || crops.length === 0) ? (
        <Card className="rounded-xl border border-border/40 bg-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Belum ada data komoditas.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[12px] text-muted-foreground">Nama</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Nama Latin</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Durasi (hari)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">EC (mS/cm)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">pH</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">CO2 (ppm)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">VPD (kPa)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">PPFD</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Suhu Larutan (°C)</TableHead>
                <TableHead className="text-[12px] text-muted-foreground">Keterangan</TableHead>
                <TableHead className="text-[12px] text-muted-foreground w-[80px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.map((crop) => (
                <TableRow key={crop.id}>
                  <TableCell className="text-[13px] font-medium">{crop.name_id}</TableCell>
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
                      <Button variant="ghost" size="sm">Edit</Button>
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
