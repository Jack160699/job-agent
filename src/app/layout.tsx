import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
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

export const metadata: Metadata = {
  title: "Job Agent — AI-Powered Job Application Assistant",
  description:
    "Automatically discover jobs, match against your profile, tailor resumes truthfully, and track applications.",
  openGraph: {
    title: "Job Agent — AI-Powered Job Application Assistant",
    description:
      "Discover relevant jobs, get honest match scores, and automate applications with full transparency.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--canvas)] font-sans text-[var(--ink)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
