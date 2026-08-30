import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderWidth: 1,
    borderColor: COLORS.border, borderRadius: 16, padding: 14, gap: 8,
  },
  badgeRow:    { flexDirection: 'row' },
  testBadge:   { backgroundColor: COLORS.warningSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  testBadgeText: { fontSize: 10, fontWeight: '800', color: '#c05621', letterSpacing: 0.5 },
  planTitle:   { fontSize: 15, fontWeight: '800', color: COLORS.text },
  planSub:     { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  divider:     { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowLabel:    { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  rowValue:    { color: COLORS.text, fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },
});

export default styles;
