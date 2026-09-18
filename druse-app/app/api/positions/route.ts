import { loadPosition, loadPositions } from "@/lib/pools";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet");
  const id = url.searchParams.get("id");
  if (id) {
    const position = await loadPosition(id);
    return Response.json({ position }, { headers: { "Cache-Control": "no-store" } });
  }
  const safe = wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet) ? wallet : null;
  const positions = safe ? await loadPositions(safe) : [];
  return Response.json({ positions }, { headers: { "Cache-Control": "no-store" } });
}
