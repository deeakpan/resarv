import type { CSSProperties } from "react";
import { liquidityCap, RH_COLLECTIONS } from "@/lib/floors";
import { SOCIAL, TRADE_DRUSE } from "@/lib/socials";

const MOSAIC = [
  ...RH_COLLECTIONS.map((c) => c.art),
  ...RH_COLLECTIONS.map((c) => c.image),
  "/hero/nfts/cats.png",
  "/hero/nfts/pyo.png",
  "/hero/nfts/hoodie.svg",
  "/hero/nfts/stonk.svg",
  "/hero/nfts/mancer.svg",
  "/hero/nfts/pit.svg",
];

function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 9 9 3M4.5 3H9v4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TradeDruse({ className = "mt-8 inline-flex" }: { className?: string }) {
  const inner = (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111] text-white">
        <Arrow />
      </span>
      <span className="text-[12px] font-extrabold tracking-[0.08em] text-[#111] uppercase">
        Trade
      </span>
    </>
  );
  const cls = `items-center gap-2.5 rounded-full bg-[#e8c547] py-2 pr-5 pl-2 no-underline ${className}`;
  if (!TRADE_DRUSE) {
    return <span className={`${cls} cursor-default`}>{inner}</span>;
  }
  return (
    <a href={TRADE_DRUSE} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  );
}

