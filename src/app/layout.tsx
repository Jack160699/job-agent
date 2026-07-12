import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { BRAND } from "@/lib/brand";
import { getCanonicalOrigin } from "@/lib/brand/urls";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const title = `${BRAND.name} — ${BRAND.tagline}`;
const description = BRAND.promise;

export const metadata: Metadata = {
  metadataBase: new URL(getCanonicalOrigin()),
  title: {
    default: title,
    template: `%s · ${BRAND.name}`,
  },
  description,
  applicationName: BRAND.name,
  keywords: [
    "job search",
    "career",
    "resume",
    "applications",
    "hiring",
    "recruiting",
    "AI career assistant",
  ],
  authors: [{ name: BRAND.name, url: `https://${BRAND.domain}` }],
  creator: BRAND.name,
  openGraph: {
    title,
    description,
    type: "website",
    siteName: BRAND.name,
    locale: "en_US",
    url: getCanonicalOrigin(),
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  icons: {
    icon: [{ url: "/icons/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.svg", type: "image/svg+xml" }],
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: getCanonicalOrigin(),
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const origin = getCanonicalOrigin();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: origin,
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free during beta",
    },
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-full bg-[var(--canvas)] font-sans text-[var(--ink)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
