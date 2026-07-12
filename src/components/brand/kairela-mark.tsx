import { cn } from "@/lib/utils";

type KairelaMarkProps = {
  className?: string;
  /** When true, renders only the path (for use on colored backgrounds). */
  monochrome?: boolean;
};

/**
 * Kairela app mark — upward path with human center point.
 * Represents career momentum with calm, trustworthy geometry.
 */
export function KairelaMark({ className, monochrome = false }: KairelaMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      {!monochrome && (
        <rect width="32" height="32" rx="8" className="fill-[var(--accent)]" />
      )}
      <path
        d="M9 22.5C9 22.5 11.5 14 16 14C20.5 14 23 22.5 23 22.5"
        stroke={monochrome ? "currentColor" : "white"}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M11 11.5L16 22L21 11.5"
        stroke={monochrome ? "currentColor" : "white"}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="9.5"
        r="1.75"
        fill={monochrome ? "currentColor" : "white"}
      />
    </svg>
  );
}
