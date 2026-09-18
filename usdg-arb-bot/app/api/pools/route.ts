import { NextResponse } from "next/server";
import { discoverUsdgPools } from "@/lib/pools";

export const dynamic = "force-dynamic";

export async function GET() {
  const pools = await discoverUsdgPools();
  return NextResponse.json({
    chainId: 4663,
    usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
    count: pools.length,
    pools,
  });
}
