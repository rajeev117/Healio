import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1, paddingHorizontal: SPACING.l, paddingTop: SPACING.xl,
    paddingBottom: SPACING.l, alignItems: 'center',
  },
  iconWrap: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: COLORS.primarySoft, alignItems: 'center',
    justifyContent: 'center', marginBottom: 24,
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  bold: { fontWeight: '700', color: COLORS.text },
  stepsCard: {
    width: '100%', backgroundColor: COLORS.surface,
    borderRadius: 20, padding: SPACING.m, borderWidth: 1,
    borderColor: COLORS.border, gap: 14, marginBottom: 20,
  },
  stepsTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  timingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.warningSoft, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 12, marginBottom: 16,
  },
  timingText: { fontSize: 13, color: COLORS.textSecondary },
  supportText: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 'auto' },
  link: { color: COLORS.primary, fontWeight: '600' },
  backBtn: {
    marginTop: 24, width: '100%', height: 52, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
});

export default styles;
