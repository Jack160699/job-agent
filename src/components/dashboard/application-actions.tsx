"use client";

import { Button } from "@/components/ui/button";
import { FileDown, Send } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function ApplicationActions({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const downloadPdf = async () => {
    setLoading("pdf");
    try {
      const res = await fetch(`/api/applications/${applicationId}/pdf`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${applicationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Resume PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setLoading(null);
    }
  };

  const prepareSubmit = async (autoSubmit: boolean) => {
    setLoading(autoSubmit ? "submit" : "prepare");
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSubmit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      toast.success(data.message || "Application prepared");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={downloadPdf}
        disabled={!!loading}
        className="gap-1"
      >
        <FileDown className="h-3 w-3" />
        PDF
      </Button>
      {["PENDING_REVIEW", "RESUME_GENERATED", "COVER_LETTER_GENERATED", "MATCHED"].includes(
        status
      ) && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => prepareSubmit(false)}
            disabled={!!loading}
            className="gap-1"
          >
            <Send className="h-3 w-3" />
            Prepare
          </Button>
          <Button
            size="sm"
            onClick={() => prepareSubmit(true)}
            disabled={!!loading}
            className="gap-1"
          >
            <Send className="h-3 w-3" />
            Submit
          </Button>
        </>
      )}
    </div>
  );
}
