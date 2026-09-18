import type { Metadata } from "next";
import PositionDetail from "../../../components/PositionDetail";

export const metadata: Metadata = { title: "Position" };

export default async function PositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PositionDetail tokenId={id} />;
}
