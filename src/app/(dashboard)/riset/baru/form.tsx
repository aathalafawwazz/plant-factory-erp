"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FloatingForm } from "@/components/floating-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RESEARCH_TYPE_KEY } from "@/lib/research-meta";
import type { ResearchType } from "@/lib/types/database";
import { Sprout, X, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResearchHolePicker, type HolePickerOption } from "@/components/research-hole-picker";
import { useLang } from "@/lib/i18n";
import { translateCommodity } from "@/lib/translate-helpers";

export type { HolePickerOption };

export interface CropOption {
  id: number;
  name_id: string;
  grow_duration_days: number | null;
}

interface Props {
  allHoles: HolePickerOption[];
  crops: CropOption[];
}

export function NewResearchForm({ allHoles, crops }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [researchType, setResearchType] = useState<ResearchType>("skripsi");
  const [objective, setObjective] = useState("");

  // Peneliti
  const [researcherName, setResearcherName] = useState("");
  const [researcherIdNo, setResearcherIdNo] = useState("");
  const [institution, setInstitution] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Pembimbing
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorEmail, setSupervisorEmail] = useState("");

  // Timeline
  const [proposedStart, setProposedStart] = useState("");
  const [proposedEnd, setProposedEnd] = useState("");

  // Lubang tanam
  const [useHoles, setUseHoles] = useState<"ya" | "tidak">("ya");
  const [cropId, setCropId] = useState("");
  const [treatmentLabel, setTreatmentLabel] = useState("");
  const [pickedHoleIds, setPickedHoleIds] = useState<Set<number>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);

  const pickedList = useMemo(
    () => allHoles.filter((h) => pickedHoleIds.has(h.id)),
    [allHoles, pickedHoleIds]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = t("research.title_required");
    if (!researcherName.trim()) errs.researcherName = t("research.researcher_required");
    if (proposedStart && proposedEnd && new Date(proposedEnd) < new Date(proposedStart)) {
      errs.proposedEnd = t("research.end_after_start");
    }
    if (useHoles === "ya") {
      if (pickedHoleIds.size === 0) errs.holes = t("research.pick_at_least_one");
      if (!proposedStart || !proposedEnd) errs.proposedEnd = t("research.period_required");
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Insert proyek
    const { data: project, error } = await supabase
      .from("research_projects")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        research_type: researchType,
        objective: objective.trim() || null,
        researcher_user_id: user?.id ?? null,
        researcher_name: researcherName.trim(),
        researcher_id_no: researcherIdNo.trim() || null,
        institution: institution.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        supervisor_name: supervisorName.trim() || null,
        supervisor_email: supervisorEmail.trim() || null,
        proposed_start: proposedStart || null,
        proposed_end: proposedEnd || null,
        status: "proposed",
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error || !project) {
      setLoading(false);
      console.error("[riset-baru]", error);
      toast.error(t("research.submit_failed") + (error?.message ?? "unknown"));
      return;
    }

    // 2. Reservasi lubang (jika ada)
    if (useHoles === "ya" && pickedHoleIds.size > 0) {
      const rows = Array.from(pickedHoleIds).map((hole_id) => ({
        research_id: project.id,
        hole_id,
        treatment_label: treatmentLabel.trim() || null,
        reserved_from: proposedStart,
        reserved_until: proposedEnd,
        created_by: user?.id ?? null,
      }));
      const { error: allocErr } = await supabase.from("research_hole_allocations").insert(rows);
      if (allocErr) {
        console.error("[riset-baru] alloc error:", allocErr);
        toast.warning(t("research.alloc_failed") + allocErr.message);
      }
    }

    setLoading(false);
    toast.success(t("research.submit_success").replace("{code}", project.code));
    router.push(`/riset/${project.id}`);
    router.refresh();
  }

  return (
    <FloatingForm title={t("research.submit_title")} backHref="/riset">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Info utama */}
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4 text-primary" /> {t("research.project_info")}
          </h3>
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">{t("research.title_label")} <span className="text-destructive">*</span></Label>
            <Input
              className={`h-11 bg-secondary border-border/50 ${errors.title ? "border-destructive" : ""}`}
              placeholder={t("research.title_placeholder")}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); }}
            />
            {errors.title && <p className="text-[11px] text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">{t("research.type")}</Label>
            <Select value={researchType} onValueChange={(v) => v && setResearchType(v as ResearchType)}>
              <SelectTrigger className="h-11 bg-secondary border-border/50">
                <SelectValue>{t(RESEARCH_TYPE_KEY[researchType])}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RESEARCH_TYPE_KEY) as ResearchType[]).map((rt) => (
                  <SelectItem key={rt} value={rt}>{t(RESEARCH_TYPE_KEY[rt])}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">{t("research.objective_label")}</Label>
            <Textarea
              className="bg-secondary border-border/50"
              placeholder={t("research.objective_placeholder")}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">{t("research.description_optional")}</Label>
            <Textarea
              className="bg-secondary border-border/50"
              placeholder={t("research.description_placeholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </section>

        {/* Peneliti */}
        <section className="space-y-3 pt-2 border-t border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground pt-2">{t("research.primary_researcher")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label className="text-[13px] text-muted-foreground">{t("research.full_name")} <span className="text-destructive">*</span></Label>
              <Input
                className={`h-11 bg-secondary border-border/50 ${errors.researcherName ? "border-destructive" : ""}`}
                placeholder={t("research.researcher_name_placeholder")}
                value={researcherName}
                onChange={(e) => { setResearcherName(e.target.value); setErrors((p) => ({ ...p, researcherName: "" })); }}
              />
              {errors.researcherName && <p className="text-[11px] text-destructive">{errors.researcherName}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("research.student_id")}</Label>
              <Input className="h-11 bg-secondary border-border/50" value={researcherIdNo} onChange={(e) => setResearcherIdNo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("research.institution")}</Label>
              <Input className="h-11 bg-secondary border-border/50" placeholder={t("research.institution_placeholder")} value={institution} onChange={(e) => setInstitution(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Email</Label>
              <Input type="email" className="h-11 bg-secondary border-border/50" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("research.phone")}</Label>
              <Input className="h-11 bg-secondary border-border/50" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Pembimbing */}
        <section className="space-y-3 pt-2 border-t border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground pt-2">{t("research.supervisor_section")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("research.supervisor_name")}</Label>
              <Input className="h-11 bg-secondary border-border/50" value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Email</Label>
              <Input type="email" className="h-11 bg-secondary border-border/50" value={supervisorEmail} onChange={(e) => setSupervisorEmail(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="space-y-3 pt-2 border-t border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground pt-2">{t("research.timeline_plan")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("research.start_date")}</Label>
              <Input type="date" className="h-11 bg-secondary border-border/50" value={proposedStart} onChange={(e) => setProposedStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("research.end_date")}</Label>
              <Input type="date" className={`h-11 bg-secondary border-border/50 ${errors.proposedEnd ? "border-destructive" : ""}`}
                value={proposedEnd} onChange={(e) => { setProposedEnd(e.target.value); setErrors((p) => ({ ...p, proposedEnd: "" })); }} />
              {errors.proposedEnd && <p className="text-[11px] text-destructive">{errors.proposedEnd}</p>}
            </div>
          </div>
        </section>

        {/* ====== LUBANG TANAM ====== */}
        <section className="space-y-3 pt-2 border-t border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground pt-2 inline-flex items-center gap-1.5">
            <Sprout className="h-4 w-4 text-emerald-400" /> {t("research.hole_usage")}
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUseHoles("ya")}
              className={cn(
                "h-16 rounded-lg border-2 px-3 text-left transition-colors",
                useHoles === "ya"
                  ? "border-primary bg-primary/5"
                  : "border-border/40 bg-secondary/30 hover:border-border"
              )}
            >
              <p className="text-[13px] font-medium text-foreground">{t("research.use_holes_yes")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("research.use_holes_yes_sub")}</p>
            </button>
            <button
              type="button"
              onClick={() => { setUseHoles("tidak"); setPickedHoleIds(new Set()); }}
              className={cn(
                "h-16 rounded-lg border-2 px-3 text-left transition-colors",
                useHoles === "tidak"
                  ? "border-primary bg-primary/5"
                  : "border-border/40 bg-secondary/30 hover:border-border"
              )}
            >
              <p className="text-[13px] font-medium text-foreground">{t("research.use_holes_no")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t("research.use_holes_no_sub")}</p>
            </button>
          </div>

          {useHoles === "ya" && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">{t("research.primary_commodity")}</Label>
                  <Select value={cropId} onValueChange={(v) => v && setCropId(v)}>
                    <SelectTrigger className="h-11 bg-secondary border-border/50">
                      <SelectValue placeholder={t("research.select_commodity_placeholder")}>
                        {cropId && translateCommodity(crops.find((c) => String(c.id) === cropId)?.name_id ?? "", lang)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {crops.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {translateCommodity(c.name_id, lang)} ({c.grow_duration_days} {t("unit.days")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {t("research.saved_as_note")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">{t("research.treatment_label")}</Label>
                  <Input
                    className="h-11 bg-secondary border-border/50"
                    placeholder="K0, P1-EC1.8"
                    value={treatmentLabel}
                    onChange={(e) => setTreatmentLabel(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t("research.treatment_label_note")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px] text-muted-foreground">
                    {t("research.holes_picked")} ({pickedHoleIds.size})
                  </Label>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-[12px] border-border/50"
                    onClick={() => setPickerOpen(true)}>
                    {pickedHoleIds.size > 0 ? t("research.change_selection") : t("research.pick_from_map")}
                  </Button>
                </div>
                {pickedList.length === 0 ? (
                  <div className={cn(
                    "rounded-lg border border-dashed p-4 text-center text-[12px]",
                    errors.holes ? "border-destructive text-destructive" : "border-border/40 text-muted-foreground"
                  )}>
                    {errors.holes || t("research.no_holes_picked")}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-secondary/30 border border-border/30">
                    {pickedList.map((h) => (
                      <span key={h.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-[11px] font-medium tabular-nums">
                        {h.canonical_id}
                        <button type="button" onClick={() => {
                          setPickedHoleIds((p) => { const n = new Set(p); n.delete(h.id); return n; });
                        }} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white" disabled={loading}>
          {loading ? t("research.submitting") : t("research.submit_btn")}
        </Button>
      </form>

      <ResearchHolePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        allHoles={allHoles}
        selectedIds={pickedHoleIds}
        onChange={setPickedHoleIds}
      />
    </FloatingForm>
  );
}
