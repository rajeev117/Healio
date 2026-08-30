import { StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 14 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: COLORS.text,
  },
  inputDisabled: { opacity: 0.6 },
  coordRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  coordText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  detectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary,
  },
  detectText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  saveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  note: { fontSize: 12, color: COLORS.textSecondary, marginTop: 12 },
  defaultsBlurb: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 4 },
  featureNote: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 16, marginTop: 6, paddingHorizontal: 4 },
  stack: { gap: 10 },
  row: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16,
    padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowText: { color: COLORS.text, fontWeight: '700' },
  devBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#fca5a5',
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16,
  },
  devBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#dc2626' },
});

export default styles;
