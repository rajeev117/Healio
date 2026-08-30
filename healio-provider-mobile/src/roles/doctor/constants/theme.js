export const COLORS = {
  primary:       '#821c03',
  secondary:     '#fdf2f0',
  accent:        '#e63946',
  background:    '#ffffff',
  surface:       '#f8f9fa',
  text:          '#1a1a1a',
  textSecondary: '#6c757d',
  border:        '#dee2e6',
  white:         '#ffffff',
  error:         '#dc2626',
  success:       '#16a34a',
  warning:       '#d97706',
  primarySoft:   '#fdf2f0',
  successSoft:   '#ebfaf0',
  warningSoft:   '#fdf6e2',
  dangerSoft:    '#fdf2f2',
  infoSoft:      '#eef6ff',
  mutedSoft:     '#f4f4f6',
  borderStrong: '#ced4da',
  hairline: '#eef0f2',
  primaryHairline: '#e8d5d0',   // soft maroon rule (was COLORS.primaryHairline)       // hairline rules inside cards
  // Quick-action tints - these were hardcoded inline in the screens.
  tintTeal: '#e6fffa',   tintTealInk: '#319795',
  tintBlue: '#ebf8ff',   tintBlueInk: '#3182ce',
  tintGold: '#fff9e6',   tintGoldInk: '#b8860b',
  tintViolet: '#faf5ff', tintVioletInk: '#6b46c1',
};

export const SPACING = {
  xs: 4,
  s:  8,
  m:  16,
  l:  24,
  xl: 32,
};

export const SIZES = {
  padding: 20,       // screen gutter
  radiusSm: 10,      // pills, chips, small tags
  radius: 12,        // inputs, buttons, icon tiles
  radiusMd: 16,      // list rows
  radiusLg: 20,      // section cards
  radiusXl: 24,      // feature cards
  header: 28,        // the maroon header's bottom corners
};

// One raised level, applied identically on both platforms. Everything else is a
// flat card: white, 1px COLORS.border, a radius token, no shadow.
export const ELEVATION = {
  raised: {
  },
};
