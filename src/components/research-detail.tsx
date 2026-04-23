"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Calendar, Sprout, FileText, Package, Paperclip, CheckCircle2,
  Pause, Play, XCircle, Plus, Trash2, Camera, ChevronRight, X,
  Thermometer, Droplets, Ruler, Leaf, Beaker, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RESEARCH_STATUS_META, RESEARCH_PHASES, RESEARCH_TYPE_KEY, RESEARCH_PHASE_KEY } from "@/lib/research-meta";
import { useLang } from "@/lib/i18n";
import type {
  ResearchProject, ResearchHoleAllocation, ResearchProgressLog,
  ResearchAttachment, ResearchMaterial, ResearchStatus,
} from "@/lib/types/database";
import { ResearchHolePicker, type HolePickerOption } from "@/components/research-hole-picker";
import { ResearchMiniRackMap } from "@/components/research-mini-rackmap";

type AllocationWithHole = ResearchHoleAllocation & {
  holes?: { canonical_id: string; status: string; rack?: string; tier?: number; lane?: number; hole_number?: number } | null;
};

const OBSERVATION_TAGS = [
  "Sehat", "Pertumbuhan baik", "Daun layu", "Ada hama", "Bercak daun",
  "Mulai berbunga", "Stres hara", "Stres air", "Stres cahaya",
] as const;

const OBSERVATION_TAG_KEY: Record<string, string> = {
  "Sehat": "rd.tag.healthy",
  "Pertumbuhan baik": "rd.tag.good_growth",
  "Daun layu": "rd.tag.wilted_leaf",
  "Ada hama": "rd.tag.pest",
  "Bercak daun": "rd.tag.spotted_leaf",
  "Mulai berbunga": "rd.tag.flowering",
  "Stres hara": "rd.tag.nutrient_stress",
  "Stres air": "rd.tag.water_stress",
  "Stres cahaya": "rd.tag.light_stress",
};

interface Props {
  project: ResearchProject;
  allocations: AllocationWithHole[];
  logs: ResearchProgressLog[];
  attachments: ResearchAttachment[];
  materials: ResearchMaterial[];
  allHoles: HolePickerOption[];
  ownedHoleIds: Set<number>;
  currentUserId: string | null;
  currentUserRole: string;
}

