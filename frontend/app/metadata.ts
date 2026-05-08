import { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tb.tahio.eu";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "TunnelBroker - Free IPv6 Tunnel Service",
  description: "Connect to the IPv6 Internet using your existing IPv4 connection with our free tunneling service.",
  openGraph: {
    title: "TunnelBroker - Free IPv6 Tunnel Service",
    description: "Connect to the IPv6 Internet using your existing IPv4 connection with our free tunneling service.",
    url: siteUrl,
    siteName: "TunnelBroker",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TunnelBroker - Free IPv6 Tunnel Service",
    description: "Connect to the IPv6 Internet using your existing IPv4 connection with our free tunneling service.",
  },
};
