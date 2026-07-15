"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { JobLinkImportButton } from "@/components/jobs/job-link-import";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

type ActionProposal = {
  proposalId: string;
  toolName: string;
  summary: string;
  expiresAt?: string | Date;
};

export function ConsultantFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      setOpen(true);
      if (detail?.prompt) setInput(detail.prompt);
    };
    window.addEventListener("kairela:open", handleOpen);
    return () => window.removeEventListener("kairela:open", handleOpen);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const query = new URLSearchParams({ pathname });
      if (conversationId) query.set("conversationId", conversationId);
      const res = await fetch(`/api/consultant/chat?${query.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
      setEnabled(data.enabled !== false);
      if (data.suggestions) setSuggestions(data.suggestions);
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.conversation?.id) setConversationId(data.conversation.id);
    } catch {
      // ignore
    }
  }, [pathname, conversationId]);

  useEffect(() => {
    if (open) queueMicrotask(() => void loadHistory());
  }, [open, loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, proposals]);

  const startNewConversation = async () => {
    const res = await fetch("/api/consultant/conversations", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not start a new chat");
      return;
    }
    setConversationId(data.conversation.id);
    setMessages([]);
    setProposals([]);
  };

  const confirmProposal = async (proposalId: string) => {
    setConfirmingId(proposalId);
    try {
      const res = await fetch("/api/consultant/actions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Confirmation failed");
      toast.success("Action confirmed");
      setProposals((current) =>
        current.filter((proposal) => proposal.proposalId !== proposalId)
      );
      setMessages((m) => [
        ...m,
        {
          id: `confirmed-${proposalId}`,
          role: "assistant",
          content: `Confirmed ${data.proposal.toolName.replaceAll("_", " ")}.`,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Confirmation failed");
    } finally {
      setConfirmingId(null);
    }
  };

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
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
        body: JSON.stringify({
          message: text,
          pathname,
          conversationId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: "assistant", content: data.reply },
      ]);
      if (data.suggestions) setSuggestions(data.suggestions);
      if (Array.isArray(data.proposals)) setProposals(data.proposals);
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
          "bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom)+1rem)] right-4",
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
            "inset-x-0 bottom-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom))] max-h-[70dvh] rounded-t-[var(--radius)]",
            "md:inset-auto md:bottom-24 md:right-6 md:h-[480px] md:w-[380px] md:rounded-[var(--radius)]"
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Kairela Career Consultant</h2>
              <p className="text-xs text-[var(--ink-tertiary)]">
                Ask about your search, preferences, or next steps
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void startNewConversation()}
              >
                New
              </Button>
              <JobLinkImportButton />
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--ink-tertiary)]">
                Kairela can explain your queue, review matches, and suggest next
                steps — using only your real data.
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  message.role === "user"
                    ? "ml-8 bg-[var(--accent)] text-white"
                    : "mr-8 bg-[var(--surface-2)] text-[var(--ink)]"
                )}
              >
                {message.content}
              </div>
            ))}
            {proposals.map((proposal) => (
              <div
                key={proposal.proposalId}
                className="mr-8 space-y-2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3"
              >
                <p className="text-sm font-medium">{proposal.summary}</p>
                <p className="text-xs text-[var(--ink-tertiary)]">
                  Requires your confirmation. Kairela will not submit applications
                  from chat.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={confirmingId === proposal.proposalId}
                  onClick={() => void confirmProposal(proposal.proposalId)}
                >
                  {confirmingId === proposal.proposalId
                    ? "Confirming…"
                    : "Confirm action"}
                </Button>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-[var(--ink-tertiary)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-4 py-2">
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-full border border-[var(--line)] px-2 py-1 text-xs text-[var(--ink-secondary)]"
                  onClick={() => void send(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex gap-2 border-t border-[var(--line)] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Kairela…"
              className="flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
