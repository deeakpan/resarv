import type { Metadata } from "next";
import PoolDetail from "../../../components/PoolDetail";
import { vaultMatchesSlug } from "@/lib/druse";
import { loadLiveVaults } from "@/lib/live-vaults";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const vaults = await loadLiveVaults();
    const vault = vaults.find((v) => vaultMatchesSlug(v, id));
    if (!vault) return { title: "Pool" };
    return {
      title: `${vault.symbol} / ETH`,
      description: vault.description?.trim() || `Trade ${vault.name} (${vault.symbol}) on Druse.`,
    };
  } catch {
    return { title: "Pool" };
  }
}

export default async function PoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PoolDetail slug={id} />;
}
