import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface ErrorCalloutProps {
  title: string;
  what: string;
  why?: string;
  fix?: string;
  onRetry?: () => void;
  retrying?: boolean;
  logs?: string[];
  className?: string;
}

export function ErrorCallout({
  title,
  what,
  why,
  fix,
  onRetry,
  retrying,
  logs,
  className,
}: ErrorCalloutProps) {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-red-500/30 bg-red-950/30 p-4 sm:p-5",
        className
      )}
    >
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-red-200">{title}</h3>
            <p className="mt-1 text-sm text-red-200/80">{what}</p>
          </div>

          {why && (
            <div className="text-sm">
              <span className="font-medium text-zinc-300">Why: </span>
              <span className="text-zinc-400">{why}</span>
            </div>
          )}

          {fix && (
            <div className="text-sm">
              <span className="font-medium text-zinc-300">How to fix: </span>
              <span className="text-zinc-400">{fix}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                disabled={retrying}
                className="gap-1.5 border-red-500/30 text-red-200 hover:bg-red-950/50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", retrying && "animate-spin")} />
                {retrying ? "Retrying…" : "Try again"}
              </Button>
            )}
            {logs && logs.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLogs(!showLogs)}
                className="gap-1 text-zinc-400"
              >
                {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showLogs ? "Hide logs" : "View logs"}
              </Button>
            )}
          </div>

          {showLogs && logs && logs.length > 0 && (
            <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-950/80 p-3 font-mono text-xs text-zinc-500">
              {logs.join("\n")}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
