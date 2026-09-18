import { loadBoard } from "@/lib/board";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet");
  const safe =
    wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet) ? wallet : null;
  const board = await loadBoard(safe);
  return Response.json(board, {
    headers: { "Cache-Control": "no-store" },
  });
}
