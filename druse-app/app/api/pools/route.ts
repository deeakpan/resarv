import { loadPools } from "@/lib/pools";

export async function GET() {
  try {
    const pools = await loadPools();
    return Response.json({ pools }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ pools: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
