// iOS doesn't build a launch screen from the manifest, so the home-screen app needs one PNG per iPhone screen
// (portrait). Used by app/layout.tsx (metadata) and scripts/startup-images.mts (generates public/startup/*.png).

export type StartupScreen = { width: number; height: number; ratio: number; devices: string };

export const startupScreens: StartupScreen[] = [
  { width: 375, height: 667, ratio: 2, devices: "iPhone SE (2., 3.), 8" },
  { width: 414, height: 736, ratio: 3, devices: "iPhone 8 Plus" },
  { width: 375, height: 812, ratio: 3, devices: "iPhone 12 mini, 13 mini, X, XS, 11 Pro" },
  { width: 414, height: 896, ratio: 2, devices: "iPhone 11, XR" },
  { width: 414, height: 896, ratio: 3, devices: "iPhone 11 Pro Max, XS Max" },
  { width: 390, height: 844, ratio: 3, devices: "iPhone 12, 13, 14, 16e" },
  { width: 428, height: 926, ratio: 3, devices: "iPhone 12 Pro Max, 13 Pro Max, 14 Plus" },
  { width: 393, height: 852, ratio: 3, devices: "iPhone 14 Pro, 15, 15 Pro, 16" },
  { width: 430, height: 932, ratio: 3, devices: "iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus" },
  { width: 402, height: 874, ratio: 3, devices: "iPhone 16 Pro, 17, 17 Pro" },
  { width: 420, height: 912, ratio: 3, devices: "iPhone Air" },
  { width: 440, height: 956, ratio: 3, devices: "iPhone 16 Pro Max, 17 Pro Max" },
];

export const startupImagePath = (s: StartupScreen) => `/startup/${s.width * s.ratio}x${s.height * s.ratio}.png`;

export const startupImageMedia = (s: StartupScreen) =>
  `(device-width: ${s.width}px) and (device-height: ${s.height}px) and (-webkit-device-pixel-ratio: ${s.ratio}) and (orientation: portrait)`;