export function ResearchDetail({
  project, allocations, logs, attachments, materials, allHoles, ownedHoleIds,
  currentUserId, currentUserRole,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLang();

  const canManage =
    currentUserRole === "admin" ||
    currentUserRole === "operator" ||
    (currentUserRole === "researcher" && project.researcher_user_id === currentUserId);
  const isAdmin = currentUserRole === "admin" || currentUserRole === "operator";

  const meta = RESEARCH_STATUS_META[project.status];

  const activeAlloc = allocations.filter((a) => a.released_at == null);
  const releasedAlloc = allocations.filter((a) => a.released_at != null);

  // ============ Status actions ============
  const [busy, setBusy] = useState(false);

  async function changeStatus(newStatus: ResearchStatus, extraFields: Record<string, unknown> = {}) {
    setBusy(true);
    const { error } = await supabase
      .from("research_projects")
      .update({ status: newStatus, ...extraFields })
      .eq("id", project.id);
    setBusy(false);
    if (error) {
      toast.error(`${t("rd.status_change_failed")} ${error.message}`);
      return;
    }
    toast.success(`${t("rd.status_changed_to")} ${t(RESEARCH_STATUS_META[newStatus].labelKey)}`);
    router.refresh();
  }

  async function handleApprove() {
    await changeStatus("approved", {
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    });
  }
  async function handleStart() {
    await changeStatus("active", { actual_start: new Date().toISOString().slice(0, 10) });
  }
  async function handlePause()    { await changeStatus("paused"); }
  async function handleResume()   { await changeStatus("active"); }
  async function handleComplete() {
    await changeStatus("completed", { actual_end: new Date().toISOString().slice(0, 10) });
  }
  async function handleCancel()   {
    if (!confirm(t("rd.cancel_confirm"))) return;
    await changeStatus("cancelled");
  }

  // ============ Hole reservation ============
  const [showAlloc, setShowAlloc] = useState(false);
  const [allocHoleIds, setAllocHoleIds] = useState<Set<number>>(new Set());
  const [allocTreatment, setAllocTreatment] = useState("");
  const [allocGroup, setAllocGroup] = useState("");
  const [allocFrom, setAllocFrom] = useState(project.proposed_start ?? new Date().toISOString().slice(0, 10));
  const [allocUntil, setAllocUntil] = useState(project.proposed_end ?? "");
  const [showPicker, setShowPicker] = useState(false);

  async function handleAllocate() {
    if (allocHoleIds.size === 0) { toast.error(t("rd.select_min_one")); return; }
    if (!allocFrom || !allocUntil) { toast.error(t("rd.set_period")); return; }
    if (new Date(allocUntil) < new Date(allocFrom)) { toast.error(t("rd.invalid_end_date")); return; }

    setBusy(true);
    const rows = Array.from(allocHoleIds).map((hole_id) => ({
      research_id: project.id,
      hole_id,
      treatment_label: allocTreatment.trim() || null,
      treatment_group: allocGroup.trim() || null,
      reserved_from: allocFrom,
      reserved_until: allocUntil,
      created_by: currentUserId,
    }));
    const { error } = await supabase.from("research_hole_allocations").insert(rows);
    setBusy(false);
    if (error) {
      toast.error(`${t("rd.alloc_failed")} ${error.message}`);
      return;
    }
    toast.success(t("rd.alloc_success").replace("{n}", String(rows.length)));
    setShowAlloc(false);
    setAllocHoleIds(new Set());
    setAllocTreatment("");
    setAllocGroup("");
    router.refresh();
  }

  async function releaseAllocation(allocId: number) {
    if (!confirm(t("rd.release_confirm"))) return;
    setBusy(true);
    const { error } = await supabase
      .from("research_hole_allocations")
      .update({ released_at: new Date().toISOString() })
      .eq("id", allocId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("rd.release_success"));
    router.refresh();
  }

  // ============ Progress logs ============
  const [showLog, setShowLog] = useState(false);
  const [logPhase, setLogPhase] = useState<string>(RESEARCH_PHASES[0]);
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logSummary, setLogSummary] = useState("");
  const [logPhotos, setLogPhotos] = useState<{ file: File; dataUrl: string }[]>([]);

  // Metrics (optional)
  const [mPh, setMPh] = useState("");
  const [mEc, setMEc] = useState("");
  const [mTemp, setMTemp] = useState("");
  const [mHumidity, setMHumidity] = useState("");
  const [mHeight, setMHeight] = useState("");
  const [mLeafCount, setMLeafCount] = useState("");

  // Observation tags & related hole
  const [logObservations, setLogObservations] = useState<Set<string>>(new Set());
  const [logHoleId, setLogHoleId] = useState<string>(""); // canonical_id of a specific allocation

  function onLogPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const readers = files.map((file) => new Promise<{ file: File; dataUrl: string }>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve({ file, dataUrl: r.result as string });
      r.readAsDataURL(file);
    }));
    Promise.all(readers).then((loaded) => {
      setLogPhotos((prev) => [...prev, ...loaded]);
    });
    e.target.value = "";
  }

  function toggleObservation(tag: string) {
    setLogObservations((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  function resetLogForm() {
    setLogSummary("");
    setLogPhotos([]);
    setMPh(""); setMEc(""); setMTemp(""); setMHumidity(""); setMHeight(""); setMLeafCount("");
    setLogObservations(new Set());
    setLogHoleId("");
  }

  async function handleAddLog() {
    if (!logSummary.trim()) { toast.error(t("rd.summary_required")); return; }
    setBusy(true);

    // Build metrics JSON (only include filled values)
    const metrics: Record<string, unknown> = {};
    if (mPh) metrics.ph = Number(mPh);
    if (mEc) metrics.ec_ms = Number(mEc);
    if (mTemp) metrics.temp_c = Number(mTemp);
    if (mHumidity) metrics.humidity_pct = Number(mHumidity);
    if (mHeight) metrics.plant_height_cm = Number(mHeight);
    if (mLeafCount) metrics.leaf_count = Number(mLeafCount);
    if (logObservations.size > 0) metrics.observations = Array.from(logObservations);
    if (logHoleId) metrics.related_hole = logHoleId;
    const hasMetrics = Object.keys(metrics).length > 0;

    const { data: log, error } = await supabase
      .from("research_progress_logs")
      .insert({
        research_id: project.id,
        phase: logPhase,
        log_date: logDate,
        summary: logSummary.trim(),
        metrics: hasMetrics ? metrics : null,
        created_by: currentUserId,
      })
      .select()
      .single();

    if (error || !log) {
      setBusy(false);
      toast.error(`${t("rd.log_save_failed")} ${error?.message ?? "unknown"}`);
      return;
    }

    if (logPhotos.length > 0) {
      const rows: {
        research_id: number; progress_log_id: number; kind: "photo";
        storage_path: string; filename: string | null; uploaded_by: string | null;
      }[] = [];
      let photoFailed = 0;
      await Promise.all(logPhotos.map(async (ph, idx) => {
        const ext = ph.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${project.id}/logs/${log.id}/${Date.now()}-${idx}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("research-attachments")
          .upload(path, ph.file, { contentType: ph.file.type || "image/jpeg" });
        if (upErr) { photoFailed++; return; }
        rows.push({
          research_id: project.id, progress_log_id: log.id, kind: "photo",
          storage_path: path, filename: ph.file.name, uploaded_by: currentUserId,
        });
      }));
      if (rows.length > 0) await supabase.from("research_attachments").insert(rows);
      if (photoFailed > 0) toast.warning(t("rd.log_partial").replace("{n}", String(photoFailed)));
    }

    setBusy(false);
    toast.success(t("rd.log_added"));
    setShowLog(false);
    resetLogForm();
    router.refresh();
  }

  async function deleteLog(logId: number) {
    if (!confirm(t("rd.log_delete_confirm"))) return;
    setBusy(true);
    const { error } = await supabase.from("research_progress_logs").delete().eq("id", logId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("rd.log_deleted"));
    router.refresh();
  }

  // ============ Materials ============
  const [matName, setMatName] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matUnit, setMatUnit] = useState("");
  const [matNotes, setMatNotes] = useState("");

  async function handleAddMaterial() {
    if (!matName.trim()) { toast.error(t("rd.material_name_required")); return; }
    setBusy(true);
    const { error } = await supabase.from("research_materials").insert({
      research_id: project.id,
      item_name: matName.trim(),
      qty: matQty ? Number(matQty) : null,
      unit: matUnit.trim() || null,
      notes: matNotes.trim() || null,
      created_by: currentUserId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("rd.material_added"));
    setMatName(""); setMatQty(""); setMatUnit(""); setMatNotes("");
    router.refresh();
  }

  async function deleteMaterial(id: number) {
    if (!confirm(t("rd.material_delete_confirm"))) return;
    setBusy(true);
    const { error } = await supabase.from("research_materials").delete().eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    router.refresh();
  }

  // ============ Attachments ============
  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "bin";
      const kind: "photo" | "document" | "dataset" | "report" =
        /(jpg|jpeg|png|webp|heic)$/.test(ext) ? "photo"
        : /(csv|xlsx|xls)$/.test(ext) ? "dataset"
        : "document";
      const path = `${project.id}/files/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage
        .from("research-attachments")
        .upload(path, f, { contentType: f.type || "application/octet-stream" });
      if (upErr) { toast.error(`${f.name}: ${upErr.message}`); continue; }
      await supabase.from("research_attachments").insert({
        research_id: project.id,
        kind,
        storage_path: path,
        filename: f.name,
        uploaded_by: currentUserId,
      });
    }
    setBusy(false);
    e.target.value = "";
    toast.success(t("rd.attachment_uploaded").replace("{n}", String(files.length)));
    router.refresh();
  }

  function publicUrl(path: string): string {
    const { data } = supabase.storage.from("research-attachments").getPublicUrl(path);
    return data.publicUrl;
  }

  async function deleteAttachment(att: ResearchAttachment) {
    if (!confirm(t("rd.attachment_delete_confirm"))) return;
    await supabase.storage.from("research-attachments").remove([att.storage_path]);
    const { error } = await supabase.from("research_attachments").delete().eq("id", att.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("rd.attachment_deleted"));
    router.refresh();
  }

  // ============ Render ============
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/riset" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-1.5">
            <ArrowLeft className="h-3 w-3" /> {t("rd.all_research")}
          </Link>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">{project.code}</p>
          <h1 className="text-lg font-semibold text-foreground mt-0.5">{project.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={cn("text-[11px] border font-medium", meta.tone)}>
              <span className={cn("h-1.5 w-1.5 rounded-full mr-1", meta.dot)} />
              {t(meta.labelKey)}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{t(RESEARCH_TYPE_KEY[project.research_type])}</span>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {canManage && project.status === "proposed" && isAdmin && (
            <Button size="sm" onClick={handleApprove} disabled={busy} className="bg-blue-500 hover:bg-blue-500/90 text-white h-8 text-[12px]">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("rd.approve")}
            </Button>
          )}
          {canManage && project.status === "approved" && (
            <Button size="sm" onClick={handleStart} disabled={busy} className="bg-emerald-500 hover:bg-emerald-500/90 text-white h-8 text-[12px]">
              <Play className="h-3.5 w-3.5 mr-1" /> {t("rd.start")}
            </Button>
          )}
          {canManage && project.status === "active" && (
            <>
              <Button size="sm" variant="outline" onClick={handlePause} disabled={busy} className="h-8 text-[12px] border-border/50">
                <Pause className="h-3.5 w-3.5 mr-1" /> {t("rd.pause")}
              </Button>
              <Button size="sm" onClick={handleComplete} disabled={busy} className="bg-teal-500 hover:bg-teal-500/90 text-white h-8 text-[12px]">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("rd.complete")}
              </Button>
            </>
          )}
          {canManage && project.status === "paused" && (
            <Button size="sm" onClick={handleResume} disabled={busy} className="bg-emerald-500 hover:bg-emerald-500/90 text-white h-8 text-[12px]">
              <Play className="h-3.5 w-3.5 mr-1" /> {t("rd.resume")}
            </Button>
          )}
          {canManage && !["completed", "cancelled"].includes(project.status) && (
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={busy} className="h-8 text-[12px] border-rose-500/50 text-rose-400 hover:bg-rose-500/10">
              <XCircle className="h-3.5 w-3.5 mr-1" /> {t("rd.cancel")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-secondary/50 border border-border/30 p-1 h-auto">
          <TabsTrigger value="overview" className="text-[12px]">{t("rd.tab_overview")}</TabsTrigger>
          <TabsTrigger value="holes" className="text-[12px]">{t("rd.tab_holes")} <span className="ml-1 text-muted-foreground">{activeAlloc.length}</span></TabsTrigger>
          <TabsTrigger value="progress" className="text-[12px]">{t("rd.tab_progress")} <span className="ml-1 text-muted-foreground">{logs.length}</span></TabsTrigger>
          <TabsTrigger value="materials" className="text-[12px]">{t("rd.tab_materials")} <span className="ml-1 text-muted-foreground">{materials.length}</span></TabsTrigger>
          <TabsTrigger value="docs" className="text-[12px]">{t("rd.tab_docs")} <span className="ml-1 text-muted-foreground">{attachments.length}</span></TabsTrigger>
        </TabsList>

        {/* ====== OVERVIEW ====== */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <InfoCard title={t("rd.researcher")}>
            <InfoRow label={t("rd.name")} value={project.researcher_name} />
            <InfoRow label={t("rd.id_no")} value={project.researcher_id_no} />
            <InfoRow label={t("rd.institution")} value={project.institution} />
            <InfoRow label={t("rd.email")} value={project.email} />
            <InfoRow label={t("rd.phone")} value={project.phone} />
          </InfoCard>
          {(project.supervisor_name || project.supervisor_email) && (
            <InfoCard title={t("rd.supervisor")}>
              <InfoRow label={t("rd.name")} value={project.supervisor_name} />
              <InfoRow label={t("rd.email")} value={project.supervisor_email} />
            </InfoCard>
          )}
          <InfoCard title={t("rd.timeline")}>
            <InfoRow label={t("rd.proposed_start")} value={fmtDate(project.proposed_start)} />
            <InfoRow label={t("rd.proposed_end")} value={fmtDate(project.proposed_end)} />
            <InfoRow label={t("rd.actual_start")} value={fmtDate(project.actual_start)} />
            <InfoRow label={t("rd.actual_end")} value={fmtDate(project.actual_end)} />
          </InfoCard>
          {(project.objective || project.description) && (
            <InfoCard title={t("rd.objective_desc")}>
              {project.objective && <p className="text-[13px] text-foreground whitespace-pre-wrap">{project.objective}</p>}
              {project.description && (
                <p className="text-[12px] text-muted-foreground whitespace-pre-wrap pt-2 border-t border-border/30 mt-2">
                  {project.description}
                </p>
              )}
            </InfoCard>
          )}
        </TabsContent>

        {/* ====== LUBANG ====== */}
        <TabsContent value="holes" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">{t("rd.hole_map")}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("rd.hole_map_hint")}
              </p>
            </div>
            {canManage && (
              <Button onClick={() => setShowAlloc(true)} size="sm" className="bg-primary hover:bg-primary/90 text-white h-8 text-[12px]">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("rd.reserve_holes")}
              </Button>
            )}
          </div>

          {/* Mini rack map */}
          <div className="rounded-lg border border-border/40 bg-card p-3">
            <ResearchMiniRackMap
              holes={allHoles.map((h) => ({
                id: h.id, canonical_id: h.canonical_id,
                rack: h.rack, tier: h.tier, lane: h.lane,
                hole_number: h.hole_number, status: h.status,
              }))}
              allocations={allocations.map((a) => ({
                hole_id: a.hole_id,
                treatment_label: a.treatment_label,
                treatment_group: a.treatment_group,
                released_at: a.released_at,
              }))}
            />
          </div>

          {/* Daftar rinci */}
          {activeAlloc.length === 0 && releasedAlloc.length === 0 ? (
            <div className="py-10 text-center rounded-lg border border-dashed border-border/40">
              <Sprout className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[13px] text-muted-foreground">{t("rd.no_reserved")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlloc.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("rd.active_label")} · {activeAlloc.length}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {activeAlloc.map((a) => (
                      <AllocationRow key={a.id} alloc={a} canManage={canManage} onRelease={() => releaseAllocation(a.id)} releaseLabel={t("rd.release")} />
                    ))}
                  </div>
                </div>
              )}
              {releasedAlloc.length > 0 && (
                <div className="space-y-2 pt-3">
                  <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("rd.released_label")} · {releasedAlloc.length}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {releasedAlloc.map((a) => (
                      <AllocationRow key={a.id} alloc={a} canManage={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ====== PROGRES ====== */}
        <TabsContent value="progress" className="mt-4 space-y-3">
          {canManage && (
            <Button onClick={() => setShowLog(true)} size="sm" className="bg-primary hover:bg-primary/90 text-white h-8 text-[12px]">
              <Plus className="h-3.5 w-3.5 mr-1" /> {t("rd.add_log")}
            </Button>
          )}
          {logs.length === 0 ? (
            <div className="py-12 text-center rounded-lg border border-dashed border-border/40">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[13px] text-muted-foreground">{t("rd.no_log")}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {logs.map((log) => {
                const photos = attachments.filter((a) => a.progress_log_id === log.id && a.kind === "photo");
                const m = (log.metrics ?? {}) as Record<string, unknown>;
                const metricChips: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[] = [];
                if (typeof m.ph === "number")               metricChips.push({ icon: Beaker,      label: "pH",              value: String(m.ph) });
                if (typeof m.ec_ms === "number")            metricChips.push({ icon: Droplets,    label: "EC",              value: `${m.ec_ms}` });
                if (typeof m.temp_c === "number")           metricChips.push({ icon: Thermometer, label: t("rd.metric_temp"), value: `${m.temp_c}°C` });
                if (typeof m.humidity_pct === "number")     metricChips.push({ icon: Droplets,    label: "RH",              value: `${m.humidity_pct}%` });
                if (typeof m.plant_height_cm === "number")  metricChips.push({ icon: Ruler,       label: t("rd.metric_height"), value: `${m.plant_height_cm} cm` });
                if (typeof m.leaf_count === "number")       metricChips.push({ icon: Leaf,        label: t("rd.metric_leaves"), value: String(m.leaf_count) });
                const observations = Array.isArray(m.observations) ? (m.observations as string[]) : [];
                const relatedHole = typeof m.related_hole === "string" ? m.related_hole : null;

                return (
                  <li key={log.id} className="rounded-lg border border-border/40 bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                          <span>{fmtDate(log.log_date)}</span>
                          {log.phase && <><ChevronRight className="h-3 w-3" /><span>{t(RESEARCH_PHASE_KEY[log.phase as keyof typeof RESEARCH_PHASE_KEY] ?? log.phase) }</span></>}
                          {relatedHole && (
                            <>
                              <ChevronRight className="h-3 w-3" />
                              <span className="inline-flex items-center gap-1 text-violet-400">
                                <Sprout className="h-3 w-3" />
                                {relatedHole}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-[13px] text-foreground whitespace-pre-wrap mt-1.5">{log.summary}</p>

                        {metricChips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {metricChips.map((chip, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/60 border border-border/40 text-[11px]">
                                <chip.icon className="h-3 w-3 text-primary" />
                                <span className="text-muted-foreground">{chip.label}:</span>
                                <span className="text-foreground font-medium tabular-nums">{chip.value}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {observations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {observations.map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                {OBSERVATION_TAG_KEY[tag] ? t(OBSERVATION_TAG_KEY[tag]) : tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {canManage && (
                        <button onClick={() => deleteLog(log.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {photos.length > 0 && (
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5 mt-3">
                        {photos.map((p) => (
                          <a key={p.id} href={publicUrl(p.storage_path)} target="_blank" rel="noreferrer"
                             className="aspect-square rounded-md bg-secondary overflow-hidden border border-border/40 hover:border-primary/60">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={publicUrl(p.storage_path)} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* ====== MATERIAL ====== */}
        <TabsContent value="materials" className="mt-4 space-y-3">
          {canManage && (
            <div className="rounded-lg border border-border/40 bg-card p-3 space-y-2">
              <p className="text-[12px] font-medium text-foreground">{t("rd.add_material")}</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <Input className="h-10 bg-secondary border-border/50 md:col-span-2" placeholder={t("rd.item_name")} value={matName} onChange={(e) => setMatName(e.target.value)} />
                <Input className="h-10 bg-secondary border-border/50" placeholder={t("rd.qty")} type="number" value={matQty} onChange={(e) => setMatQty(e.target.value)} />
                <Input className="h-10 bg-secondary border-border/50" placeholder={t("rd.unit")} value={matUnit} onChange={(e) => setMatUnit(e.target.value)} />
              </div>
              <Input className="h-10 bg-secondary border-border/50" placeholder={t("rd.notes_optional")} value={matNotes} onChange={(e) => setMatNotes(e.target.value)} />
              <Button size="sm" onClick={handleAddMaterial} disabled={busy} className="h-8 text-[12px] bg-primary hover:bg-primary/90 text-white">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("rd.add")}
              </Button>
            </div>
          )}
          {materials.length === 0 ? (
            <div className="py-12 text-center rounded-lg border border-dashed border-border/40">
              <Package className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[13px] text-muted-foreground">{t("rd.no_material")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30 rounded-lg border border-border/40 bg-card">
              {materials.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] text-foreground truncate">{m.item_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.qty != null ? `${m.qty} ${m.unit ?? ""}` : "-"}
                      {m.notes && ` · ${m.notes}`}
                    </p>
                  </div>
                  {canManage && (
                    <button onClick={() => deleteMaterial(m.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* ====== DOKUMEN ====== */}
        <TabsContent value="docs" className="mt-4 space-y-3">
          {canManage && (
            <label className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary hover:bg-primary/90 text-white text-[12px] cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> {t("rd.upload_file")}
              <input type="file" className="hidden" multiple onChange={handleUploadAttachment} />
            </label>
          )}
          {attachments.length === 0 ? (
            <div className="py-12 text-center rounded-lg border border-dashed border-border/40">
              <Paperclip className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[13px] text-muted-foreground">{t("rd.no_files")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {attachments.map((att) => (
                <div key={att.id} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                  <div className="aspect-square bg-secondary/40 flex items-center justify-center">
                    {att.kind === "photo" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={publicUrl(att.storage_path)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Paperclip className="h-8 w-8 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="p-2 flex items-center justify-between gap-2">
                    <a href={publicUrl(att.storage_path)} target="_blank" rel="noreferrer"
                       className="text-[11px] text-foreground hover:text-primary truncate flex-1" title={att.filename ?? ""}>
                      {att.filename ?? t("rd.file_fallback")}
                    </a>
                    {canManage && (
                      <button onClick={() => deleteAttachment(att)} className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ====== DIALOG: Reservasi Lubang — konfigurasi + picker ====== */}
      <Dialog open={showAlloc} onOpenChange={setShowAlloc}>
        <DialogContent className="sm:max-w-[560px] bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>{t("rd.reserve_dialog_title")}</DialogTitle>
            <p className="text-[12px] text-muted-foreground mt-1">
              {t("rd.reserve_dialog_hint")}
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">{t("rd.treatment_label")}</Label>
                <Input className="h-10 bg-secondary border-border/50" placeholder="K0, P1-EC1.8" value={allocTreatment} onChange={(e) => setAllocTreatment(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">{t("rd.group")}</Label>
                <Input className="h-10 bg-secondary border-border/50" placeholder={t("rd.group_placeholder")} value={allocGroup} onChange={(e) => setAllocGroup(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">{t("rd.from")}</Label>
                <Input type="date" className="h-10 bg-secondary border-border/50" value={allocFrom} onChange={(e) => setAllocFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">{t("rd.until")}</Label>
                <Input type="date" className="h-10 bg-secondary border-border/50" value={allocUntil} onChange={(e) => setAllocUntil(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[12px] text-muted-foreground">{t("rd.holes_selected_label")}</Label>
              {allocHoleIds.size === 0 ? (
                <div className="rounded-lg border border-dashed border-border/40 p-4 text-center text-[12px] text-muted-foreground">
                  {t("rd.no_holes_selected")}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-secondary/30 border border-border/30 max-h-[140px] overflow-y-auto">
                  {Array.from(allocHoleIds).map((id) => {
                    const h = allHoles.find((x) => x.id === id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-[11px] font-medium tabular-nums">
                        {h?.canonical_id ?? `#${id}`}
                        <button type="button" onClick={() => setAllocHoleIds((p) => { const n = new Set(p); n.delete(id); return n; })}
                          className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" className="w-full h-9 mt-1 border-border/50"
                onClick={() => setShowPicker(true)}>
                {allocHoleIds.size > 0 ? t("rd.change_selection") : t("rd.pick_from_map")}
              </Button>
            </div>

            <Button onClick={handleAllocate} disabled={busy || allocHoleIds.size === 0} className="w-full h-10 bg-primary hover:bg-primary/90 text-white">
              {busy ? t("rd.processing") : t("rd.reserve_n").replace("{n}", String(allocHoleIds.size))}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ResearchHolePicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        allHoles={allHoles}
        selectedIds={allocHoleIds}
        onChange={setAllocHoleIds}
        ownedByThisProject={ownedHoleIds}
      />

      {/* ====== DIALOG: Tambah Log ====== */}
      <Dialog open={showLog} onOpenChange={(v) => { setShowLog(v); if (!v) resetLogForm(); }}>
        <DialogContent className="sm:max-w-[560px] bg-card border-border/50 max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
            <DialogTitle>{t("rd.add_log_title")}</DialogTitle>
            <p className="text-[12px] text-muted-foreground mt-1">
              {t("rd.add_log_hint")}
            </p>
          </DialogHeader>

          <div className="px-5 pb-4 overflow-y-auto space-y-4 flex-1">
            {/* Info dasar */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">{t("rd.date")}</Label>
                <Input type="date" className="h-10 bg-secondary border-border/50" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px] text-muted-foreground">{t("rd.phase")}</Label>
                <Select value={logPhase} onValueChange={(v) => v != null && setLogPhase(v)}>
                  <SelectTrigger className="h-10 bg-secondary border-border/50"><SelectValue>{t(RESEARCH_PHASE_KEY[logPhase as keyof typeof RESEARCH_PHASE_KEY] ?? logPhase)}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {RESEARCH_PHASES.map((p) => <SelectItem key={p} value={p}>{t(RESEARCH_PHASE_KEY[p])}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[12px] text-muted-foreground">
                {t("rd.summary")} <span className="text-destructive">*</span>
              </Label>
              <Textarea className="bg-secondary border-border/50" rows={3}
                placeholder={t("rd.summary_placeholder")}
                value={logSummary} onChange={(e) => setLogSummary(e.target.value)} />
            </div>

            {/* Fokus lubang (opsional) — visualisasi peta lubang proyek */}
            {activeAlloc.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] text-muted-foreground">{t("rd.focus_hole")}</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {logHoleId ? <span className="text-primary tabular-nums">{logHoleId}</span> : t("rd.all_holes")}
                  </span>
                </div>
                <FocusHolePicker
                  allocations={activeAlloc}
                  value={logHoleId}
                  onChange={setLogHoleId}
                />
              </div>
            )}

            {/* Metrics */}
            <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <h4 className="text-[12px] font-semibold text-foreground">{t("rd.measurements")}</h4>
              </div>
              <p className="text-[10px] text-muted-foreground">{t("rd.fill_today")}</p>
              <div className="grid grid-cols-3 gap-2">
                <MetricInput icon={Beaker}       label={t("rd.metric_ph")}           value={mPh}        onChange={setMPh}       placeholder="5.8" step="0.1" />
                <MetricInput icon={Droplets}     label={t("rd.metric_ec")}           value={mEc}        onChange={setMEc}       placeholder="1.8" step="0.01" />
                <MetricInput icon={Thermometer}  label={t("rd.metric_temp_c")}       value={mTemp}      onChange={setMTemp}     placeholder="24"  step="0.1" />
                <MetricInput icon={Droplets}     label={t("rd.metric_rh")}           value={mHumidity}  onChange={setMHumidity} placeholder="65"  step="1" />
                <MetricInput icon={Ruler}        label={t("rd.metric_height_cm")}    value={mHeight}    onChange={setMHeight}   placeholder="12"  step="0.1" />
                <MetricInput icon={Leaf}         label={t("rd.metric_leaf_count")}   value={mLeafCount} onChange={setMLeafCount} placeholder="8"  step="1" />
              </div>
            </div>

            {/* Observation tags */}
            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground">{t("rd.observations")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {OBSERVATION_TAGS.map((tag) => {
                  const active = logObservations.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleObservation(tag)}
                      className={cn(
                        "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                        active
                          ? "bg-primary/15 border-primary text-primary"
                          : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                      )}
                    >
                      {OBSERVATION_TAG_KEY[tag] ? t(OBSERVATION_TAG_KEY[tag]) : tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Foto multi */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[12px] text-muted-foreground">{t("rd.photos_optional")}</Label>
                <label className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-secondary border border-border/50 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                  <Camera className="h-3.5 w-3.5" /> {t("rd.add")}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onLogPhoto} />
                </label>
              </div>
              {logPhotos.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {logPhotos.map((ph, i) => (
                    <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-secondary group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.dataUrl} alt="" className="w-full h-full object-cover" />
                      <button type="button"
                        onClick={() => setLogPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground text-center py-3 rounded border border-dashed border-border/40">
                  {t("rd.no_photos")}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-border/30 px-5 py-3 shrink-0">
            <Button onClick={handleAddLog} disabled={busy} className="w-full h-10 bg-primary hover:bg-primary/90 text-white">
              {busy ? t("rd.saving") : t("rd.save_log")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card">
      <div className="px-4 py-2.5 border-b border-border/30">
        <h3 className="text-[12px] font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline gap-3 text-[12px]">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-foreground">{value || <span className="text-muted-foreground/60">—</span>}</span>
    </div>
  );
}

function AllocationRow({ alloc, canManage, onRelease, releaseLabel }: { alloc: AllocationWithHole; canManage: boolean; onRelease?: () => void; releaseLabel?: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-card px-3 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground tabular-nums">
          {alloc.holes?.canonical_id ?? `hole#${alloc.hole_id}`}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {alloc.treatment_label ?? "—"}
          {alloc.treatment_group && ` · ${alloc.treatment_group}`}
          <span className="inline-flex items-center gap-1 ml-2">
            <Calendar className="h-3 w-3" />
            {fmtDate(alloc.reserved_from)} → {fmtDate(alloc.reserved_until)}
          </span>
        </p>
      </div>
      {canManage && onRelease && (
        <Button size="sm" variant="ghost" onClick={onRelease} className="h-7 text-[11px] text-muted-foreground hover:text-rose-400">
          {releaseLabel ?? "Lepas"}
        </Button>
      )}
    </div>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function FocusHolePicker({
  allocations, value, onChange,
}: {
  allocations: AllocationWithHole[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useLang();
  // Group: rack → tier → lane → allocations
  type LaneGroup = { lane: number; items: AllocationWithHole[] };
  type TierGroup = { tier: number; lanes: LaneGroup[] };
  type RackGroup = { rack: string; tiers: TierGroup[] };
  const groups: RackGroup[] = (() => {
    const rackMap = new Map<string, Map<number, Map<number, AllocationWithHole[]>>>();
    for (const a of allocations) {
      const rack = a.holes?.rack;
      const tier = a.holes?.tier;
      const lane = a.holes?.lane;
      if (!rack || tier == null || lane == null) continue;
      if (!rackMap.has(rack)) rackMap.set(rack, new Map());
      const tierMap = rackMap.get(rack)!;
      if (!tierMap.has(tier)) tierMap.set(tier, new Map());
      const laneMap = tierMap.get(tier)!;
      if (!laneMap.has(lane)) laneMap.set(lane, []);
      laneMap.get(lane)!.push(a);
    }
    return Array.from(rackMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([rack, tierMap]) => ({
        rack,
        tiers: Array.from(tierMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([tier, laneMap]) => ({
            tier,
            lanes: Array.from(laneMap.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([lane, items]) => ({
                lane,
                items: items.sort((p, q) => (p.holes?.hole_number ?? 0) - (q.holes?.hole_number ?? 0)),
              })),
          })),
      }));
  })();

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2.5">
      {/* Semua lubang chip */}
      <button
        type="button"
        onClick={() => onChange("")}
        className={cn(
          "text-[11px] px-3 py-1 rounded-full border transition-colors",
          !value
            ? "bg-primary/15 border-primary text-primary"
            : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
        )}
      >
        {t("rd.all_holes")} · {allocations.length}
      </button>

      {groups.map((rack) => (
        <div key={rack.rack} className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("rmap.rack_label")} {rack.rack}</p>
          {rack.tiers.map((t) => (
            <div key={t.tier} className="space-y-1">
              {t.lanes.map((ln) => (
                <div key={ln.lane} className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground w-14 shrink-0 tabular-nums">
                    T{t.tier}·L{ln.lane}
                  </span>
                  {ln.items.map((a) => {
                    const cid = a.holes?.canonical_id ?? `#${a.hole_id}`;
                    const selected = value === cid;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onChange(cid)}
                        title={`${cid}${a.treatment_label ? ` · ${a.treatment_label}` : ""}${a.treatment_group ? ` · ${a.treatment_group}` : ""}`}
                        className={cn(
                          "h-8 min-w-[36px] px-1.5 rounded-md border text-[10px] font-medium tabular-nums transition-colors flex flex-col items-center justify-center",
                          selected
                            ? "bg-primary text-white border-primary"
                            : "bg-secondary/60 border-border/40 text-foreground hover:border-primary/50"
                        )}
                      >
                        <span className="leading-none">{a.holes?.hole_number ?? "-"}</span>
                        {a.treatment_label && (
                          <span className={cn(
                            "text-[8px] leading-none mt-0.5",
                            selected ? "text-white/80" : "text-muted-foreground"
                          )}>
                            {a.treatment_label.slice(0, 4)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MetricInput({
  icon: Icon, label, value, onChange, placeholder, step,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
        <Icon className="h-3 w-3 text-primary" />
        {label}
      </Label>
      <Input
        type="number"
        step={step}
        className="h-9 bg-secondary border-border/50 text-[13px] tabular-nums"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
