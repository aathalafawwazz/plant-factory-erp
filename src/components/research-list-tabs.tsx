"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Calendar, Sprout, AlertTriangle } from "lucide-react";
import type { ResearchStatus, ResearchType } from "@/lib/types/database";
import { RESEARCH_STATUS_META, RESEARCH_TYPE_KEY } from "@/lib/research-meta";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { formatDateLocale } from "@/lib/translate-helpers";
import type { Lang } from "@/lib/i18n-dict";

export interface ResearchListItem {
  id: number;
  code: string;
  title: string;
  researcher_name: string;
  institution: string | null;
  research_type: ResearchType;
  status: ResearchStatus;
  proposed_start: string | null;
  proposed_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  allocated_holes: number;
  overdue: boolean | null;
}

interface Props {
  buckets: { status: ResearchStatus; items: ResearchListItem[] }[];
}

export function ResearchListTabs({ buckets }: Props) {
  const { t } = useLang();
  const [tab, setTab] = useState<ResearchStatus | "all">("active");

  const all = buckets.flatMap((b) => b.items);
  const byStatus = new Map(buckets.map((b) => [b.status, b.items]));

  const tabItems =
    tab === "all" ? all : byStatus.get(tab) ?? [];

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ResearchStatus | "all")} className="space-y-4">
      <TabsList className="bg-secondary/50 border border-border/30 p-1 h-auto flex-wrap">
        <TabsTrigger value="all" className="text-[12px]">
          {t("rlt.all")} <span className="ml-1.5 text-muted-foreground">{all.length}</span>
        </TabsTrigger>
        {buckets.map((b) => (
          <TabsTrigger key={b.status} value={b.status} className="text-[12px]">
            {t(RESEARCH_STATUS_META[b.status].labelKey)}
            <span className="ml-1.5 text-muted-foreground">{b.items.length}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={tab} className="mt-4">
        {tabItems.length === 0 ? (
          <div className="py-16 text-center">
            <FlaskConical className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-[13px] text-muted-foreground">{t("rlt.empty_category")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {tabItems.map((item) => (
              <ResearchCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function ResearchCard({ item }: { item: ResearchListItem }) {
  const { t, lang } = useLang();
  const meta = RESEARCH_STATUS_META[item.status];
  const start = item.actual_start || item.proposed_start;
  const end = item.actual_end || item.proposed_end;
  return (
    <Link
      href={`/riset/${item.id}`}
      className="group block rounded-lg border border-border/40 bg-card hover:border-primary/60 transition-colors p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground tabular-nums">
            {item.code}
          </p>
          <h3 className="text-[14px] font-semibold text-foreground line-clamp-2 mt-0.5 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
        </div>
        <Badge className={cn("text-[10px] border font-medium shrink-0", meta.tone)}>
          <span className={cn("h-1.5 w-1.5 rounded-full mr-1", meta.dot)} />
          {t(meta.labelKey)}
        </Badge>
      </div>

      <div className="space-y-1 text-[12px] text-muted-foreground">
        <p className="truncate">
          <span className="text-foreground font-medium">{item.researcher_name}</span>
          {item.institution && <span> · {item.institution}</span>}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Sprout className="h-3 w-3" /> {item.allocated_holes} {t("rlt.holes_suffix")}
          </span>
          {start && end && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {formatRange(start, end, lang)}
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/60">
            {t(RESEARCH_TYPE_KEY[item.research_type])}
          </span>
          {item.overdue && (
            <span className="inline-flex items-center gap-1 text-rose-400">
              <AlertTriangle className="h-3 w-3" /> {t("rlt.overdue")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatRange(from: string, to: string, lang: Lang): string {
  const toDate = new Date(to);
  const fmt = (d: string) =>
    formatDateLocale(d, lang, { day: "numeric", month: "short" });
  return `${fmt(from)} – ${fmt(to)} ${toDate.getFullYear()}`;
}
