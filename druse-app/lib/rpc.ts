import https from "node:https";
import { createPublicClient, defineChain, fallback, http, type Transport } from "viem";

export const ROBINHOOD_RPC_HOST = "rpc.mainnet.chain.robinhood.com";
/** Cloudflare edge IP used when hostname DNS fails (common on some hosts / serverless). */
export const ROBINHOOD_RPC_IP = process.env.RPC_IP?.trim() || "104.20.46.209";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [`https://${ROBINHOOD_RPC_HOST}`],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

function isRobinhoodRpc(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("robinhood") ||
      host === ROBINHOOD_RPC_IP ||
      host.includes("alchemy.com") ||
      host.includes("quicknode")
    );
  } catch {
    return false;
  }
}

/** HTTPS to Cloudflare IP with correct SNI / Host so TLS matches the RH cert. */
function robinhoodIpTransport(): Transport {
  return http(`https://${ROBINHOOD_RPC_IP}`, {
    timeout: 12_000,
    fetchFn: (input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const body =
          typeof init?.body === "string"
            ? init.body
            : init?.body != null
              ? Buffer.from(init.body as ArrayBuffer)
              : undefined;
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const req = https.request(
          {
            host: ROBINHOOD_RPC_IP,
            servername: ROBINHOOD_RPC_HOST,
            path: new URL(url).pathname,
            method: init?.method || "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
              host: ROBINHOOD_RPC_HOST,
              ...(body
                ? {
                    "content-length":
                      typeof body === "string"
                        ? Buffer.byteLength(body)
                        : body.length,
                  }
                : {}),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
              resolve(
                new Response(Buffer.concat(chunks), {
                  status: res.statusCode || 500,
                  headers: { "content-type": "application/json" },
                }),
              );
            });
          },
        );
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
      }),
  });
}

function buildTransports(): Transport[] {
  const envUrl = process.env.RPC_URL?.trim();
  const transports: Transport[] = [];

  // Prefer official hostname.
  transports.push(http(`https://${ROBINHOOD_RPC_HOST}`, { timeout: 12_000 }));

  // Optional provider / override — only if it still looks like RH infra.
  if (envUrl && isRobinhoodRpc(envUrl) && !envUrl.includes(ROBINHOOD_RPC_HOST)) {
    transports.push(http(envUrl, { timeout: 12_000 }));
  }

  // Sequencer HTTP (public) as another path when edge RPC flakes.
  transports.push(
    http("https://sequencer.mainnet.chain.robinhood.com", { timeout: 12_000 }),
  );

  transports.push(robinhoodIpTransport());
  return transports;
}

export const publicClient = createPublicClient({
  chain: robinhoodChain,
  transport: fallback(buildTransports(), { rank: false }),
});

export async function readJson<T>(res: Response, fallbackValue: T): Promise<T> {
  const text = await res.text();
  if (!text) return fallbackValue;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallbackValue;
  }
}
