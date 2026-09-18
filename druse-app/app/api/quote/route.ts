import { quoteSwap } from "@/lib/quote";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenIn = url.searchParams.get("in") ?? "";
  const tokenOut = url.searchParams.get("out") ?? "";
  const amount = url.searchParams.get("amount") ?? "";
  if (!tokenIn || !tokenOut) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 200 });
  }
  try {
    const quote = await quoteSwap(tokenIn, tokenOut, amount);
    return Response.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, reason: "no_route" }, { status: 200 });
  }
}
