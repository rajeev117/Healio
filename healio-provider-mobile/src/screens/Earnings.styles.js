import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14, gap: 10 },
  empty: { color: COLORS.textSecondary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  title: { fontWeight: '800' },
  amount: { fontWeight: '800', color: COLORS.primary },
});

export default styles;
