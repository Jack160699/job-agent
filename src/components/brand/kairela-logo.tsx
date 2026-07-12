import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { KairelaMark } from "./kairela-mark";

type KairelaLogoProps = {
  className?: string;
  href?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  subtitle?: string | null;
};

const sizes = {
  sm: { box: "h-7 w-7", text: "text-sm", sub: "text-[10px]" },
  md: { box: "h-8 w-8", text: "text-sm", sub: "text-[10px]" },
  lg: { box: "h-9 w-9", text: "text-base", sub: "text-xs" },
};

export function KairelaLogo({
  className,
  href = "/",
  showWordmark = true,
  size = "md",
  subtitle = null,
}: KairelaLogoProps) {
  const s = sizes[size];

  const content = (
    <>
      <div className={cn("shrink-0", s.box)}>
        <KairelaMark />
      </div>
      {showWordmark && (
        <div className="min-w-0">
          <p className={cn("font-semibold leading-none text-[var(--ink)]", s.text)}>
            {BRAND.name}
          </p>
          {subtitle !== null && (
            <p className={cn("mt-0.5 text-[var(--ink-tertiary)]", s.sub)}>
              {subtitle ?? BRAND.tagline}
            </p>
          )}
        </div>
      )}
    </>
  );

  const classes = cn("flex items-center gap-2.5", className);

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={`${BRAND.name} home`}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
