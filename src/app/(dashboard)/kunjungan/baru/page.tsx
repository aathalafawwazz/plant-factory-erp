"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FloatingForm } from "@/components/floating-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { VISIT_TYPE_META, VISIT_AREAS, VISIT_AREA_KEY, VISIT_STATUS_META } from "@/lib/visit-meta";
import type { VisitType, VisitStatus } from "@/lib/types/database";
import { UserCheck, Plus, X, Phone, Mail, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

interface ContactDraft {
  name: string;
  role: string;
  email: string;
  phone: string;
  is_primary: boolean;
}

export default function NewVisitPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLang();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Core
  const [visitType, setVisitType] = useState<VisitType>("tour");
  const [purpose, setPurpose] = useState("");
  const [organization, setOrganization] = useState("");
  const [groupSize, setGroupSize] = useState("1");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");

  // Status & host
  const [status, setStatus] = useState<VisitStatus>("scheduled");
  const [hostName, setHostName] = useState("");

  // Areas
  const [areas, setAreas] = useState<Set<string>>(new Set(["Ruang Produksi"]));

  // Contacts
  const [contacts, setContacts] = useState<ContactDraft[]>([
    { name: "", role: "", email: "", phone: "", is_primary: true },
  ]);

  // Notes
  const [notes, setNotes] = useState("");

  function toggleArea(a: string) {
    setAreas((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a); else next.add(a);
      return next;
    });
  }

  function addContact() {
    setContacts((prev) => [...prev, { name: "", role: "", email: "", phone: "", is_primary: false }]);
  }
  function removeContact(idx: number) {
    setContacts((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateContact(idx: number, patch: Partial<ContactDraft>) {
    setContacts((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      return { ...c, ...patch };
    }));
  }
  function setPrimary(idx: number) {
    setContacts((prev) => prev.map((c, i) => ({ ...c, is_primary: i === idx })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!purpose.trim()) errs.purpose = t("visit.purpose_required");
    if (!organization.trim()) errs.organization = t("visit.org_required");
    if (!visitDate) errs.visitDate = t("visit.date_required");
    if (Number(groupSize) < 1) errs.groupSize = t("visit.group_min");
    if (startTime && endTime && endTime <= startTime) errs.endTime = t("visit.end_after_start");

    const validContacts = contacts.filter((c) => c.name.trim());
    if (validContacts.length === 0) errs.contacts = t("visit.contact_required");
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: visit, error } = await supabase
      .from("visits")
      .insert({
        visit_type: visitType,
        purpose: purpose.trim(),
        organization: organization.trim(),
        group_size: Number(groupSize),
        visit_date: visitDate,
        start_time: startTime || null,
        end_time: endTime || null,
        host_name: hostName.trim() || null,
        areas_visited: areas.size > 0 ? Array.from(areas) : null,
        status,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single();

    if (error || !visit) {
      setLoading(false);
      console.error("[kunjungan-baru] insert error:", error);
      toast.error(t("visit.save_failed") + (error?.message ?? "unknown"));
      return;
    }

    // Insert contacts
    if (validContacts.length > 0) {
      // Pastikan hanya 1 primary
      const hasPrimary = validContacts.some((c) => c.is_primary);
      const rows = validContacts.map((c, i) => ({
        visit_id: visit.id,
        name: c.name.trim(),
        role: c.role.trim() || null,
        email: c.email.trim() || null,
        phone: c.phone.trim() || null,
        is_primary: hasPrimary ? c.is_primary : i === 0,
      }));
      const { error: cErr } = await supabase.from("visit_contacts").insert(rows);
      if (cErr) {
        console.error("[kunjungan-baru] contact insert error:", cErr);
        toast.warning(t("visit.contact_save_warn") + cErr.message);
      }
    }

    setLoading(false);
    toast.success(t("visit.save_success").replace("{code}", visit.code));
    router.push(`/kunjungan/${visit.id}`);
    router.refresh();
  }

  return (
    <FloatingForm title={t("visit.record_title")} backHref="/kunjungan">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Info utama */}
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5">
            <UserCheck className="h-4 w-4 text-primary" /> {t("visit.info_section")}
          </h3>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">{t("visit.visit_type_label")}</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(VISIT_TYPE_META) as VisitType[]).map((vt) => {
                const m = VISIT_TYPE_META[vt];
                const selected = visitType === vt;
                return (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => setVisitType(vt)}
                    title={t(m.labelKey)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 px-1.5 py-2 h-[64px] rounded-md border-2 text-[11px] text-center leading-tight transition-colors",
                      selected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border/40 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    <span className="text-lg leading-none">{m.emoji}</span>
                    <span className="truncate max-w-full">{t(m.shortLabelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">{t("visit.purpose_label")} <span className="text-destructive">*</span></Label>
            <Input
              className={cn("h-11 bg-secondary border-border/50", errors.purpose && "border-destructive")}
              placeholder={t("visit.purpose_placeholder")}
              value={purpose}
              onChange={(e) => { setPurpose(e.target.value); setErrors((p) => ({ ...p, purpose: "" })); }}
            />
            {errors.purpose && <p className="text-[11px] text-destructive">{errors.purpose}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label className="text-[13px] text-muted-foreground">{t("visit.organization_label")} <span className="text-destructive">*</span></Label>
              <Input
                className={cn("h-11 bg-secondary border-border/50", errors.organization && "border-destructive")}
                placeholder={t("visit.organization_placeholder")}
                value={organization}
                onChange={(e) => { setOrganization(e.target.value); setErrors((p) => ({ ...p, organization: "" })); }}
              />
              {errors.organization && <p className="text-[11px] text-destructive">{errors.organization}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("visit.guest_count_label")}</Label>
              <Input
                type="number" min="1"
                className={cn("h-11 bg-secondary border-border/50", errors.groupSize && "border-destructive")}
                value={groupSize}
                onChange={(e) => { setGroupSize(e.target.value); setErrors((p) => ({ ...p, groupSize: "" })); }}
              />
              {errors.groupSize && <p className="text-[11px] text-destructive">{errors.groupSize}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("visit.pic_label")}</Label>
              <Input
                className="h-11 bg-secondary border-border/50"
                placeholder={t("visit.pic_placeholder")}
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Jadwal */}
        <section className="space-y-3 pt-2 border-t border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground pt-2">{t("visit.schedule_section")}</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("visit.date_label")} <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                className={cn("h-11 bg-secondary border-border/50", errors.visitDate && "border-destructive")}
                value={visitDate}
                onChange={(e) => { setVisitDate(e.target.value); setErrors((p) => ({ ...p, visitDate: "" })); }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("visit.start_time")}</Label>
              <Input type="time" className="h-11 bg-secondary border-border/50" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{t("visit.end_time")}</Label>
              <Input
                type="time"
                className={cn("h-11 bg-secondary border-border/50", errors.endTime && "border-destructive")}
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); setErrors((p) => ({ ...p, endTime: "" })); }}
              />
              {errors.endTime && <p className="text-[11px] text-destructive">{errors.endTime}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">{t("visit.initial_status")}</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as VisitStatus)}>
              <SelectTrigger className="h-11 bg-secondary border-border/50">
                <SelectValue>{t(VISIT_STATUS_META[status].labelKey)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">{t(VISIT_STATUS_META.scheduled.labelKey)}</SelectItem>
                <SelectItem value="confirmed">{t(VISIT_STATUS_META.confirmed.labelKey)}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {t("visit.confirmed_hint")}
            </p>
          </div>
        </section>

        {/* Area */}
        <section className="space-y-3 pt-2 border-t border-border/30">
          <h3 className="text-[13px] font-semibold text-foreground pt-2">{t("visit.area_section")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {VISIT_AREAS.map((a) => {
              const selected = areas.has(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleArea(a)}
                  className={cn(
                    "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                    selected
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  {t(VISIT_AREA_KEY[a])}
                </button>
              );
            })}
          </div>
        </section>

        {/* Kontak */}
        <section className="space-y-3 pt-2 border-t border-border/30">
          <div className="flex items-center justify-between pt-2">
            <h3 className="text-[13px] font-semibold text-foreground">
              {t("visit.contacts_section")} <span className="text-destructive">*</span>
            </h3>
            <Button type="button" variant="outline" size="sm" className="h-8 text-[11px] border-border/50" onClick={addContact}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t("visit.add_contact")}
            </Button>
          </div>
          {errors.contacts && <p className="text-[11px] text-destructive">{errors.contacts}</p>}

          <div className="space-y-2">
            {contacts.map((c, i) => (
              <div key={i} className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                    <input
                      type="radio"
                      checked={c.is_primary}
                      onChange={() => setPrimary(i)}
                      className="accent-primary"
                    />
                    {t("visit.primary_contact")}
                  </label>
                  {contacts.length > 1 && (
                    <button type="button" onClick={() => removeContact(i)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <LabeledInput icon={User} placeholder={t("visit.contact_name_placeholder")} value={c.name}
                    onChange={(v) => updateContact(i, { name: v })} />
                  <LabeledInput placeholder={t("visit.contact_role_placeholder")} value={c.role}
                    onChange={(v) => updateContact(i, { role: v })} />
                  <LabeledInput icon={Mail} type="email" placeholder="Email" value={c.email}
                    onChange={(v) => updateContact(i, { email: v })} />
                  <LabeledInput icon={Phone} type="tel" placeholder={t("visit.contact_phone_placeholder")} value={c.phone}
                    onChange={(v) => updateContact(i, { phone: v })} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Catatan */}
        <section className="space-y-3 pt-2 border-t border-border/30">
          <Label className="text-[13px] font-semibold text-foreground pt-2 block">{t("visit.notes_optional")}</Label>
          <Textarea
            className="bg-secondary border-border/50"
            placeholder={t("visit.notes_placeholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </section>

        <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white" disabled={loading}>
          {loading ? t("visit.saving") : t("visit.save_visit_btn")}
        </Button>
      </form>
    </FloatingForm>
  );
}

function LabeledInput({
  icon: Icon, placeholder, value, onChange, type = "text",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />}
      <Input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-10 bg-secondary border-border/50", Icon && "pl-8")}
      />
    </div>
  );
}
