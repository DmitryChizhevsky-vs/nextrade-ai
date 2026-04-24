import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      select: { id: true, company_name: true, status: true },
      orderBy: { company_name: "asc" },
    });
    return NextResponse.json({ vendors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load vendors: ${message}` },
      { status: 500 }
    );
  }
}
