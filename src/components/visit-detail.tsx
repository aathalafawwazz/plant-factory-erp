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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Calendar, Clock, Users, User, Mail, Phone, MapPin,
  CheckCircle2, XCircle, LogIn, LogOut as LogOutIcon, Star, Plus, Trash2,
  Paperclip, Camera, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VISIT_STATUS_META, VISIT_TYPE_META, VISIT_AREAS, VISIT_AREA_KEY } from "@/lib/visit-meta";
import { useLang } from "@/lib/i18n";
import type {
  Visit, VisitContact, VisitAttachment, VisitStatus, VisitType,
} from "@/lib/types/database";

interface Props {
  visit: Visit;
  contacts: VisitContact[];
  attachments: VisitAttachment[];
  currentUserId: string | null;
  currentUserRole: string;
}

export function VisitDetail({
  visit, contacts, attachments, currentUserId, currentUserRole,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLang();

  const canManage = currentUserRole === "admin" || currentUserRole === "operator";
  const meta = VISIT_STATUS_META[visit.status as VisitStatus];
  const typeMeta = VISIT_TYPE_META[visit.visit_type as VisitType];

  const [busy, setBusy] = useState(false);

  async function changeStatus(
    newStatus: VisitStatus,
    extra: Record<string, unknown> = {}
  ) {
    setBusy(true);
    const { error } = await supabase.from("visits").update({ status: newStatus, ...extra }).eq("id", visit.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${t("vd.status_changed_to")} ${t(VISIT_STATUS_META[newStatus].labelKey)}`);
    router.refresh();
  }

  async function handleConfirm()   { await changeStatus("confirmed"); }
  async function handleCheckIn()   {
    await changeStatus("ongoing", { checked_in_at: new Date().toISOString() });
  }
  async function handleCheckOut()  {
    await changeStatus("completed", { checked_out_at: new Date().toISOString() });
  }
  async function handleNoShow()    {
    if (!confirm(t("vd.no_show_confirm"))) return;
    await changeStatus("no_show");
  }
  async function handleCancel()    {
    if (!confirm(t("vd.cancel_confirm"))) return;
    await changeStatus("cancelled");
  }

  // Kontak — tambah kontak baru inline
  const [newContact, setNewContact] = useState({ name: "", role: "", email: "", phone: "" });
  async function addContact() {
    if (!newContact.name.trim()) { toast.error(t("vd.contact_name_required")); return; }
    setBusy(true);
    const { error } = await supabase.from("visit_contacts").insert({
      visit_id: visit.id,
      name: newContact.name.trim(),
      role: newContact.role.trim() || null,
      email: newContact.email.trim() || null,
      phone: newContact.phone.trim() || null,
      is_primary: contacts.length === 0,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("vd.contact_added"));
    setNewContact({ name: "", role: "", email: "", phone: "" });
    router.refresh();
  }

  async function deleteContact(id: number) {
    if (!confirm(t("vd.contact_delete_confirm"))) return;
    setBusy(true);
    const { error } = await supabase.from("visit_contacts").delete().eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    router.refresh();
  }

  // Feedback
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbRating, setFbRating] = useState<number>(visit.feedback_rating ?? 0);
  const [fbNotes, setFbNotes] = useState<string>(visit.feedback_notes ?? "");

  async function saveFeedback() {
    if (fbRating < 1 || fbRating > 5) { toast.error(t("vd.rating_range")); return; }
    setBusy(true);
    const { error } = await supabase.from("visits").update({
      feedback_rating: fbRating,
      feedback_notes: fbNotes.trim() || null,
    }).eq("id", visit.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("vd.feedback_saved"));
    setShowFeedback(false);
    router.refresh();
  }

  // Attachments
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    for (const f of files) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "bin";
      const kind: "photo" | "document" | "signature" =
        /(jpg|jpeg|png|webp|heic)$/.test(ext) ? "photo" : "document";
      const path = `${visit.id}/${Date.now()}-${f.name}`;
      const { error: upErr } = await supabase.storage
        .from("visit-photos")
        .upload(path, f, { contentType: f.type || "application/octet-stream" });
      if (upErr) { toast.error(`${f.name}: ${upErr.message}`); continue; }
      await supabase.from("visit_attachments").insert({
        visit_id: visit.id,
        kind,
        storage_path: path,
        filename: f.name,
        uploaded_by: currentUserId,
      });
    }
    setBusy(false);
    e.target.value = "";
    toast.success(t("vd.attachment_uploaded").replace("{n}", String(files.length)));
    router.refresh();
  }

  function publicUrl(path: string): string {
    const { data } = supabase.storage.from("visit-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function deleteAttachment(att: VisitAttachment) {
    if (!confirm(t("vd.attachment_delete_confirm"))) return;
    await supabase.storage.from("visit-photos").remove([att.storage_path]);
    const { error } = await supabase.from("visit_attachments").delete().eq("id", att.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("vd.attachment_deleted"));
    router.refresh();
  }

  // Timing calc
  const durationMin =
    visit.checked_in_at && visit.checked_out_at
      ? Math.round((new Date(visit.checked_out_at).getTime() - new Date(visit.checked_in_at).getTime()) / 60000)
      : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href="/kunjungan" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground mb-1.5">
            <ArrowLeft className="h-3 w-3" /> {t("vd.all_visits")}
          </Link>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">{visit.code}</p>
          <h1 className="text-lg font-semibold text-foreground mt-0.5 inline-flex items-center gap-2">
            <span className="text-2xl">{typeMeta.emoji}</span>
            {visit.organization}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{visit.purpose}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={cn("text-[11px] border font-medium", meta.tone)}>
              <span className={cn("h-1.5 w-1.5 rounded-full mr-1", meta.dot)} />
              {t(meta.labelKey)}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{t(typeMeta.labelKey)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {canManage && visit.status === "scheduled" && (
            <Button size="sm" onClick={handleConfirm} disabled={busy} className="bg-blue-500 hover:bg-blue-500/90 text-white h-8 text-[12px]">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t("vd.confirm")}
            </Button>
          )}
          {canManage && (visit.status === "scheduled" || visit.status === "confirmed") && (
            <>
              <Button size="sm" onClick={handleCheckIn} disabled={busy} className="bg-emerald-500 hover:bg-emerald-500/90 text-white h-8 text-[12px]">
                <LogIn className="h-3.5 w-3.5 mr-1" /> {t("vd.checkin")}
              </Button>
              <Button size="sm" variant="outline" onClick={handleNoShow} disabled={busy} className="h-8 text-[12px] border-zinc-500/50 text-zinc-400 hover:bg-zinc-500/10">
                {t("vd.no_show")}
              </Button>
            </>
          )}
          {canManage && visit.status === "ongoing" && (
            <Button size="sm" onClick={handleCheckOut} disabled={busy} className="bg-teal-500 hover:bg-teal-500/90 text-white h-8 text-[12px]">
              <LogOutIcon className="h-3.5 w-3.5 mr-1" /> {t("vd.checkout")}
            </Button>
          )}
          {canManage && visit.status === "completed" && (
            <Button size="sm" onClick={() => setShowFeedback(true)} disabled={busy} className="bg-amber-400 hover:bg-amber-400/90 text-black h-8 text-[12px]">
              <Star className="h-3.5 w-3.5 mr-1" />
              {visit.feedback_rating ? t("vd.edit_feedback") : t("vd.fill_feedback")}
            </Button>
          )}
          {canManage && !["completed", "cancelled", "no_show"].includes(visit.status) && (
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={busy} className="h-8 text-[12px] border-rose-500/50 text-rose-400 hover:bg-rose-500/10">
              <XCircle className="h-3.5 w-3.5 mr-1" /> {t("vd.cancel")}
            </Button>
          )}
        </div>
      </div>

      {/* Quick info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoTile icon={Calendar} label={t("vd.date")} value={fmtDate(visit.visit_date)} />
        <InfoTile
          icon={Clock}
          label={t("vd.time")}
          value={
            visit.start_time || visit.end_time
              ? `${(visit.start_time ?? "—").slice(0, 5)} – ${(visit.end_time ?? "—").slice(0, 5)}`
              : "—"
          }
        />
        <InfoTile icon={Users} label={t("vd.guest_count")} value={`${visit.group_size} ${t("vd.guest_count_suffix")}`} />
        <InfoTile icon={User} label={t("vd.host")} value={visit.host_name ?? "—"} />
      </div>

      {/* Check-in/out timeline */}
      {(visit.checked_in_at || visit.checked_out_at) && (
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{t("vd.actual_timeline")}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12px]">
            <div className="space-y-0.5">
              <p className="text-muted-foreground">{t("vd.checkin")}</p>
              <p className="text-foreground font-medium tabular-nums">
                {visit.checked_in_at ? fmtDateTime(visit.checked_in_at) : "—"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">{t("vd.checkout")}</p>
              <p className="text-foreground font-medium tabular-nums">
                {visit.checked_out_at ? fmtDateTime(visit.checked_out_at) : "—"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-muted-foreground">{t("vd.duration")}</p>
              <p className="text-foreground font-medium tabular-nums">
                {durationMin != null ? `${durationMin} ${t("vd.minutes")}` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="detail">
        <TabsList className="bg-secondary/50 border border-border/30 p-1 h-auto">
          <TabsTrigger value="detail"  className="text-[12px]">{t("vd.tab_detail")}</TabsTrigger>
          <TabsTrigger value="contacts" className="text-[12px]">{t("vd.tab_contacts")} <span className="ml-1 text-muted-foreground">{contacts.length}</span></TabsTrigger>
          <TabsTrigger value="docs"    className="text-[12px]">{t("vd.tab_docs")} <span className="ml-1 text-muted-foreground">{attachments.length}</span></TabsTrigger>
          {visit.status === "completed" && visit.feedback_rating != null && (
            <TabsTrigger value="feedback" className="text-[12px]">
              {t("vd.tab_feedback")}
              <span className="ml-1 inline-flex items-center gap-0.5 text-amber-400">
                <Star className="h-2.5 w-2.5 fill-amber-400" />
                {visit.feedback_rating}
              </span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* ====== DETAIL ====== */}
        <TabsContent value="detail" className="mt-4 space-y-3">
          {visit.areas_visited && visit.areas_visited.length > 0 && (
            <div className="rounded-lg border border-border/40 bg-card">
              <div className="px-4 py-2.5 border-b border-border/30">
                <h3 className="text-[12px] font-semibold text-foreground inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {t("vd.areas_visited")}
                </h3>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-1.5">
                {(visit.areas_visited ?? []).map((a) => {
                  const known = VISIT_AREAS.includes(a as typeof VISIT_AREAS[number]);
                  return (
                    <span key={a} className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full border",
                      known
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-secondary/40 text-muted-foreground border-border/40"
                    )}>
                      {known ? t(VISIT_AREA_KEY[a as typeof VISIT_AREAS[number]]) : a}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {visit.notes && (
            <div className="rounded-lg border border-border/40 bg-card">
              <div className="px-4 py-2.5 border-b border-border/30">
                <h3 className="text-[12px] font-semibold text-foreground inline-flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  {t("vd.notes")}
                </h3>
              </div>
              <p className="text-[13px] text-foreground whitespace-pre-wrap px-4 py-3">
                {visit.notes}
              </p>
            </div>
          )}
        </TabsContent>

        {/* ====== KONTAK ====== */}
        <TabsContent value="contacts" className="mt-4 space-y-3">
          {canManage && (
            <div className="rounded-lg border border-border/40 bg-card p-3 space-y-2">
              <p className="text-[12px] font-medium text-foreground">{t("vd.add_contact")}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input className="h-10 bg-secondary border-border/50" placeholder={t("vd.contact_name")}
                  value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} />
                <Input className="h-10 bg-secondary border-border/50" placeholder={t("vd.contact_role")}
                  value={newContact.role} onChange={(e) => setNewContact((p) => ({ ...p, role: e.target.value }))} />
                <Input type="email" className="h-10 bg-secondary border-border/50" placeholder={t("vd.contact_email")}
                  value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} />
                <Input type="tel" className="h-10 bg-secondary border-border/50" placeholder={t("vd.contact_phone")}
                  value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <Button size="sm" onClick={addContact} disabled={busy} className="h-8 text-[12px] bg-primary hover:bg-primary/90 text-white">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("vd.add")}
              </Button>
            </div>
          )}

          {contacts.length === 0 ? (
            <div className="py-10 text-center rounded-lg border border-dashed border-border/40">
              <User className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[13px] text-muted-foreground">{t("vd.no_contacts")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30 rounded-lg border border-border/40 bg-card">
              {contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-medium text-foreground">{c.name}</p>
                      {c.is_primary && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wider font-semibold">
                          {t("vd.primary")}
                        </span>
                      )}
                    </div>
                    {c.role && <p className="text-[11px] text-muted-foreground">{c.role}</p>}
                    <div className="flex flex-wrap gap-3 mt-1 text-[11px]">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                          <Mail className="h-3 w-3" />
                          {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <button onClick={() => deleteContact(c.id)} className="text-muted-foreground hover:text-destructive shrink-0">
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
              <Camera className="h-3.5 w-3.5" /> {t("vd.upload_files")}
              <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleUpload} />
            </label>
          )}
          {attachments.length === 0 ? (
            <div className="py-10 text-center rounded-lg border border-dashed border-border/40">
              <Paperclip className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[13px] text-muted-foreground">{t("vd.no_files")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {attachments.map((att) => (
                <div key={att.id} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                  <div className="aspect-square bg-secondary/40 flex items-center justify-center">
                    {att.kind === "photo" ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={publicUrl(att.storage_path)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Paperclip className="h-8 w-8 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="p-2 flex items-center justify-between gap-2">
                    <a href={publicUrl(att.storage_path)} target="_blank" rel="noreferrer"
                       className="text-[11px] text-foreground hover:text-primary truncate flex-1" title={att.filename ?? ""}>
                      {att.filename ?? t("vd.file_fallback")}
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

        {/* ====== FEEDBACK (display) ====== */}
        {visit.status === "completed" && visit.feedback_rating != null && (
          <TabsContent value="feedback" className="mt-4">
            <div className="rounded-lg border border-border/40 bg-card p-4 space-y-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      "h-5 w-5",
                      s <= (visit.feedback_rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                    )}
                  />
                ))}
                <span className="ml-2 text-[13px] text-muted-foreground tabular-nums">
                  {visit.feedback_rating}/5
                </span>
              </div>
              {visit.feedback_notes && (
                <p className="text-[13px] text-foreground whitespace-pre-wrap pt-3 border-t border-border/30">
                  {visit.feedback_notes}
                </p>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Feedback dialog */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>{t("vd.feedback_dialog_title")}</DialogTitle>
            <p className="text-[12px] text-muted-foreground mt-1">
              {t("vd.feedback_dialog_hint")}
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFbRating(s)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      s <= fbRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-[12px] text-muted-foreground">{t("vd.notes_optional")}</Label>
              <Textarea
                className="bg-secondary border-border/50"
                placeholder={t("vd.feedback_placeholder")}
                value={fbNotes}
                onChange={(e) => setFbNotes(e.target.value)}
                rows={4}
              />
            </div>
            <Button onClick={saveFeedback} disabled={busy || fbRating === 0} className="w-full h-10 bg-primary hover:bg-primary/90 text-white">
              {busy ? t("vd.saving") : t("vd.save_feedback")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoTile({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-[13px] font-medium text-foreground truncate">{value}</p>
    </div>
  );
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
