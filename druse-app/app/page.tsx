import HomeClient from "./components/HomeClient";
import { loadLiveFloors } from "@/lib/live-floors";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { collections } = await loadLiveFloors();
  return <HomeClient collections={collections} />;
}
