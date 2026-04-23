import type { SupabaseClient } from "@supabase/supabase-js";

export type LocalPhoto = { dataUrl: string; file: File; timestamp: Date };

/**
 * Upload a batch of local photos to Supabase Storage and insert
 * matching rows in the `planting_photos` table.
 *
 * Returns the number of photos that failed (0 = success).
 * Logs errors but never throws — caller decides how to surface partial failure.
 */
export async function uploadPlantingPhotos(
  supabase: SupabaseClient,
  params: {
    cycleId: number;
    photos: LocalPhoto[];
    kind: "planting" | "maintenance" | "harvest";
    userId: string | null;
  }
): Promise<{ uploaded: number; failed: number }> {
  const { cycleId, photos, kind, userId } = params;
  if (photos.length === 0) return { uploaded: 0, failed: 0 };

  type Row = {
    cycle_id: number;
    storage_path: string;
    kind: "planting" | "maintenance" | "harvest";
    captured_at: string;
    captured_by: string | null;
  };
  const rows: Row[] = [];
  let storageFailed = 0;

  await Promise.all(
    photos.map(async (photo, idx) => {
      const ext = photo.file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `${cycleId}/${photo.timestamp.getTime()}-${kind}-${idx}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("planting-photos")
        .upload(storagePath, photo.file, {
          contentType: photo.file.type || "image/jpeg",
          upsert: false,
        });
      if (uploadErr) {
        console.error(`[upload-photo] cycle=${cycleId} path=${storagePath}:`, uploadErr);
        storageFailed += 1;
        return;
      }
      rows.push({
        cycle_id: cycleId,
        storage_path: storagePath,
        kind,
        captured_at: photo.timestamp.toISOString(),
        captured_by: userId,
      });
    })
  );

  if (rows.length > 0) {
    const { error } = await supabase.from("planting_photos").insert(rows);
    if (error) {
      console.error(`[upload-photo] planting_photos insert failed cycle=${cycleId}:`, error);
      return { uploaded: 0, failed: photos.length };
    }
  }

  return { uploaded: rows.length, failed: storageFailed };
}
