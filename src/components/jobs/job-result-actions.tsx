"use client";

import { useState } from "react";
import { Bot, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationActions } from "@/components/dashboard/application-actions";

export function JobResultActions({
  job,
  application,
}: {
  job: { id: string; title: string; company: string; status?: string };
  application?: {
    id: string;
    status: string;
    failureReason?: string | null;
    hasDocuments: boolean;
    browserTaskId?: string | null;
  };
}) {
  const [selectedToCompare, setSelectedToCompare] = useState(false);

  const askKairela = () => {
    window.dispatchEvent(
      new CustomEvent("kairela:open", {
        detail: {
          prompt: `Explain why ${job.title} at ${job.company} matched me, including important gaps and uncertainty.`,
        },
      })
    );
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={askKairela}
      >
        <Bot className="h-3 w-3" />
        Ask Kairela
      </Button>
      <Button
        type="button"
        size="sm"
        variant={selectedToCompare ? "default" : "outline"}
        className="gap-1"
        onClick={() => setSelectedToCompare((value) => !value)}
        aria-pressed={selectedToCompare}
      >
        <GitCompareArrows className="h-3 w-3" />
        {selectedToCompare ? "Selected" : "Compare"}
      </Button>
      {application && (
        <ApplicationActions
          applicationId={application.id}
          status={application.status}
          failureReason={application.failureReason}
          hasDocuments={application.hasDocuments}
          browserTaskId={application.browserTaskId}
          jobStatus={job.status}
        />
      )}
    </div>
  );
}
