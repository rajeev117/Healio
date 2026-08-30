// Independent-lab palette. Same Healio brand colours as every other module —
// the separation is in the surface language, not the hue: a warm canvas instead
// of the cool grey the hospital-affiliated modules sit on, a blush-tinted
// border, and an asymmetric header radius (see SIZES.headerRadius*).
export const COLORS = {
  primary: '#821c03',
  primaryDeep: '#5e1402',
  secondary: '#fdf2f0',
  accent: '#e63946',
  background: '#ffffff',
  surface: '#faf7f6',      // warm canvas — the independent-provider tell
  text: '#1a1a1a',
  textSecondary: '#6c757d',
  border: '#efe1dd',       // blush-tinted hairline
  borderStrong: '#e0cec9',
  white: '#ffffff',
  error: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  primarySoft: '#fdf2f0',
  successSoft: '#ebfaf0',
  warningSoft: '#fdf6e2',
  dangerSoft: '#fdf2f2',
  infoSoft: '#eef6ff',
  mutedSoft: '#f4f4f6',
  // quick-action tints
  tintTeal: '#e6fffa',   tintTealInk: '#319795',
  tintBlue: '#ebf8ff',   tintBlueInk: '#3182ce',
  tintGold: '#fff9e6',   tintGoldInk: '#b8860b',
  tintViolet: '#faf5ff', tintVioletInk: '#6b46c1',
};

export const SPACING = { xs: 4, s: 8, m: 16, l: 24, xl: 32 };

export const SIZES = {
  radius: 12,
  radiusLg: 20,
  radiusXl: 24,
  padding: 20,
  // Asymmetric header — the hospital modules use a symmetric 32/32.
  headerRadiusLeft: 14,
  headerRadiusRight: 56,
  appBarRadiusRight: 44,
};
