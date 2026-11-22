import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/platform/theme";
import { SwRegister } from "@/components/platform/sw-register";
import { Toaster } from "@/components/ui/sonner";
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site";
import { APPS } from "@/lib/registry";

// Display face with character (see DESIGN.md): h1, h2, wordmark only.
const displayFace = Bricolage_Grotesque({
  variable: "--font-face-display",
  subsets: ["latin"],
});

// Body face: humanist grotesk, readable at 16px, not a model default.
const bodyFace = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

// Mono is the outlier role: session codes, figures, keyboard keys.
const monoFace = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "file transfer",
    "clipboard sharing",
    "whiteboard",
    "polls",
    "screen sharing",
    "web tools",
    "no signup",
  ],
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    url: "/",
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ShareOnWeb — practical tools that run straight between browsers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#009966",
};

// Structured data for search engines and generative engines (GEO): one
// WebApplication for the product plus an ItemList describing every tool,
// including planned ones. Rendered on the server so it is present in the
// first HTML response no matter which view the client later shows.
const CATEGORY_SCHEMA: Record<string, string> = {
  communicate: "CommunicationApplication",
  share: "UtilitiesApplication",
  collaborate: "BusinessApplication",
  remote: "BusinessApplication",
  utilities: "UtilitiesApplication",
  productivity: "BusinessApplication",
};

function buildJsonLd(): string {
  const liveApps = APPS.filter((a) => a.status === "live");
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any modern web browser",
      browserRequirements: "Requires JavaScript",
      description: SITE_DESCRIPTION,
      featureList: liveApps.map((a) => a.name),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "ItemList",
      "@id": `${SITE_URL}/#tools`,
      name: "ShareOnWeb tools",
      itemListElement: APPS.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "WebApplication",
          name: a.name,
          description: a.tagline,
          applicationCategory: CATEGORY_SCHEMA[a.category] ?? "UtilitiesApplication",
          ...(a.status === "live"
            ? {
                url: `${SITE_URL}/?app=${a.id}`,
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              }
            : {}),
        },
      })),
    },
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${displayFace.variable} ${bodyFace.variable} ${monoFace.variable}`}
    >
      <body className="antialiased bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: buildJsonLd() }}
        />
        <ThemeProvider>
          {children}
          <SwRegister />
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
