import type { MetadataRoute } from "next";

/**
 * Web app manifest — this is what lets the studio install as an app on
 * Android, iPhone/iPad, Windows and macOS ("Add to Home screen" / "Install").
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Elder Mi Music AI Studio",
    short_name: "Elder Mi",
    description:
      "Afrobeats vocal arrangement, mixing and mastering in one studio: Sam Vocal Studio, Sam Mix Studio and Sam Mastering Studio.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
    orientation: "any",
    background_color: "#090914",
    theme_color: "#090914",
    lang: "en",
    dir: "ltr",
    categories: ["music", "productivity", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Sam Vocal Studio",
        short_name: "Vocal",
        description: "Generate choruses, harmonies, ad-libs and choir stacks",
        url: "/vocal",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Sam Mix Studio",
        short_name: "Mix",
        description: "Import stems, balance channels and bounce a mix",
        url: "/mix",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Sam Mastering Studio",
        short_name: "Master",
        description: "Master, compare and export the finished record",
        url: "/mastering",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
