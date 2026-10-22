import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StudioProvider } from "@/lib/client/studio";
import { StudioShell } from "@/components/shell/StudioShell";

export const metadata: Metadata = {
  title: "Elder Mi Music AI Studio — Your Sound. Your Culture. Your Studio.",
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
};

export const viewport: Viewport = {
  themeColor: "#090914",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
        </StudioProvider>
      </body>
    </html>
  );
}
