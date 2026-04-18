"use client";

import { cn } from "@/lib/utils";
import { HOLE_STATUS, type HoleStatus } from "@/lib/constants";
import { Check } from "lucide-react";

interface HoleCellProps {
  holeNumber: number;
  holeId: number;
  status: HoleStatus;
  isSelected: boolean;
  isMultiSelected: boolean;
  multiSelectMode: boolean;
  onClick: () => void;
  onDragStart?: (id: number) => void;
  onDragEnter?: (id: number) => void;
}

export function HoleCell({
  holeNumber, holeId, status, isSelected, isMultiSelected, multiSelectMode,
  onClick, onDragStart, onDragEnter,
}: HoleCellProps) {
  const config = HOLE_STATUS[status];
  return (
    <button
      type="button"
      onClick={onClick}
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
        isSelected && !multiSelectMode && "ring-2 ring-[oklch(0.65_0.18_260)] ring-offset-1 ring-offset-background scale-110",
        isMultiSelected && "ring-2 ring-[oklch(0.75_0.17_150)] ring-offset-1 ring-offset-background"
      )}
    >
      {isMultiSelected ? (
        <Check className="h-4 w-4 text-white" />
      ) : (
        holeNumber
      )}
    </button>
  );
}
