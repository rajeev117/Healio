import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  lockIcon: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },

  dotsRow: { flexDirection: 'row', gap: 18, marginBottom: 16 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.primary, backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: COLORS.primary },

  error: { fontSize: 13, color: COLORS.error, fontWeight: '600', marginBottom: 8 },

  keypad: { marginTop: 24, gap: 8 },
  keyRow: { flexDirection: 'row', gap: 8 },
  keyBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  keyPlaceholder: { width: 76, height: 76 },
  keyText: { fontSize: 24, fontWeight: '700', color: COLORS.text },

  hint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 36, textAlign: 'center' },
});

export default styles;
