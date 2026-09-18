import { fetchTokenMetas } from "@/lib/nft-meta";
import { STONK_BROKERS_COLLECTION } from "@/lib/nft-floor";

export const dynamic = "force-dynamic";

/** GET /api/stonk-meta?ids=1,2,3 — Stonk Brokers images (compat). */
export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("ids") || "1,2,3,4,5";
    const ids = raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0 && n < 10_000)
      .slice(0, 20);
    if (!ids.length) {
      return Response.json({ error: "No ids" }, { status: 400 });
    }
    const tokens = await fetchTokenMetas(STONK_BROKERS_COLLECTION, ids);
    return Response.json({ tokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Meta fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
