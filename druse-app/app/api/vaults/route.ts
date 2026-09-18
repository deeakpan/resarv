import { getFactoryAddress, DEFAULT_CHAIN_ID } from "@/lib/druse";
import { loadLiveVaults } from "@/lib/live-vaults";

export async function GET() {
  const factory = getFactoryAddress(DEFAULT_CHAIN_ID);
  if (!factory) {
    return Response.json({ vaults: [], source: "no-factory" });
  }

  try {
    const vaults = await loadLiveVaults();
    return Response.json(
      { vaults, factory },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } },
    );
  } catch {
    return Response.json({ vaults: [], factory }, { headers: { "Cache-Control": "no-store" } });
  }
}
