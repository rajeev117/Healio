import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },

  stepBar: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  stepDotActive: { backgroundColor: COLORS.primary },

  content: { alignItems: 'center', paddingTop: 16 },
  stepLabel: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  stepSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 },

  dotsRow: { flexDirection: 'row', gap: 18, marginBottom: 10 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.primary, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: COLORS.primary },

  error: { fontSize: 13, color: COLORS.error, fontWeight: '600', marginBottom: 4 },

  keypad: { marginTop: 20, gap: 8 },
  keyRow: { flexDirection: 'row', gap: 8 },
  keyBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  keyPlaceholder: { width: 76, height: 76 },
  keyText: { fontSize: 24, fontWeight: '700', color: COLORS.text },

  saving: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  savingText: { fontSize: 15, color: COLORS.textSecondary },
});

export default styles;
