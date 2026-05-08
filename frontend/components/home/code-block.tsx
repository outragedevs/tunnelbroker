import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  filename?: string;
  copyValue?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CodeBlock({
  filename,
  copyValue,
  rightSlot,
  children,
  className,
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border-strong bg-muted",
        className,
      )}
    >
      {(filename || rightSlot || copyValue) && (
        <div className="flex items-center justify-between gap-3 border-b border-border-strong bg-card/40 px-3 py-2">
          {filename ? (
            <span className="font-mono text-xs text-muted-foreground">
              {filename}
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {rightSlot}
            {copyValue && <CopyButton value={copyValue} />}
          </div>
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-[1.6] text-foreground">
        {children}
      </pre>
    </div>
  );
}
