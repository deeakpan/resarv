import type { Metadata } from "next";
import PositionsBoard from "../../components/PositionsBoard";

export const metadata: Metadata = { title: "Positions" };

export default function PositionsPage() {
  return <PositionsBoard />;
}
