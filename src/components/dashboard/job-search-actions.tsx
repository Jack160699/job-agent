"use client";

import { Button } from "@/components/ui/button";
import { Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export function JobSearchActions() {
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/search?async=true", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.queued) {
        toast.success("Job search queued — results will appear shortly");
      } else {
        toast.success(`Found ${data.total} jobs (${data.new} new)`);
        window.location.reload();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Search failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleSearch} disabled={loading} className="gap-2">
      {loading ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Search className="h-4 w-4" />
      )}
      {loading ? "Searching..." : "Search Jobs"}
    </Button>
  );
}
