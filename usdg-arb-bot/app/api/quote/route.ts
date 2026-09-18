import { NextResponse } from "next/server";
import { quotePegRate } from "@/lib/quoter";

export const dynamic = "force-dynamic";

export async function GET() {
  const quote = await quotePegRate();
  return NextResponse.json(quote);
}
