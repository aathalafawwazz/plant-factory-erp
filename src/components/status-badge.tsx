import { HOLE_STATUS, type HoleStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: HoleStatus }) {
  const config = HOLE_STATUS[status];
  if (!config) return <span className="text-xs text-muted-foreground">{status}</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        config.color
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </span>
  );
}
