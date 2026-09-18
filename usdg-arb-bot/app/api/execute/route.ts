import { NextResponse } from "next/server";
import { executeArb } from "@/lib/arb";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const result = await executeArb({ force: Boolean(body.force) });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
