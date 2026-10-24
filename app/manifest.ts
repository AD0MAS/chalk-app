import type { MetadataRoute } from "next";

// PWA basics: "Add to Home Screen" opens Chalk full-screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chalk",
    short_name: "Chalk",
    description: "Adomo korepetitoriaus darbo vieta",
    lang: "lt",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fcf9f7",
    theme_color: "#fcf9f7",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // the mark sits inside the 80% safe zone, so the same image works as a maskable icon
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
