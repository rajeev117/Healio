import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
  },
  badge: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  title: { fontWeight: '800', color: COLORS.text },
  sub: { marginTop: 2, color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  time: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  empty: { color: COLORS.textSecondary, fontSize: 13, paddingVertical: 8 },
});

export default styles;
