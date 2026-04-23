"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Users, Star } from "lucide-react";
import type { VisitStatus, VisitType } from "@/lib/types/database";
import { VISIT_STATUS_META, VISIT_TYPE_META } from "@/lib/visit-meta";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

export interface VisitListItem {
  id: number;
  code: string;
  visit_type: VisitType;
  status: VisitStatus;
  purpose: string;
  organization: string;
  visit_date: string;
  start_time: string | null;
  end_time: string | null;
  group_size: number;
  host_name: string | null;
  feedback_rating: number | null;
}

interface Props {
  buckets: { status: VisitStatus; items: VisitListItem[] }[];
}

export function VisitListTabs({ buckets }: Props) {
  const { t } = useLang();
  const [tab, setTab] = useState<VisitStatus | "all">("scheduled");

  const all = buckets.flatMap((b) => b.items);
  const byStatus = new Map(buckets.map((b) => [b.status, b.items]));
  const items = tab === "all" ? all : byStatus.get(tab) ?? [];

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as VisitStatus | "all")} className="space-y-4">
      <TabsList className="bg-secondary/50 border border-border/30 p-1 h-auto flex-wrap">
        <TabsTrigger value="all" className="text-[12px]">
          {t("vlt.all")} <span className="ml-1.5 text-muted-foreground">{all.length}</span>
        </TabsTrigger>
        {buckets.map((b) => (
          <TabsTrigger key={b.status} value={b.status} className="text-[12px]">
            {t(VISIT_STATUS_META[b.status].labelKey)}
            <span className="ml-1.5 text-muted-foreground">{b.items.length}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={tab} className="mt-4">
        {items.length === 0 ? (
          <div className="py-16 text-center">
            <UserCheck className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[13px] text-muted-foreground">{t("vlt.empty_category")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/30 rounded-lg border border-border/40 bg-card overflow-hidden">
            {items.map((v) => (
              <VisitRow key={v.id} v={v} />
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function VisitRow({ v }: { v: VisitListItem }) {
  const { t } = useLang();
  const meta = VISIT_STATUS_META[v.status];
  const typeMeta = VISIT_TYPE_META[v.visit_type];

  return (
    <li>
      <Link
        href={`/kunjungan/${v.id}`}
        className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
      >
        <span className="text-2xl shrink-0" title={t(typeMeta.labelKey)}>{typeMeta.emoji}</span>

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
            {v.code}
          </p>
          <p className="text-[13px] font-medium text-foreground truncate">
            {v.organization}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {v.purpose}
            {v.host_name && <span> · {t("vlt.guided_by")} {v.host_name}</span>}
          </p>
        </div>

        <div className="hidden md:block text-right">
          <p className="text-[12px] font-medium text-foreground tabular-nums">
            {fmtDate(v.visit_date)}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {v.start_time ? v.start_time.slice(0, 5) : "—"}
            {v.end_time && ` – ${v.end_time.slice(0, 5)}`}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          <span className="tabular-nums">{v.group_size}</span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Badge className={cn("text-[10px] border font-medium", meta.tone)}>
            <span className={cn("h-1.5 w-1.5 rounded-full mr-1", meta.dot)} />
            {t(meta.labelKey)}
          </Badge>
          {v.feedback_rating != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
              <Star className="h-2.5 w-2.5 fill-amber-400" />
              {v.feedback_rating}/5
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
