"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

export function ConsultantFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/consultant/chat");
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setEnabled(data.enabled !== false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) queueMicrotask(() => void loadHistory());
  }, [open, loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);
    setMessages((m) => [
      ...m,
      { id: `tmp-${Date.now()}`, role: "user", content: text },
    ]);

    try {
      const res = await fetch("/api/consultant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, pathname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reach consultant");
      setMessages((m) => m.filter((msg) => !msg.id.startsWith("tmp-")));
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed z-50 h-14 w-14 rounded-full shadow-lg",
          "bottom-[calc(var(--mobile-nav-height,0px)+env(safe-area-inset-bottom)+1rem)] right-4",
          "md:bottom-6 md:right-6"
        )}
        aria-label="Open Kairela career consultant"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>

      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col border border-[var(--line)] bg-[var(--surface)] shadow-xl",
            "inset-x-0 bottom-0 max-h-[70dvh] rounded-t-[var(--radius)]",
            "md:inset-auto md:bottom-24 md:right-6 md:h-[480px] md:w-[380px] md:rounded-[var(--radius)]"
          )}
        >
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-sm font-semibold">Kairela Career Consultant</h2>
            <p className="text-xs text-[var(--ink-tertiary)]">
              Ask about your search, preferences, or next steps
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--ink-secondary)]">
                Hi! I can help explain your job search progress and suggest next steps —
                using only your real profile data.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[90%] rounded-[var(--radius-sm)] px-3 py-2 text-sm",
                  m.role === "user"
                    ? "ml-auto bg-[var(--accent-muted)] text-[var(--ink)]"
                    : "bg-[var(--surface-raised)] text-[var(--ink-secondary)]"
                )}
              >
                {m.content}
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t border-[var(--line)] p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Ask Kairela…"
              className="min-h-[44px] flex-1 rounded-[var(--radius-sm)] border border-[var(--line)] bg-transparent px-3 text-sm"
              disabled={loading}
            />
            <Button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="h-11 w-11 shrink-0"
              aria-label="Send message"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
