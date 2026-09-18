import { fetchCollectionFloor, usdToWad } from "@/lib/nft-floor";

export const dynamic = "force-dynamic";

/** GET /api/nft-floor?collection=0x…|slug — live OpenSea floor */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const collection =
      url.searchParams.get("collection") ||
      url.searchParams.get("slug") ||
      "stonkbrokers-434284142";
    const q = await fetchCollectionFloor(collection);
    return Response.json({
      floorEth: q.floorEth,
      floorUsd: q.floorUsd,
      priceWad: usdToWad(q.floorUsd).toString(),
      source: q.source,
      slug: q.slug,
      fetchedAt: q.fetchedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Floor fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
