import type { Metadata } from "next";
import PoolsBoard from "../../components/PoolsBoard";

export const metadata: Metadata = { title: "Pools" };

export default function PoolsPage() {
  return <PoolsBoard />;
}
