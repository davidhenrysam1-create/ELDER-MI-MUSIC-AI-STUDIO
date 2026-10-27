import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StudioProvider } from "@/lib/client/studio";
import { StudioShell } from "@/components/shell/StudioShell";
import { PwaBridge } from "@/components/pwa/PwaBridge";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Elder Mi Music AI Studio — Your Sound. Your Culture. Your Studio.",
    template: "%s · Elder Mi Music AI Studio",
  },
  description:
    "AI-assisted vocal arrangement, mixing and mastering for Afrobeats producers. Sam Vocal Studio, Sam Mix Studio and Sam Mastering Studio in one unified workstation.",
  applicationName: "Elder Mi Music AI Studio",
  keywords: [
    "Afrobeats",
    "AI music production",
    "vocal arrangement",
    "mixing",
    "mastering",
    "LUFS",
  ],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Elder Mi",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  // Older iOS versions still look for the legacy capability meta tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  openGraph: {
    type: "website",
    siteName: "Elder Mi Music AI Studio",
    title: "Elder Mi Music AI Studio",
    description:
      "Vocal arrangement, mixing and mastering for Afrobeats — one project, three studios.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Elder Mi Music AI Studio",
    description: "Your Sound. Your Culture. Your Studio.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090914" },
    { media: "(prefers-color-scheme: light)", color: "#090914" },
  ],
  width: "device-width",
  initialScale: 1,
  // Never block pinch-zoom: the mixer is dense and users need to zoom.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  colorScheme: "dark",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-violet focus:px-3 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <StudioProvider>
          <StudioShell>
            <div id="main-content">{children}</div>
          </StudioShell>
          <PwaBridge />
        </StudioProvider>
      </body>
    </html>
  );
}
