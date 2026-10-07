import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteDescription =
  "Voltex maps storm outage risk across Ontario on an H3 hex grid. Live wind, tree cover, flood exposure, and outage history roll up into zone scores and operator briefs for utility crews.";

const PRODUCTION_SITE = "https://voltex-eight.vercel.app";

/** Canonical origin for OG/Twitter images. Must be publicly reachable (not a locked preview URL). */
function siteUrl(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.NODE_ENV === "production") {
    return new URL(PRODUCTION_SITE);
  }
  if (process.env.VERCEL_URL) {
    return new URL(`https://${process.env.VERCEL_URL}`);
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "Voltex | Ontario Storm Outage Risk",
    template: "%s | Voltex",
  },
  description: siteDescription,
  applicationName: "Voltex",
  icons: {
    icon: [{ url: "/logo-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo-mark.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    locale: "en_CA",
    url: "/",
    siteName: "Voltex",
    title: "Voltex | Ontario Storm Outage Risk",
    description: siteDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Voltex storm outage risk map for Ontario",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Voltex | Ontario Storm Outage Risk",
    description: siteDescription,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F0F2F5" },
    { media: "(prefers-color-scheme: dark)", color: "#101216" },
  ],
};

/* Inline script: read the stored theme and apply it to the <html> element
 * before the body renders. Avoids any flash of the wrong theme on hard
 * reload. Kept tiny (no closures, no exception escapes). */
const THEME_BOOT = `(function(){try{var c={dark:'#101216',light:'#F0F2F5'};var t=localStorage.getItem('vx-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',c[t]);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
