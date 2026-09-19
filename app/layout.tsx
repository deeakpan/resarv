import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist_Mono, Nunito } from "next/font/google";
import Providers from "@/context/providers";
import CookieBanner from "@/app/components/CookieBanner";
import "./globals.css";

/**
 * Rainbow uses SF Pro Rounded (as "SF Rounded Web"). We can't redistribute
 * Apple's files, so prefer system SF Pro Rounded / ui-rounded, with Nunito
 * as the open-licensed soft-rounded fallback on Windows/Android.
 */
const rounded = Nunito({
  variable: "--font-rounded-fallback",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://resarv.xyz");

const title = "Resarv";
const description =
  "Borrow rUSD against NFT collateral on Robinhood Chain. Stake RSRV, use the Stability Pool, and earn protocol fees.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "Resarv | %s",
  },
  description,
  applicationName: "Resarv",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
    shortcut: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Resarv",
    title,
    description,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Resarv borrow rUSD against NFTs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookie = (await headers()).get("cookie");

  return (
    <html
      lang="en"
      className={`${rounded.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] font-sans font-medium text-[#f5f5f5]">
        <Providers cookies={cookie}>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  );
}
