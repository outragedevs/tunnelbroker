import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
}

export default function Logo({ href = "/", className = "" }: LogoProps) {
  const mark = (
    <span
      className={cn(
        "inline-flex items-baseline font-mono text-base font-semibold tracking-tight leading-none",
        className,
      )}
    >
      <span className="text-primary">//</span>
      <span className="text-foreground">tunnelbroker</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center hover:opacity-80 transition-opacity">
        {mark}
      </Link>
    );
  }

  return mark;
}
