import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import MotionProvider from "@/components/system/MotionProvider";
import ThemeScript from "@/components/system/ThemeScript";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

const SITE = "https://healiolabs.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Healio Labs — Turning complex ideas into remarkable digital experiences",
    template: "%s — Healio Labs",
  },
  description:
    "Healio Labs is a technology and design studio building products, platforms and brand systems for organisations that refuse to stand still. Strategy, design and engineering under one roof.",
  keywords: [
    "digital product studio",
    "design system",
    "product strategy",
    "UX design",
    "software engineering",
    "brand systems",
  ],
  authors: [{ name: "Healio Labs" }],
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Healio Labs",
    title: "Healio Labs — Turning complex ideas into remarkable digital experiences",
    description:
      "A technology and design studio building products, platforms and brand systems for ambitious organisations.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Healio Labs",
    description:
      "A technology and design studio building products, platforms and brand systems for ambitious organisations.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2f5" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeScript />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <MotionProvider />
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Healio Labs",
              url: SITE,
              email: "hello@healiolabs.com",
              description:
                "Technology and design studio building products, platforms and brand systems.",
              address: {
                "@type": "PostalAddress",
                streetAddress: "21 Charlotte Road",
                addressLocality: "London",
                postalCode: "EC2A 3PB",
                addressCountry: "GB",
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
