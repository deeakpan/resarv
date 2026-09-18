import type { Metadata } from "next";
import VaultPage from "../../../components/VaultPage";
import { collectionById } from "@/lib/druse";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const known = collectionById(slug);
  return { title: known?.name ?? "Vault" };
}

export default async function VaultSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <VaultPage slug={slug} />;
}
