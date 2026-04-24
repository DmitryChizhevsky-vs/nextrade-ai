import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildQueryPlan } from "@/lib/llm";
import { executeQueryPlan } from "@/lib/query-executor";
import type { ChatResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Pro: 60s. Hobby is 10s — usually enough.

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const body = await req.json();
    const question = String(body?.question || "").trim();
    const vendorId = String(body?.vendorId || "").trim();

    if (!question) {
      return NextResponse.json<ChatResponse>(
        { kind: "error", error: "Empty question." },
        { status: 400 }
      );
    }
    if (!vendorId) {
      return NextResponse.json<ChatResponse>(
        { kind: "error", error: "Missing vendor context." },
        { status: 400 }
      );
    }

    // Validate vendor exists — prevents the client from making up UUIDs.
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, company_name: true },
    });
    if (!vendor) {
      return NextResponse.json<ChatResponse>(
        { kind: "error", error: "Unknown vendor." },
        { status: 404 }
      );
    }

    const plan = await buildQueryPlan(question, vendor.company_name);
    const result = await executeQueryPlan(plan, vendor.id);

    const payload: ChatResponse = {
      ...result,
      debug: {
        plan,
        rowCount: result.rows?.length ?? 0,
        ms: Date.now() - started,
      },
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/chat] error:", err);
    return NextResponse.json<ChatResponse>(
      { kind: "error", error: message },
      { status: 500 }
    );
  }
}
