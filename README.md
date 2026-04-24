# NexTrade AI Reporting Assistant

A working prototype of the "AI Reporting Assistant" described in the NexTrade
test-task brief. Vendors log in (well — pick themselves from a dropdown in this
prototype), ask questions in plain English, and the assistant returns an
instant, on-brand chart in the chat window.

Built with **Next.js 15 (App Router) + Prisma + Postgres + Anthropic Claude +
Recharts + Tailwind**. Single-codebase, frictionless deploy to Vercel.

---

## Why Next.js (not NestJS)?

The brief asked for a React + Node/NestJS + Prisma prototype with a live
deployed URL on a tight deadline. NestJS is a fine backend framework, but
running it on Vercel is more friction than it's worth for an 8-hour
prototype (serverless function packaging, cold starts, separate frontend
host). Next.js App Router gives the same ergonomics — TypeScript, Prisma,
Node API routes — plus zero-config Vercel deployment. If you later want to
split backend out into NestJS, the `/lib` layer is already framework-free
and lifts cleanly.

---

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

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. On https://vercel.com → **Add New → Project** → import the repo.
3. When prompted for env vars, add:
   - `DATABASE_URL` → your Postgres connection string (use Vercel Postgres
     or Neon). For Vercel Postgres just click "Connect Store" during
     project setup and it's filled in automatically.
   - `ANTHROPIC_API_KEY` → your key.
   - `ANTHROPIC_MODEL` → `claude-haiku-4-5` (cheap + fast) or
     `claude-sonnet-4-5` (higher quality).
4. Click **Deploy**. Build runs `prisma generate && prisma migrate deploy`
   automatically.
5. One-time seed: from your terminal, with `DATABASE_URL` pointing to the
   production DB:
   ```bash
   npm run db:push
   npm run db:seed
   ```
   (Or run `npx prisma db seed` via the Vercel CLI if you prefer.)

Note on serverless limits: `maxDuration = 60` is set on the chat route.
Vercel Hobby caps at 10s — that's enough for Haiku but may truncate on
Sonnet with complex questions. Upgrade to Pro or switch to Haiku if you
hit it.

---

## Project layout

```
nextrade-ai/
├── app/
│   ├── api/
│   │   ├── chat/route.ts         ← POST endpoint: question → chart
│   │   └── vendors/route.ts      ← GET list of demo vendors
│   ├── globals.css               ← brand tokens + small animations
│   ├── layout.tsx                ← Inter font, metadata
│   └── page.tsx                  ← app shell (header + sidebar + chat)
├── components/
│   ├── ChatWindow.tsx            ← message list + composer
│   ├── ChartRenderer.tsx         ← picks bar/line/pie/number
│   └── VendorSwitcher.tsx        ← dropdown for the isolation demo
├── lib/
│   ├── prisma.ts                 ← Prisma client singleton
│   ├── llm.ts                    ← Anthropic call + zod validation
│   ├── query-executor.ts         ← plan → parameterized SQL
│   └── types.ts                  ← QueryPlan schema, ChatResponse type
├── prisma/
│   ├── schema.prisma             ← mirrors the ER diagram in the brief
│   └── seed.ts                   ← two vendors × ~90 days of orders
├── tailwind.config.ts            ← brand tokens as Tailwind colors
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Swapping the LLM

`lib/llm.ts` is the only file that talks to Anthropic. It returns a
`QueryPlan` — a strict JSON shape validated with zod. To move to OpenAI /
Gemini / a local model, replace the body of `buildQueryPlan` with your
provider's call; keep the return contract. The rest of the app never
changes.

---

## Answering "what about raw SQL?"

An earlier draft let the LLM write SQL directly and parsed it for safety.
That's doable but brittle — you're one missed `WHERE vendor_id = ...`
away from a data leak. The structured query plan approach here makes
isolation **unconditional**: the vendor filter doesn't live in the LLM
output at all, so the LLM literally cannot omit it. The trade-off is a
narrower range of answerable questions; in practice the plan schema
covers everything in the brief's examples plus the obvious variations.
