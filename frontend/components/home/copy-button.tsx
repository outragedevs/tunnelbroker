"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  className?: string;
  label?: string;
}

export function CopyButton({ value, className, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available — silently no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-background/40",
        "px-2 py-1 text-xs font-mono text-muted-foreground",
        "transition-colors hover:text-foreground hover:border-primary/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      {copied ? (
        <>
          <Check size={12} className="text-success" />
          copied
        </>
      ) : (
        <>
          <Copy size={12} />
          {label}
        </>
      )}
    </button>
  );
}
