import { loadLiveFloors } from "@/lib/live-floors";

export async function GET() {
  const { collections, source } = await loadLiveFloors();
  return Response.json(
    { collections, source },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
