import { fetchCollectionFloor, usdToWad } from "@/lib/nft-floor";

export const dynamic = "force-dynamic";

/** GET /api/stonk-floor — alias for Stonk Brokers floor (kept for UI compat). */
export async function GET() {
  try {
    const q = await fetchCollectionFloor("stonkbrokers-434284142");
    return Response.json({
      floorEth: q.floorEth,
      floorUsd: q.floorUsd,
      priceWad: usdToWad(q.floorUsd).toString(),
      source: q.source,
      fetchedAt: q.fetchedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Floor fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
