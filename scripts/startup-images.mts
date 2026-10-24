// One-off: iPhone launch screens for the home-screen app → public/startup/<w>x<h>.png (committed).
// Paper background + the Chalk wordmark (2× the navbar size), centred – the same as app/(app)/loading.tsx.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/startup-images.mts
//
// scripts/assets/chalk-wordmark.png = the navbar wordmark (components/navbar/wordmark.tsx) drawn at 8× in the
// browser with the app's own Source Serif 4, ink on transparent. sharp is already installed (it comes with Next).
import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { startupImagePath, startupScreens } from "../lib/startup-images.ts";

const PAPER = "#fcf9f7";
const ASSET = "scripts/assets/chalk-wordmark.png";
const ASSET_SCALE = 8; // the asset is 8× the navbar wordmark
const SPLASH_SCALE = 2; // the splash shows it at 2×

await mkdir("public/startup", { recursive: true });
const asset = sharp(ASSET);
const { width: assetWidth = 0 } = await asset.metadata();

for (const screen of startupScreens) {
  const width = screen.width * screen.ratio;
  const height = screen.height * screen.ratio;
  const mark = await sharp(ASSET)
    .resize({ width: Math.round((assetWidth * SPLASH_SCALE * screen.ratio) / ASSET_SCALE) })
    .toBuffer();
  const { width: w = 0, height: h = 0 } = await sharp(mark).metadata();

  const file = `public${startupImagePath(screen)}`;
  await sharp({ create: { width, height, channels: 3, background: PAPER } })
    .composite([{ input: mark, left: Math.round((width - w) / 2), top: Math.round((height - h) / 2) }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(file);
  console.log(`${file}  ${screen.devices}`);
}
