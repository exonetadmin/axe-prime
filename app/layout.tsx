import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";

import ScrollProgress from "@/components/scroll-progress";
import { seoCopy } from "@/lib/seo-copy";
import { siteUrl } from "@/lib/site-content";

import "./globals.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: seoCopy.title,
    template: seoCopy.template,
  },
  description: seoCopy.description,
  alternates: {
    canonical: "/",
  },
  keywords: [...seoCopy.keywords],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "AXE PRIME",
    title: seoCopy.title,
    description: seoCopy.openGraphDescription,
    locale: "pt_BR",
    alternateLocale: "en_US",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1080,
        height: 1080,
        alt: seoCopy.imageAlt,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seoCopy.title,
    description: seoCopy.openGraphDescription,
    images: ["/brand/og-image.png"],
    creator: "@axeprime",
  },
  authors: [{ name: "AXE PRIME" }],
  creator: "AXE PRIME",
  category: "finance",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "AXE PRIME",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#04101c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${sans.variable}`}>
        <ScrollProgress />
        {children}
      </body>
    </html>
  );
}
