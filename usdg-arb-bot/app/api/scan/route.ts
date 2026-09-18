import { NextResponse } from "next/server";
import { scanArb } from "@/lib/arb";

export const dynamic = "force-dynamic";

export async function GET() {
  const scan = await scanArb();
  return NextResponse.json(scan);
}