function Launch({ href, label, className = "mt-8 inline-flex" }: { href: string; label: string; className?: string }) {
  return (
    <a
      href={href}
      className={`items-center gap-2.5 rounded-full bg-[#e8c547] py-2 pr-5 pl-2 no-underline ${className}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111] text-white">
        <Arrow />
      </span>
      <span className="text-[12px] font-extrabold tracking-[0.08em] text-[#111] uppercase">
        {label}
      </span>
    </a>
  );
}

function Shot({
  src,
  className,
  style,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-[#141210] ${className ?? ""}`}
      style={style}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

const STEPS = [
  {
    n: 1,
    title: "Put the NFT in",
    body: "Deposit a piece from a collection into its vault. One NFT goes in.",
  },
  {
    n: 2,
    title: "You get 1 pTOKEN",
    body: "The vault mints you one pTOKEN. That’s the NFT, now fungible. Mint and redeem take a cut in ETH.",
  },
  {
    n: 3,
    title: "Sell it at floor",
    body: "Swap the pTOKEN for ETH at the pool price. That’s the floor, paid out in one go.",
  },
  {
    n: 4,
    title: "Pair it on v4",
    body: "Add pTOKEN and WETH to a Uniswap v4 pool, or open the pool if nobody has yet.",
  },
  {
    n: 5,
    title: "Stake $DRUSE",
    body: "Lock $DRUSE. When people trade, the fees come back to you in ETH.",
  },
];

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <article className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-[family-name:var(--font-logo)] text-[13px] font-bold leading-none text-[#111]">
        {n}
      </span>
      <div>
        <h3 className="font-[family-name:var(--font-headline)] text-[15px] font-extrabold tracking-[-0.03em] text-white">
          {title}
        </h3>
        <p className="mt-0.5 text-[13px] leading-snug text-white/55">{body}</p>
      </div>
    </article>
  );
}

const MANCER = RH_COLLECTIONS.find((c) => c.id === "chain-mancers")!;
const POOL_ICONS: Record<string, string> = {
  stonkbrokers: "/hero/nfts/stonk.svg",
  "chain-mancers": "/hero/nfts/mancer.svg",
};
const POOL_ROWS = (
  [
    ["stonkbrokers", "pSTONK"],
    ["chain-mancers", "pMANCER"],
    ["robinhood-punks", "pPUNKS"],
  ] as const
)
  .map(([id, pSymbol]) => {
    const c = RH_COLLECTIONS.find((x) => x.id === id)!;
    const tvl = liquidityCap(c.floorEth, c.volumeEth);
    return {
      ...c,
      pSymbol,
      nft: POOL_ICONS[id] ?? c.art,
      tvl,
      volTvl: tvl > 0 ? c.volumeEth / tvl : 0,
    };
  })
  .sort((a, b) => b.tvl - a.tvl);

function fmtPoolEth(n: number) {
  if (n >= 10) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(2);
}

function EthDot({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 4v8.87l7.5 3.35z" />
      <path fill="#fff" d="M16.5 4 9 16.22l7.5-3.35z" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 21.97v6.03L24 17.62z" />
      <path fill="#fff" d="M16.5 28v-6.03L9 17.62z" />
    </svg>
  );
}

const SWAP_QTY = 0.3;
const SWAP_ETH = MANCER.floorEth * SWAP_QTY;

function fmtSwapEth(n: number) {
  if (n >= 1) return n.toFixed(3);
  return Number(n.toPrecision(3)).toString();
}

function SwapReceipt() {
  return (
    <div className="w-full max-w-[420px]">
      <div className="flex min-w-0 items-center gap-2.5 rounded-[20px] bg-[#141414] px-3 py-3.5 sm:gap-3.5 sm:px-4 sm:py-4">
        <div className="relative h-10 w-10 shrink-0 sm:h-12 sm:w-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/nfts/mancer.svg"
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
          <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center overflow-hidden rounded-[6px] bg-[#111] ring-2 ring-[#141414]">
            <EthDot className="h-5 w-5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium text-white sm:text-[16px]">Swapped</div>
          <div className="mt-0.5 truncate text-[13px] text-white/40 sm:text-[14px]">
            pMANCER → ETH
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[14px] font-medium text-[#d4f542] sm:text-[16px]">
            +{fmtSwapEth(SWAP_ETH)} ETH
          </div>
          <div className="mt-0.5 text-[13px] text-white/40 sm:text-[14px]">
            -{SWAP_QTY} pMANCER
          </div>
        </div>
      </div>
    </div>
  );
}

function PoolTable() {
  return (
    <div className="min-w-0 w-full max-w-[560px] pt-2 md:justify-self-end md:pt-6 md:pr-3">
      <div className="pool-card-tilt">
        <div className="overflow-x-auto overflow-y-hidden rounded-[20px] bg-[#191919]">
        <div className="px-4 pt-4 pb-2 text-[15px] font-medium text-white sm:px-5">
          Top pools
        </div>
        <div className="grid min-w-[320px] grid-cols-[20px_minmax(0,_1.6fr)_auto] gap-2 px-4 py-2 text-[12px] text-white/40 sm:px-5 md:grid-cols-[20px_minmax(0,_1.4fr)_minmax(0,_0.7fr)_minmax(0,_0.7fr)_minmax(0,_0.55fr)]">
          <span>#</span>
          <span>Pool</span>
          <span className="text-right text-white">↓ TVL</span>
          <span className="hidden text-right md:block">1D vol</span>
          <span className="hidden text-right md:block">1D vol/TVL</span>
        </div>
        {POOL_ROWS.map((row, i) => (
          <div
            key={row.id}
            className={`grid min-w-[320px] grid-cols-[20px_minmax(0,_1.6fr)_auto] items-center gap-2 px-4 py-3 sm:px-5 md:grid-cols-[20px_minmax(0,_1.4fr)_minmax(0,_0.7fr)_minmax(0,_0.7fr)_minmax(0,_0.55fr)] ${
              i === 1 ? "bg-white/6" : ""
            }`}
          >
            <span className="text-[13px] text-white/50">{i + 1}</span>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative h-8 w-11 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.nft}
                  alt=""
                  className="absolute top-0 left-0 h-8 w-8 rounded-full object-cover ring-2 ring-[#191919]"
                />
                <span className="absolute top-0 left-[18px] h-8 w-8 overflow-hidden rounded-full ring-2 ring-[#191919]">
                  <EthDot className="h-8 w-8" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-white">
                  {row.pSymbol}/WETH
                </div>
                <div className="text-[12px] text-white/40">v4</div>
              </div>
            </div>
            <div className="text-right text-[13px] text-white">
              {fmtPoolEth(row.tvl)} ETH
            </div>
            <div className="hidden text-right text-[13px] text-white md:block">
              {fmtPoolEth(row.volumeEth)} ETH
            </div>
            <div className="hidden text-right text-[13px] text-white md:block">
              {row.volTvl.toFixed(2)}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingStory() {
  return (
    <>
      <section
        id="vaults"
        className="mx-auto grid max-w-6xl items-start gap-8 px-4 pt-16 pb-8 md:grid-cols-2 md:gap-12 md:px-8 md:pt-28 md:pb-12"
      >
        <div>
          <p className="scroll-rise text-[15px] font-bold text-white">How it works.</p>

          <div className="scroll-stagger mt-8 flex flex-col gap-4">
            {STEPS.map((step) => (
              <Step key={step.n} {...step} />
            ))}
          </div>

          <Launch href="/vaults" label="Launch app" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/story/crew.png?v=4"
          alt=""
          className="scroll-in-right hidden w-full self-start bg-[#0d0c09] object-contain object-top md:-mt-6 md:block"
        />
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-24">
        <div className="scroll-rise min-w-0 max-w-[460px]">
          <p className="text-[15px] font-bold text-white">Always on.</p>
          <h2 className="mt-2 font-[family-name:var(--font-logo)] text-[32px] leading-[1.02] font-bold tracking-[-0.04em] text-white md:text-[52px]">
            Always liquid NFT
          </h2>
          <p className="mt-5 max-w-[460px] text-[16px] leading-relaxed text-white/55">
            Druse turns the NFT into an ERC-20. 1 NFT is 1 pTOKEN.
            pTOKEN trades against WETH in a Uniswap v4 pool, so you can
            swap it for ETH anytime.
          </p>
          <p className="mt-4 max-w-[460px] text-[16px] leading-relaxed text-white/55">
            Want the NFT back? Redeem 1 pTOKEN from the vault. No listing.
            No auction.
          </p>
        </div>
        <div className="scroll-in-right flex justify-center">
          <SwapReceipt />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-16 md:grid-cols-2 md:gap-16 md:px-8 md:py-24">
        <div className="scroll-rise min-w-0 max-w-[460px]">
          <p className="text-[15px] font-bold text-white">What the fees do.</p>
          <h2 className="mt-2 font-[family-name:var(--font-logo)] text-[32px] leading-[1.02] font-bold tracking-[-0.04em] text-white md:text-[52px]">
            Pools get deeper.
          </h2>
          <p className="mt-5 max-w-[460px] text-[16px] leading-relaxed text-white/55">
            $DRUSE has a 3% tax on every trade. That 3% is sent into the
            Uniswap v4 pools that sit behind each collection, so there is
            more ETH and pTOKEN to trade against.
          </p>
          <p className="mt-4 max-w-[460px] text-[16px] leading-relaxed text-white/55">
            Bigger pool, less slippage. A sell at the collection price can
            actually clear instead of walking an empty book.
          </p>
        </div>
        <div className="scroll-in-right min-w-0">
          <PoolTable />
        </div>
      </section>

      <section id="inventory" className="relative mx-auto max-w-6xl px-4 py-24 md:px-8 md:py-32">
        <div className="pointer-events-none absolute inset-x-4 top-8 hidden h-[calc(100%-4rem)] md:block md:px-4">
          <Shot
            src="/hero/nfts/cats.png"
            className="scroll-in-left absolute top-0 left-0 h-[110px] w-[170px]"
            style={{ "--stagger": 0 } as CSSProperties}
          />
          <Shot
            src={RH_COLLECTIONS[2].art}
            className="scroll-in-right absolute top-6 right-[6%] h-[120px] w-[120px]"
            style={{ "--stagger": 1 } as CSSProperties}
          />
          <Shot
            src="/hero/nfts/pyo.png"
            className="scroll-rise absolute bottom-4 left-[4%] h-[160px] w-[120px]"
            style={{ "--stagger": 2 } as CSSProperties}
          />
          <Shot
            src="/story/sell.png?v=4"
            className="scroll-in-right absolute right-[22%] bottom-8 h-[100px] w-[160px]"
            style={{ "--stagger": 3 } as CSSProperties}
          />
          <Shot
            src={RH_COLLECTIONS[5].art}
            className="scroll-scale absolute right-0 bottom-0 h-[150px] w-[110px]"
            style={{ "--stagger": 4 } as CSSProperties}
          />
          <Shot
            src="/hero/nfts/hoodie.svg"
            className="scroll-scale absolute top-[42%] left-[18%] h-[72px] w-[72px]"
            style={{ "--stagger": 5 } as CSSProperties}
          />
        </div>

        <div className="scroll-rise relative z-[1] mx-auto max-w-[440px] py-16 text-center md:py-24">
          <h2 className="font-[family-name:var(--font-headline)] text-[32px] font-extrabold tracking-[-0.04em] text-white md:text-[40px]">
            This is the inventory.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/55">
            Robinhood collections, sitting in vaults, priced at floor. Sell
            one. Buy one. Move across sets without leaving the book.
          </p>
        </div>

        <div className="scroll-stagger mt-4 flex justify-center gap-3 md:hidden">
          <Shot src="/hero/nfts/cats.png" className="h-16 w-16" />
          <Shot src="/hero/nfts/pyo.png" className="h-16 w-16" />
          <Shot src="/hero/nfts/hoodie.svg" className="h-16 w-16" />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-12 overflow-hidden px-4 py-16 md:grid-cols-[minmax(0,_0.92fr)_minmax(0,_1.08fr)] md:px-8 md:py-24">
        <div className="scroll-rise max-w-md">
          <p className="text-[15px] font-bold text-white">Every collection.</p>
          <h2 className="mt-2 font-[family-name:var(--font-headline)] text-[32px] leading-[1.05] font-extrabold tracking-[-0.04em] text-white md:text-[48px]">
            One floor. Whole set.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/55">
            Vault mint and redeem stay 1:1. Uniswap v4 pools price each
            collection at floor. If a pool drifts, arbitrage pulls it back.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/55">
            Trade inside a set, or hop collections. Inventory stays liquid
            because someone else can always buy the other side.
          </p>
        </div>
        <div className="relative h-[220px] md:h-[420px]">
          <div className="absolute inset-y-0 left-0 grid w-[130%] grid-cols-5 gap-2 md:w-[145%]">
            {MOSAIC.slice(0, 20).map((src, i) => (
              <div
                key={`${src}-${i}`}
                className="scroll-tile overflow-hidden rounded-xl bg-[#141210]"
                style={{ "--stagger": i } as CSSProperties}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-square w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="stake"
        className="mx-auto grid scroll-mt-24 max-w-6xl items-start gap-6 px-4 py-16 md:grid-cols-2 md:items-center md:gap-16 md:px-8 md:py-24"
      >
        <div className="scroll-in-left order-2 md:order-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/story/swap.png?v=4"
            alt=""
            className="mx-auto w-full max-w-[340px] bg-[#0d0c09] object-contain md:max-w-none"
          />
          <Launch href="/vaults" label="Get started" className="mt-4 inline-flex md:hidden" />
        </div>
        <div className="scroll-in-right order-1 md:order-2">
          <p className="text-[15px] font-bold text-white">Swap and stake.</p>
          <h2 className="mt-2 font-[family-name:var(--font-logo)] text-[32px] leading-[1.02] font-bold tracking-[-0.04em] text-white md:text-[52px]">
            One in, one out.
          </h2>
          <p className="mt-5 max-w-[420px] text-[16px] leading-relaxed text-white/55">
            Swap one NFT for another in the same collection, at floor.
            Stake DRUSE and you get paid in ETH when people trade.
          </p>
          <Launch href="/vaults" label="Get started" className="mt-8 hidden md:inline-flex" />
        </div>
      </section>

      <section
        id="druse"
        className="mx-auto grid scroll-mt-24 max-w-6xl items-center gap-8 px-4 pt-16 pb-8 md:grid-cols-2 md:gap-16 md:px-8 md:pt-24 md:pb-8"
      >
        <div className="scroll-rise min-w-0 max-w-[520px]">
          <div className="md:hidden">
            <p className="text-[15px] font-bold text-white">The token</p>
            <h2 className="mt-2 font-[family-name:var(--font-logo)] text-[32px] leading-[1.02] font-bold tracking-[-0.04em] text-white">
              $DRUSE
            </h2>
          </div>
          <p className="mt-5 max-w-[460px] text-[16px] leading-relaxed text-white/55 md:mt-0">
            $DRUSE is the protocol token: deflationary, and launched on{" "}
            <a
              href={SOCIAL.pon}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#e8c547] no-underline hover:text-[#f0d060]"
            >
              Pons
            </a>
            .
          </p>
          <p className="mt-4 max-w-[460px] text-[16px] leading-relaxed text-white/55">
            A cut of $DRUSE trading fees is used to acquire NFTs and add
            them to collection vaults. That inventory, plus the ETH paired
            against it, deepens each Uniswap v4 pool so the AMM stays
            liquid at floor.
          </p>
          <p className="mt-4 max-w-[460px] text-[16px] leading-relaxed text-white/55">
            Stake $DRUSE to earn ETH from vault mint, redeem, and pool swap
            fees.
          </p>
          <p className="mt-4 max-w-[460px] text-[16px] leading-relaxed text-white/55">
            After bonding, 0.5% of trade fees repurchase $DRUSE on the
            market and route those tokens into a vesting schedule.
          </p>
          <TradeDruse className="mt-8 inline-flex" />
        </div>
        <div className="scroll-in-right pointer-events-none hidden select-none md:block" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/druse.PNG"
            alt=""
            draggable={false}
            className="w-full object-contain"
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pt-6 pb-16 text-center md:pt-8 md:pb-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/story/vault.png?v=4"
          alt=""
          className="scroll-scale mx-auto mb-10 h-auto w-full max-w-md bg-[#0d0c09] object-contain"
        />
        <p className="scroll-rise text-[18px] leading-relaxed text-white/70 md:text-[20px]">
          Sell an NFT for ETH at floor. Drop one in a vault if you want it
          sitting ready. Swap it for another token in the same set. Stake
          DRUSE and the swap fees pay you.
        </p>
        <Launch href="/vaults" label="Launch app" />
      </section>
    </>
  );
}
