"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FloatingFormProps {
  title: string;
  children: React.ReactNode;
  backHref?: string;
}

export function FloatingForm({ title, children, backHref }: FloatingFormProps) {
  const router = useRouter();

  function handleClose() {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-border/50 bg-card shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border/30 bg-card rounded-t-xl">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Content */}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
