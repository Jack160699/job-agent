"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function JobDispositionActions({
  jobId,
  saved,
  excluded,
}: {
  jobId: string;
  saved: boolean;
  excluded: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const update = async (action: "save" | "unsave" | "exclude" | "restore") => {
    setBusy(action);
    try {
      const response = await fetch(`/api/jobs/${jobId}/disposition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");
      toast.success(
        action === "save"
          ? "Job saved"
          : action === "unsave"
            ? "Removed from saved"
            : action === "exclude"
              ? "Job excluded"
              : "Job restored"
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        disabled={Boolean(busy)}
        onClick={() => void update(saved ? "unsave" : "save")}
      >
        {saved ? (
          <BookmarkCheck className="h-3 w-3" />
        ) : (
          <Bookmark className="h-3 w-3" />
        )}
        {saved ? "Saved" : "Save"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="gap-1"
        disabled={Boolean(busy)}
        onClick={() => void update(excluded ? "restore" : "exclude")}
      >
        {excluded ? (
          <RotateCcw className="h-3 w-3" />
        ) : (
          <EyeOff className="h-3 w-3" />
        )}
        {excluded ? "Restore" : "Exclude"}
      </Button>
    </div>
  );
}
