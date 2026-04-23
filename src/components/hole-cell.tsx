"use client";

import { cn } from "@/lib/utils";
import { HOLE_STATUS, type HoleStatus } from "@/lib/constants";
import { Check, FlaskConical } from "lucide-react";

interface HoleCellProps {
  holeNumber: number;
  holeId: number;
  status: HoleStatus;
  isSelected: boolean;
  isMultiSelected: boolean;
  multiSelectMode: boolean;
  researchTag?: string;       // tooltip text bila lubang direservasi riset
  onClick: () => void;
  onDragStart?: (id: number) => void;
  onDragEnter?: (id: number) => void;
}

export function HoleCell({
  holeNumber, holeId, status, isSelected, isMultiSelected, multiSelectMode,
  researchTag, onClick, onDragStart, onDragEnter,
}: HoleCellProps) {
  const config = HOLE_STATUS[status];
  return (
    <button
      type="button"
      onClick={onClick}
      title={researchTag}
      onMouseDown={(e) => {
        if (multiSelectMode && onDragStart) {
          e.preventDefault();
          onDragStart(holeId);
        }
      }}
      onMouseEnter={() => {
        if (multiSelectMode && onDragEnter) {
          onDragEnter(holeId);
        }
      }}
      className={cn(
        "relative w-9 h-9 md:w-10 md:h-10 rounded text-[10px] font-medium transition-all flex items-center justify-center select-none",
        config.cellColor,
        researchTag && "ring-1 ring-violet-400/60 ring-offset-[1px] ring-offset-background",
        isSelected && !multiSelectMode && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-110",
        isMultiSelected && "ring-2 ring-[oklch(0.75_0.17_150)] ring-offset-1 ring-offset-background"
      )}
    >
      {isMultiSelected ? (
        <Check className="h-4 w-4 text-white" />
      ) : (
        holeNumber
      )}
      {researchTag && !isMultiSelected && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-violet-500 flex items-center justify-center ring-1 ring-background">
          <FlaskConical className="h-2 w-2 text-white" />
        </span>
      )}
    </button>
  );
}
