import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    height: 220,
  },
  barColumn: { alignItems: 'center', gap: 8, flex: 1 },
  bar: { width: 18, borderRadius: 999, backgroundColor: COLORS.primary },
  barLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },
});

export default styles;
