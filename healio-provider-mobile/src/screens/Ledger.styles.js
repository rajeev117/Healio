import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  row: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', color: COLORS.text, textTransform: 'capitalize' },
  sub: { marginTop: 2, color: COLORS.textSecondary, fontSize: 12 },
  amount: { fontWeight: '800', color: COLORS.primary },
  empty: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
});

export default styles;
