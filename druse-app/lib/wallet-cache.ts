import type { QueryClient } from "@tanstack/react-query";

/** Drop cached wallet balances/allowances so pickers show post-tx amounts. */
export function invalidateWalletReads(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["readContract"] }),
    queryClient.invalidateQueries({ queryKey: ["readContracts"] }),
    queryClient.invalidateQueries({ queryKey: ["balance"] }),
  ]);
}
