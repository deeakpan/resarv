import type { Metadata } from "next";
import VaultsBoard from "../../components/VaultsBoard";

export const metadata: Metadata = {
  title: "Our collections",
};

export default function VaultsPage() {
  return <VaultsBoard />;
}
