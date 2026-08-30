export const COLORS = {
  primary: '#821c03',
  secondary: '#fdf2f0',
  accent: '#e63946',
  background: '#ffffff',
  surface: '#f7f5f3',      // warm off-white canvas - maroon sits badly on a cool grey
  text: '#1a1a1a',
  textSecondary: '#5c636a',  // 4.45 on the canvas was under AA; this is 5.6
  border: '#e6e1dd',       // warm hairline
  white: '#ffffff',
  error: '#dc3545',
  success: '#28a745',
  warning: '#ffc107',
  mutedSoft: '#f7f2ed',
  primarySoft: '#f7ebe6',
  infoSoft: '#eef6ff',
  successSoft: '#ebfaf0',
  warningSoft: '#fdf6e2',
  dangerSoft: '#fdf2f2',
  borderStrong: '#d6cfc9',
  hairline: '#efeae6',
  // Soft tints - the screens were hardcoding these 15 times over.
  tintTeal: '#e6fffa',   tintTealInk: '#2c7a7b',
  tintBlue: '#eef6ff',   tintBlueInk: '#2b6cb0',
  tintGold: '#fdf6e2',   tintGoldInk: '#9c4221',
  tintViolet: '#faf5ff', tintVioletInk: '#6b46c1',
  tintGreen: '#ebfaf0',  tintGreenInk: '#276749',
  tintRose: '#fff5f5',   tintRoseInk: '#9b2c2c',
};

export const SPACING = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
};

export const SIZES = {
  padding: 20,       // screen gutter
  radiusSm: 10,      // pills, chips, small tags
  radius: 12,        // inputs, buttons, icon tiles
  radiusMd: 16,      // list rows
  radiusLg: 20,      // section cards
  radiusXl: 24,      // feature cards
  header: 28,        // header bottom corners
};

// One raised level, identical on both platforms. Everything else is a flat card:
// white, 1px COLORS.border, a radius token, no shadow.
export const ELEVATION = {
  raised: {
    elevation: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
};

// Categorical palette for the quick-action chips. Eight fixed slots, assigned in
// order and never cycled - a ninth action folds into an existing slot rather
// than inventing a hue.
//
// Validated with the dataviz palette checker (all five checks pass): lightness
// band, chroma floor, CVD separation, normal-vision floor, contrast vs surface.
// The set it replaced failed four of five - two chips were literally the same
// colour, and Admissions vs Home Care sat at deltaE 4.9 for NORMAL vision.
//
// Deliberately separate from the status tints above: status colour is reserved
// and must never double as a category hue. Every chip also carries a text label,
// so identity never rests on colour alone.
export const CATEGORY = [
  { chip: '#ffedd5', ink: '#c2410c' },  // 0 orange
  { chip: '#dbeafe', ink: '#1d4ed8' },  // 1 blue
  { chip: '#d1fae5', ink: '#047857' },  // 2 green
  { chip: '#f3e8ff', ink: '#7e22ce' },  // 3 violet
  { chip: '#fef3c7', ink: '#a16207' },  // 4 amber
  { chip: '#fce7f3', ink: '#be185d' },  // 5 pink
  { chip: '#cffafe', ink: '#0891b2' },  // 6 cyan
  { chip: '#e0e7ff', ink: '#4338ca' },  // 7 indigo
];
