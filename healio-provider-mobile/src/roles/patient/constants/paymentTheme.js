import { COLORS } from './theme';

// Checkout chrome — the dark, neutral surface hosted payment pages use, kept
// separate from the app palette so the gateway screens read as their own
// (branded) surface without fighting the sage-mint app background.
export const GW = {
  ink: '#16211b',
  inkSoft: '#22302a',
  inkLine: 'rgba(255,255,255,0.13)',
  onInk: '#ffffff',
  onInkMuted: 'rgba(255,255,255,0.66)',
  onInkFaint: 'rgba(255,255,255,0.42)',

  page: COLORS.background,
  card: COLORS.white,
  line: COLORS.border,
  text: COLORS.text,
  muted: COLORS.textSecondary,
  brand: COLORS.primary,
  brandSoft: COLORS.primarySoft,
  success: COLORS.success,
  successSoft: COLORS.successSoft,
  error: COLORS.error,
  errorSoft: COLORS.dangerSoft,
  warning: '#8a6d1f',
  warningSoft: COLORS.warningSoft,
};
