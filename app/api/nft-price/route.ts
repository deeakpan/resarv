import { type Address, type Hex, isAddress } from "viem";
import { signNftPrice } from "@/lib/nft-price";
import { getAddresses } from "@/lib/contracts";

export const dynamic = "force-dynamic";

/**
 * GET /api/nft-price?collection=0x..&tokenId=123&chainId=50312
 * DEMO: signs mock collection at live Stonk Brokers floor (USD 1e18).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const collection = url.searchParams.get("collection");
    const tokenIdRaw = url.searchParams.get("tokenId");
    const chainIdRaw = url.searchParams.get("chainId");

    if (!collection || !isAddress(collection)) {
      return Response.json({ error: "Invalid collection" }, { status: 400 });
    }
    if (tokenIdRaw == null || !/^\d+$/.test(tokenIdRaw)) {
      return Response.json({ error: "Invalid tokenId" }, { status: 400 });
    }

    const chainId = Number(
      chainIdRaw || process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || "50312",
    );
    if (!Number.isFinite(chainId)) {
      return Response.json({ error: "Invalid chainId" }, { status: 400 });
    }

    const pk = process.env.PRICE_SIGNER_PRIVATE_KEY;
    if (!pk) {
      return Response.json(
        { error: "PRICE_SIGNER_PRIVATE_KEY not configured" },
        { status: 500 },
      );
    }
    const privateKey = (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;

    const addrs = getAddresses(chainId);
    const nftCdp = addrs?.nftCdp;
    if (!nftCdp) {
      return Response.json(
        { error: `NFT CDP not in deployments for chain ${chainId}` },
        { status: 500 },
      );
    }

    const signed = await signNftPrice({
      collection: collection as Address,
      tokenId: BigInt(tokenIdRaw),
      chainId,
      nftCdp,
      privateKey,
    });

    return Response.json({
      ...signed,
      chainId,
      nftCdp,
      ttlSeconds: 40,
      note: signed.demo
        ? "DEMO: mock collection signed at live Stonk Brokers floor"
        : "Collection floor attestation (USD 1e18)",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sign failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
