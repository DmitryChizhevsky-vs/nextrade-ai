# NexTrade AI Reporting Assistant

A working prototype of the "AI Reporting Assistant" described in the NexTrade
test-task brief. Vendors log in (well — pick themselves from a dropdown in this
prototype), ask questions in plain English, and the assistant returns an
instant, on-brand chart in the chat window.

Built with **Next.js 15 (App Router) + Prisma + Postgres + Anthropic Claude +
Recharts + Tailwind**. Single-codebase, frictionless deploy to Vercel.

## What's implemented vs what's skipped

### ✅ Implemented (the actual demo requirements)
- **Plain-English question → chart in chat.** Line / bar / pie / single-number.
- **Tenant isolation.** The LLM never touches `vendor_id`. It emits a constrained
  JSON query plan, and the server translates that into parameterized SQL with
  `vendor_id` hard-bound. Switch vendors in the dropdown to prove isolation —
  the two companies see completely disjoint data.
- **Anti-hallucination.** The LLM is prompted to return `can_answer: false`
  with a clear `refusal_reason` whenever the question is outside the schema
  (e.g. "why did customers cancel?" — we store `reason_category` but not free-text
  explanations). The seed script intentionally leaves ~70% of cancellations with
  NULL `detailed_reason` to make this visible.
- **Brand compliance.** Deep Teal header, white card surfaces, Neon Lime used
  sparingly for AI accents, Inter typography, 4px radius, the monospaced
  label treatments from the style guide.
- **Chat fills the screen.** Main column, not a sidebar widget.
- **Two seed vendors** with distinct catalogues (Apex Outdoor Co. — apparel,
  NovaBrew Coffee — beverages) so the isolation is obvious at a glance.

### ⏭️ Intentionally skipped for the prototype
- Real authentication (SSO / OAuth). The dropdown stands in for it.
- Multi-turn context (each question is independent).
- Saving queries / dashboards.
- Streaming responses.
- Rate-limiting, observability beyond console logs.

---

## Architecture in 30 seconds

```
┌──────────────────────────────────────────────────────────┐
│                  Browser (React / Tailwind)              │
│   VendorSwitcher · ChatWindow · ChartRenderer (Recharts) │
└────────────────────────┬─────────────────────────────────┘
                         │ POST /api/chat { question, vendorId }
                         ▼
┌──────────────────────────────────────────────────────────┐
│                Next.js API route (Node.js)               │
│                                                          │
│  1. Verify vendorId exists (DB lookup)                   │
│  2. lib/llm.ts  → Anthropic Claude                       │
│        • system prompt with schema + rules               │
│        • returns a validated QueryPlan (zod)             │
│  3. lib/query-executor.ts                                │
│        • translates plan to parameterized SQL            │
│        • vendor_id is injected by US, not the model      │
│        • prisma.$queryRaw with tagged templates          │
│  4. Returns rows + chart metadata                        │
└────────────────────────┬─────────────────────────────────┘
                         ▼
                ┌─────────────────┐
                │   Postgres 16   │
                └─────────────────┘
```

The LLM decides **what** to compute (metric, dimension, date window,
chart type). Our code decides **who** the query runs against. That split
is the whole security story.

---

## Prerequisites

- **Node.js 20+** (`node -v`)
- **npm** (comes with Node). pnpm / bun work too; commands below use npm.
- **Postgres database.** Easiest options:
  - **Neon** (free, zero-install) — https://neon.tech → create project →
    copy connection string. Works for local dev AND Vercel.
  - **Vercel Postgres** — one click from the Vercel dashboard. Also Neon under
    the hood.
  - **Docker** (if you prefer local):
    ```bash
    docker run --name nextrade-pg -e POSTGRES_PASSWORD=postgres \
      -p 5432:5432 -d postgres:16
    # DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
    ```
- **Anthropic API key.** Get one at https://console.anthropic.com. New
  accounts get starter credits. Cost of the demo: well under $1.

---

## Quick start (local)

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env
# edit .env and fill DATABASE_URL + ANTHROPIC_API_KEY

# 3. Create the schema + seed demo data
npm run db:push
npm run db:seed

# 4. Run
npm run dev
```

Open http://localhost:3000. Pick a vendor from the dropdown, type a
question. Try:

- "What were my top 5 products last month?"
- "Revenue trend over the last 30 days"
- "Sales breakdown by category"
- "How do my Tuesday sales compare to Wednesday?"
- "What are my three worst-performing items this month?"
- "Why are my cancellations high this week?"   ← should refuse politely

Switch vendor in the dropdown and re-ask the same questions — you'll see
completely different numbers (that's the isolation working).
