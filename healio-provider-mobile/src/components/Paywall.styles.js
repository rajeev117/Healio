import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  desc: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  balance: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  topUpBtn: { backgroundColor: COLORS.primary, marginRight: 8 },
  payBtn: { backgroundColor: COLORS.secondary, borderWidth: 1, borderColor: COLORS.border },
  btnText: { color: COLORS.white, fontWeight: '700' },
});

export default styles;
