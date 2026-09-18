import { fetchTokenMetas } from "@/lib/nft-meta";
import { STONK_BROKERS_COLLECTION } from "@/lib/nft-floor";
import { isAddress } from "viem";

export const dynamic = "force-dynamic";

/** GET /api/nft-meta?collection=0x…&ids=1,2,3 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const collection =
      url.searchParams.get("collection") || STONK_BROKERS_COLLECTION;
    if (!isAddress(collection)) {
      return Response.json({ error: "Invalid collection" }, { status: 400 });
    }
    const raw = url.searchParams.get("ids") || "1,2,3,4,5";
    const ids = raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0 && n < 100_000)
      .slice(0, 20);
    if (!ids.length) {
      return Response.json({ error: "No ids" }, { status: 400 });
    }
    const tokens = await fetchTokenMetas(collection, ids);
    return Response.json({ tokens, collection });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Meta fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
