import { createPublicClient, http } from "viem";
import { ERC721_ABI } from "@/lib/druse";
import { loadVaultDetail } from "@/lib/live-vaults";
import { robinhoodChain } from "@/lib/rpc";

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com"),
});

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const detail = await loadVaultDetail(slug);
  if (!detail) {
    return Response.json({ error: "Vault not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const wallet = url.searchParams.get("wallet");
  let owned: string[] = [];
  if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    owned = await ownedTokenIds(detail.asset, wallet);
  }

  return Response.json(
    { vault: detail, owned },
    { headers: { "Cache-Control": "public, s-maxage=8, stale-while-revalidate=30" } },
  );
}

async function ownedTokenIds(asset: string, wallet: string) {
  const fromMock = await ownedFromNextId(asset, wallet);
  if (fromMock.length) return fromMock;
  return ownedFromBlockscout(asset, wallet);
}

async function ownedFromNextId(asset: string, wallet: string) {
  try {
    const nextId = await client.readContract({
      address: asset as `0x${string}`,
      abi: ERC721_ABI,
      functionName: "nextId",
    });
    const end = Number(nextId);
    if (!Number.isFinite(end) || end <= 1 || end > 2000) return [];

    const results = await client.multicall({
      allowFailure: true,
      contracts: Array.from({ length: end - 1 }, (_, i) => ({
        address: asset as `0x${string}`,
        abi: ERC721_ABI,
        functionName: "ownerOf" as const,
        args: [BigInt(i + 1)],
      })),
    });
    const ids: string[] = [];
    results.forEach((row, i) => {
      if (
        row.status === "success" &&
        typeof row.result === "string" &&
        row.result.toLowerCase() === wallet.toLowerCase()
      ) {
        ids.push(String(i + 1));
      }
    });
    return ids;
  } catch {
    return [];
  }
}

async function ownedFromBlockscout(asset: string, wallet: string) {
  try {
    const res = await fetch(
      `${BLOCKSCOUT}/api/v2/addresses/${wallet}/nft?type=ERC-721`,
      { next: { revalidate: 8 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: { id?: string; token?: { address_hash?: string } }[];
    };
    return (data.items ?? [])
      .filter(
        (item) =>
          item.token?.address_hash?.toLowerCase() === asset.toLowerCase() &&
          item.id,
      )
      .map((item) => String(item.id));
  } catch {
    return [];
  }
}
