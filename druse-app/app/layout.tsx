import type { Metadata } from "next";
import { headers } from "next/headers";
import { DynaPuff, IBM_Plex_Mono, Inter, Outfit } from "next/font/google";
import Providers from "@/context/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: false,
});

const logo = DynaPuff({
  subsets: ["latin"],
  variable: "--font-logo",
  weight: ["600", "700"],
  display: "swap",
});

const headline = Outfit({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["500", "700", "800"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500"],
  adjustFontFallback: false,
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const description =
  "Instant sell and floor-to-floor routing, powered by Uniswap v4 hooks. Built for Robinhood Chain.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Druse | Trade fluid nfts.",
    template: "Druse | %s",
  },
  description,
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Druse | Trade fluid nfts.",
    description,
    siteName: "Druse",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Druse | Trade fluid nfts.",
    description,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookie = (await headers()).get("cookie");

  return (
    <html
      lang="en"
      className={`${inter.variable} ${logo.variable} ${headline.variable} ${plexMono.variable} min-h-full antialiased`}
    >
      <body
        className={`${inter.className} flex min-h-full flex-col bg-[#100f0c] text-[#f4f4f5]`}
      >
        <Providers cookies={cookie}>{children}</Providers>
      </body>
    </html>
  );
}
