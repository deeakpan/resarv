import type { Metadata } from "next";
import StakePage from "../../components/StakePage";

export const metadata: Metadata = { title: "Stake" };

export default function StakeRoute() {
  return <StakePage />;
}
