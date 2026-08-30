import { StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  sub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },
  btn: {
    marginTop: 24, backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 13,
  },
  btnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
});

export default styles;
