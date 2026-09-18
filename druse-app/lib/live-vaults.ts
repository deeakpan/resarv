import { loadLiveFloors } from "@/lib/live-floors";
import { publicClient } from "@/lib/rpc";
import { isUiBlacklisted } from "@/lib/features";
import {
  DEFAULT_CHAIN_ID,
  FACTORY_ABI,
  VAULT_ABI,
  collectionById,
  displayForAsset,
  getDeployment,
  getFactoryAddress,
  vaultMatchesSlug,
  type LiveVault,
  type VaultDetail,
} from "@/lib/druse";

export async function loadLiveVaults(): Promise<LiveVault[]> {
  const factory = getFactoryAddress(DEFAULT_CHAIN_ID);
  if (!factory) return [];

  let vaultAddrs: `0x${string}`[] = [];
  try {
    vaultAddrs = (await publicClient.readContract({
      address: factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: "allVaults",
    })) as `0x${string}`[];
  } catch (err) {
    console.error("[loadLiveVaults] allVaults failed", factory, err);
    vaultAddrs = knownVaultAddresses();
  }

  if (!vaultAddrs.length) vaultAddrs = knownVaultAddresses();

  let floors: Awaited<ReturnType<typeof loadLiveFloors>>["collections"] = [];
  try {
    floors = (await loadLiveFloors()).collections;
  } catch (err) {
    console.error("[loadLiveVaults] floors failed", err);
  }

  const vaults: LiveVault[] = [];
  for (const vault of vaultAddrs) {
    if (isUiBlacklisted(vault)) continue;

    try {
      const [asset, name, symbol, holdings, vaultId] = await Promise.all([
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "assetAddress" }),
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "name" }),
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "symbol" }),
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "totalHoldings" }),
        publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "vaultId" }),
      ]);

      if (isUiBlacklisted(asset as string)) continue;

      const display = displayForAsset(asset);
      const floor = display ? floors.find((c) => c.id === display.id) : undefined;

      vaults.push({
        vault,
        asset,
        vaultId: vaultId.toString(),
        name: display?.name ?? name,
        symbol,
        holdings: Number(holdings),
        id: display?.id ?? null,
        image: display?.image ?? null,
        art: display?.art ?? null,
        description: display?.description || null,
        floorEth: floor?.floorEth ?? null,
        floorUsd: floor?.floorUsd ?? null,
        volumeEth: floor?.volumeEth ?? null,
        change24h: floor?.change24h ?? null,
      });
    } catch (err) {
      console.error("[loadLiveVaults] vault read failed", vault, err);
      const offline = offlineVaultRow(vault, floors);
      if (offline) vaults.push(offline);
    }
  }

  return vaults;
}

/** Addresses from deployments JSON when factory reads fail. */
function knownVaultAddresses(): `0x${string}`[] {
  const d = getDeployment(DEFAULT_CHAIN_ID) as {
    vaults?: Record<string, string>;
    collections?: Record<string, { vault?: string | null }>;
  };
  const out = new Set<string>();
  for (const addr of Object.values(d.vaults ?? {})) {
    if (addr && !isUiBlacklisted(addr)) out.add(addr);
  }
  for (const row of Object.values(d.collections ?? {})) {
    if (row?.vault && !isUiBlacklisted(row.vault)) out.add(row.vault);
  }
  return [...out] as `0x${string}`[];
}

function offlineVaultRow(
  vault: string,
  floors: Awaited<ReturnType<typeof loadLiveFloors>>["collections"],
): LiveVault | null {
  const d = getDeployment(DEFAULT_CHAIN_ID) as {
    vaults?: Record<string, string>;
    nfts?: Record<string, string>;
    collections?: Record<string, { nft?: string; vault?: string | null }>;
  };
  const id =
    Object.entries(d.vaults ?? {}).find(([, a]) => a.toLowerCase() === vault.toLowerCase())?.[0] ??
    Object.entries(d.collections ?? {}).find(
      ([, row]) => row?.vault?.toLowerCase() === vault.toLowerCase(),
    )?.[0];
  if (!id) return null;
  const display = collectionById(id);
  const asset =
    d.collections?.[id]?.nft ?? d.nfts?.[id] ?? "0x0000000000000000000000000000000000000000";
  const floor = floors.find((c) => c.id === id);
  return {
    vault,
    asset,
    vaultId: "0",
    name: display?.name ?? id,
    symbol: display?.symbol ?? "pTOKEN",
    holdings: 0,
    id: display?.id ?? id,
    image: display?.image ?? null,
    art: display?.art ?? null,
    description: display?.description || null,
    floorEth: floor?.floorEth ?? null,
    floorUsd: floor?.floorUsd ?? null,
    volumeEth: floor?.volumeEth ?? null,
    change24h: floor?.change24h ?? null,
  };
}

export async function loadVaultDetail(slug: string): Promise<VaultDetail | null> {
  const vaults = await loadLiveVaults();
  const vault = vaults.find((v) => vaultMatchesSlug(v, slug));
  if (!vault) return null;

  const address = vault.vault as `0x${string}`;
  const [holdings, fees, enableMint, enableRedeem] = await Promise.all([
    publicClient.readContract({ address, abi: VAULT_ABI, functionName: "allHoldings" }),
    publicClient.readContract({ address, abi: VAULT_ABI, functionName: "vaultFees" }),
    publicClient.readContract({ address, abi: VAULT_ABI, functionName: "enableMint" }),
    publicClient.readContract({ address, abi: VAULT_ABI, functionName: "enableRedeem" }),
  ]);

  const [mintEth, redeemEth] = await Promise.all([
    publicClient
      .readContract({
        address,
        abi: VAULT_ABI,
        functionName: "pTokenToETH",
        args: [fees[0]],
      })
      .catch(() => 0n),
    publicClient
      .readContract({
        address,
        abi: VAULT_ABI,
        functionName: "pTokenToETH",
        args: [fees[1]],
      })
      .catch(() => 0n),
  ]);

  return {
    ...vault,
    tokenIds: holdings.map((id) => id.toString()),
    enableMint,
    enableRedeem,
    mintFeeEth: formatWei(mintEth),
    redeemFeeEth: formatWei(redeemEth),
    mintFeeWei: mintEth.toString(),
    redeemFeeWei: redeemEth.toString(),
    mintFeePct: Number(fees[0]) / 1e16,
    redeemFeePct: Number(fees[1]) / 1e16,
  };
}

function formatWei(wei: bigint) {
  if (wei === 0n) return 0;
  return Number(wei) / 1e18;
}
