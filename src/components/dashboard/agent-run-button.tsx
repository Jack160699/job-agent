"use client";

import { Button } from "@/components/ui/button";
import { Bot, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function AgentRunButton() {
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        `Agent complete: ${data.processed} processed, ${data.prepared} prepared, ${data.submitted} submitted`
      );
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Agent run failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleRun} disabled={loading} variant="default" className="gap-2">
      {loading ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Bot className="h-4 w-4" />
      )}
      {loading ? "Running Agent..." : "Run AI Agent"}
    </Button>
  );
}
