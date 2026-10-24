import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { startupImageMedia, startupImagePath, startupScreens } from "@/lib/startup-images";
import "./globals.css";

// latin-ext is needed for Lithuanian letters (ą č ę ė į š ų ū ž).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "Chalk", template: "%s · Chalk" },
  description: "Adomo korepetitoriaus darbo vieta",
  // Private app: never indexed (also robots.txt and the X-Robots-Tag header in next.config.ts).
  robots: { index: false, follow: false },
  // "Add to Home Screen" on iPhone (Android reads app/manifest.ts). iOS shows the startup image while Chalk loads
  // (public/startup, scripts/startup-images.mts) – without it the launch screen is blank (black in dark mode).
  appleWebApp: {
    capable: true,
    title: "Chalk",
    statusBarStyle: "default",
    startupImage: startupScreens.map((s) => ({ url: startupImagePath(s), media: startupImageMedia(s) })),
  },
  // Next only writes mobile-web-app-capable; iOS still wants the apple- one for startup images.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#fcf9f7",
  // Chalk is light-only for now (dark theme comes later): the browser canvas, scrollbars and form controls stay light
  // even when the phone is in dark mode.
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Inline paper background: the very first paint is #fcf9f7, even before globals.css arrives.
    <html lang="lt" className={`${inter.variable} ${sourceSerif.variable}`} style={{ backgroundColor: "#fcf9f7" }}>
      <body className="min-h-dvh">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
