"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatResponse } from "@/lib/types";
import { ChartRenderer } from "./ChartRenderer";

type Message =
  | { role: "user"; id: string; text: string }
  | { role: "assistant"; id: string; loading: true }
  | { role: "assistant"; id: string; response: ChatResponse };

const STARTER_QUESTIONS = [
  "What were my top 5 products last month?",
  "Show revenue trend over the last 30 days",
  "Sales breakdown by category",
  "Cancellation rate by weekday",
];

type Props = { vendorId: string | null; vendorName: string };

export function ChatWindow({ vendorId, vendorName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset history when vendor changes (tenant switch = blank slate).
  useEffect(() => {
    setMessages([]);
  }, [vendorId]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(question: string) {
    if (!vendorId || !question.trim() || sending) return;
    setSending(true);
    const userId = crypto.randomUUID();
    const botId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { role: "user", id: userId, text: question },
      { role: "assistant", id: botId, loading: true },
    ]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, vendorId }),
      });
      const data: ChatResponse = await res.json();
      setMessages((m) =>
        m.map((x) =>
          x.role === "assistant" && x.id === botId
            ? { role: "assistant", id: botId, response: data }
            : x
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setMessages((m) =>
        m.map((x) =>
          x.role === "assistant" && x.id === botId
            ? {
                role: "assistant",
                id: botId,
                response: { kind: "error", error: message },
              }
            : x
        )
      );
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-surface border border-border-hairline rounded-brand overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-hairline">
        <div className="flex items-center gap-2.5">
          <div className="ai-dot" />
          <div className="text-body font-semibold">NexTrade AI</div>
        </div>
        <div className="label-mono">Assistant</div>
      </div>

      {/* Messages list */}
      <div
        ref={listRef}
        className="chat-scroll flex-1 overflow-y-auto px-5 py-6 space-y-5"
      >
        {messages.length === 0 && (
          <EmptyState
            vendorName={vendorName}
            onAsk={(q) => send(q)}
            starters={STARTER_QUESTIONS}
          />
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <UserBubble key={m.id} text={m.text} />
          ) : "loading" in m ? (
            <TypingBubble key={m.id} />
          ) : (
            <AssistantBubble key={m.id} response={m.response} />
          )
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border-hairline bg-bg-surface">
        <div className="px-5 py-4">
          <div className="flex items-end gap-2 bg-bg-app rounded-brand border border-border-hairline focus-within:border-brand-primary/50 focus-within:shadow-[0_0_0_3px_rgba(0,128,128,0.08)] transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                vendorId
                  ? "Ask NexTrade AI anything about your shipments, vendors, or orders…"
                  : "Loading vendor context…"
              }
              disabled={!vendorId || sending}
              className="flex-1 bg-transparent px-3.5 py-3 text-body outline-none resize-none max-h-40 placeholder:text-text-muted"
            />
            <button
              onClick={() => send(input)}
              disabled={!vendorId || sending || !input.trim()}
              className="m-1.5 px-3 h-9 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-brand disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1.5 7H12M12 7L7.5 2.5M12 7L7.5 11.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between mt-2.5 px-0.5">
            <div className="label-mono">Enter to send · Shift + Enter for newline</div>
            <div className="label-mono flex items-center gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "#39FF14", boxShadow: "0 0 6px rgba(57,255,20,0.6)" }}
              />
              AI Ready
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Sub-components -------------------------------------------------

function EmptyState({
  vendorName,
  onAsk,
  starters,
}: {
  vendorName: string;
  onAsk: (q: string) => void;
  starters: string[];
}) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="label-mono">Welcome back</div>
      <h2 className="text-h2 mt-2 mb-1.5 tracking-[-0.035em]">
        Hi <span className="text-brand-primary">{vendorName}</span>. Ask anything about your data.
      </h2>
      <p className="text-body text-text-muted max-w-lg mb-6 leading-relaxed">
        I turn natural-language questions into instant charts. I only see
        your vendor data — never other sellers on the marketplace.
      </p>

      <div className="label-mono mb-2.5">Try one of these</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {starters.map((q) => (
          <button
            key={q}
            onClick={() => onAsk(q)}
            className="text-left text-body px-3.5 py-3 bg-bg-surface border border-border-hairline rounded-brand hover:border-brand-primary/40 hover:bg-bg-app transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] bg-text-primary text-white px-4 py-2.5 rounded-brand text-body leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="ai-response-border max-w-[90%]">
      <div className="label-mono mb-2 text-brand-primary" style={{ color: "var(--brand-primary)" }}>
        AI Response
      </div>
      <div className="flex items-center gap-1.5 py-1">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="text-small text-text-muted ml-2">Thinking…</span>
      </div>
    </div>
  );
}

function AssistantBubble({ response }: { response: ChatResponse }) {
  if (response.kind === "error") {
    return (
      <div className="ai-response-border max-w-[90%]" style={{ borderLeftColor: "#e11d48" }}>
        <div className="label-mono mb-2" style={{ color: "#e11d48" }}>Error</div>
        <div className="text-body text-text-primary">{response.error}</div>
      </div>
    );
  }

  if (response.kind === "refusal") {
    return (
      <div className="ai-response-border max-w-[90%]">
        <div className="label-mono mb-2" style={{ color: "var(--brand-primary)" }}>
          AI Response
        </div>
        {response.title && (
          <div className="text-h3 mb-1.5 tracking-[-0.02em]">{response.title}</div>
        )}
        <div className="text-body text-text-primary leading-relaxed">
          {response.refusal_reason}
        </div>
      </div>
    );
  }

  return (
    <div className="ai-response-border max-w-[90%]">
      <div className="label-mono mb-2" style={{ color: "var(--brand-primary)" }}>
        AI Response
      </div>
      {response.title && (
        <div className="text-h3 mb-1 tracking-[-0.02em]">{response.title}</div>
      )}
      {response.summary && (
        <div className="text-body text-text-muted mb-3 leading-relaxed">
          {response.summary}
        </div>
      )}
      <div className="bg-bg-surface border border-border-hairline rounded-brand p-4 mt-2">
        <ChartRenderer
          chartType={response.chart_type ?? "bar"}
          rows={response.rows ?? []}
          valueFormat={response.value_format}
        />
      </div>
      {response.debug && (
        <div className="mt-2 label-mono">
          {response.debug.rowCount} rows · {response.debug.ms}ms
        </div>
      )}
    </div>
  );
}
